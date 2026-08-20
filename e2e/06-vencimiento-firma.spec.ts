import { test, expect } from "@playwright/test";
import { obtenerPersonaDemo } from "@/adapters/mock/personas";
import { prepararEscenario } from "./support/demo-panel";
import {
  completarWhatsapp,
  completarPlan,
  completarPreparacion,
  declararCorreo,
  completarP5Aprobado,
  completarP6,
  enviarEnlaceYAbrir,
  enviarP6,
  firmarNormalmente,
} from "./support/flujo";

/**
 * Escenario 6 — Caducidad del expediente firmado sin pagar (D-10).
 *
 * **La inversión de firma y pago (D-08) dio vuelta este escenario.** Antes se
 * pagaba, no se firmaba y había que devolver el premio; ahora se firma, no se
 * paga, y el expediente caduca sin que se haya movido un guaraní. Es
 * exactamente lo que buscaba la inversión: vencer dejó de costar plata.
 *
 * El plazo se fija **antes** de firmar, con la palanca más corta que ofrece el
 * panel y que sigue dejando margen para completar la firma sin flakiness (30
 * segundos, no el piso de 5): el reloj arranca al aplicarse las firmas
 * institucionales.
 *
 * Con Lucía Fernanda Ortiz Meza (C.I. 6.155.740) — la persona de prueba
 * pensada para este desenlace.
 *
 * El pie tiene que declarar el estado final como `VENCIDO`, sin trámite de
 * devolución: no hubo cobro que devolver.
 */
test("expediente firmado sin pagar dentro del plazo dispara Pantalla B", async ({ page }) => {
  test.setTimeout(150_000);

  const persona = obtenerPersonaDemo("no-firma");
  if (!persona) throw new Error("Fixture 'no-firma' no encontrado en personas.ts.");

  await prepararEscenario(page, { personaId: persona.id, plazoPagoMs: 30_000 });

  await completarPlan(page, persona);
  await completarWhatsapp(page, persona);
  await completarPreparacion(page);
  await declararCorreo(page, persona);
  await completarP5Aprobado(page);
  await completarP6(page, persona);
  await enviarP6(page, /\/firma$/);

  // Se firma, y ahí arranca el reloj de las 24 horas comprimidas.
  const idCode100 = await enviarEnlaceYAbrir(page);
  await firmarNormalmente(page, idCode100);

  // No se genera ningún QR: se deja transcurrir el plazo en la pantalla de pago.
  await expect(page).toHaveURL(/\/pago$/);
  await expect(page.getByText("Tiempo restante para pagar")).toBeVisible();

  // La propia pantalla de pago lleva sola a Pantalla B en cuanto el plazo se
  // cumple: ni bien el contador llega a cero, `POST /api/p7/vencimiento` hace
  // la transición FIRMADO → VENCIDO.
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
