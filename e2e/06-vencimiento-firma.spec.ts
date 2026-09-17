import { test, expect } from "@playwright/test";
import { obtenerPersonaDemo } from "@/adapters/mock/personas";
import { TEXTOS_05A } from "@/domain/v4/textos-pago";
import { prepararEscenario } from "./support/demo-panel";
import {
  completarActividadV4,
  completarConsentimientosV4,
  completarDatosPersonalesV4,
  completarDeclaracionesV4,
  completarFirmaV4,
  completarIdentidadAprobada,
  completarPlan,
  completarPreparacion,
  completarWhatsapp,
} from "./support/flujo";

/**
 * Escenario 6 — Caducidad del expediente firmado sin pagar (D-10, v4).
 *
 * Se firma en 04E, no se paga, y el expediente caduca sin que se haya movido
 * un guaraní: es exactamente lo que buscaba la inversión de D-08. El plazo se
 * fija **antes** de firmar, con una palanca corta que sigue dejando margen
 * para completar la firma sin flakiness (30 segundos, no el piso de 5): el
 * reloj arranca con la firma del cliente (D-32, D-38).
 *
 * Con Lucía Fernanda Ortiz Meza (C.I. 6.155.740) — la persona de prueba
 * pensada para este desenlace.
 *
 * El pie tiene que declarar el estado final como `VENCIDO`, sin trámite de
 * devolución: no hubo cobro que devolver.
 */
test("expediente firmado sin pagar dentro del plazo dispara Pantalla B", async ({ page }) => {
  // El flujo entero más los 30 s comprimidos del plazo de pago.
  test.setTimeout(300_000);

  const persona = obtenerPersonaDemo("no-firma");
  if (!persona) throw new Error("Fixture 'no-firma' no encontrado en personas.ts.");

  await prepararEscenario(page, { personaId: persona.id, plazoPagoMs: 30_000 });

  await completarPlan(page, persona);
  await completarWhatsapp(page, persona);
  await completarPreparacion(page);
  await completarIdentidadAprobada(page, persona);
  await completarDatosPersonalesV4(page);
  await completarActividadV4(page, { esPep: false });
  await completarDeclaracionesV4(page, persona, /\/consentimientos$/);
  await completarConsentimientosV4(page);

  // Se firma, y ahí arranca el reloj de los 10 minutos comprimidos (D-32).
  await completarFirmaV4(page, persona);

  // No se genera ningún QR: se deja transcurrir el plazo en la pantalla de pago.
  await expect(page).toHaveURL(/\/pago$/);
  await expect(page.getByText(TEXTOS_05A.tituloPlazo, { exact: true })).toBeVisible();

  // La propia pantalla de pago lleva sola a Pantalla B en cuanto el plazo se
  // cumple: ni bien el contador llega a cero, `POST /api/p7/vencimiento` hace
  // la transición FIRMADO_CLIENTE → VENCIDO.
  await expect(page).toHaveURL(/\/solicitud-vencida$/, { timeout: 60_000 });

  await expect(page.getByText("Tu solicitud venció porque no completaste el pago")).toBeVisible();
  await expect(page.getByText("No existe póliza emitida ni cobertura iniciada.")).toBeVisible();

  // Sin cobro no hay devolución que tramitar, y la pantalla lo dice: el
  // expediente se queda en VENCIDO.
  await expect(page.getByText("No se realizó ningún cobro:", { exact: false })).toBeVisible();
  await expect(page.getByText("Estado final del expediente")).toBeVisible();
  await expect(page.getByText("VENCIDO", { exact: true })).toBeVisible();
  await expect(page.getByText("DEVOLUCIÓN EN TRÁMITE", { exact: false })).toHaveCount(0);
});
