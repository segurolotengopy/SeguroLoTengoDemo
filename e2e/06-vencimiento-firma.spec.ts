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
  completarP7Qr,
  continuarAFirma,
  enviarP6,
} from "./support/flujo";

/**
 * Escenario 6 — Vencimiento de firma.
 *
 * Pago confirmado en P7 pero sin firma completada dentro del plazo → dispara
 * Pantalla B (`/solicitud-vencida`) con el procedimiento de devolución. El
 * plazo se fija **antes** de pagar el QR (docs/ESPECIFICACION_DEMO.md,
 * §5: "el vencimiento se congela al confirmarse el pago"), con la palanca
 * más corta que ofrece el panel que sigue dejando margen para completar P7
 * sin flakiness (30 segundos, no el piso de 5).
 *
 * Con Lucía Fernanda Ortiz Meza (C.I. 6.155.740) — la persona de prueba
 * pensada justamente para este desenlace ("paga y no firma").
 *
 * El pie tiene que declarar el estado final como
 * `VENCIDO · DEVOLUCIÓN EN TRÁMITE / DEVUELTO`.
 */
test("pago confirmado sin firma dentro del plazo dispara Pantalla B", async ({ page }) => {
  test.setTimeout(150_000);

  const persona = obtenerPersonaDemo("no-firma");
  if (!persona) throw new Error("Fixture 'no-firma' no encontrado en personas.ts.");

  await prepararEscenario(page, { personaId: persona.id, plazoFirmaMs: 30_000 });

  await completarPlan(page, persona);
  await completarWhatsapp(page, persona);
  await completarPreparacion(page);
  await declararCorreo(page, persona);
  await completarP5Aprobado(page);
  await completarP6(page, persona);
  await enviarP6(page, /\/pago$/);
  await completarP7Qr(page);
  await continuarAFirma(page);

  // No se envía ningún enlace de firma: se deja transcurrir el plazo.
  await expect(page).toHaveURL(/\/firma$/);
  await expect(page.getByText("Tiempo restante para firmar")).toBeVisible();

  // El propio P8 lleva sola a Pantalla B en cuanto el plazo se cumple: ni
  // bien el contador de la pantalla llega a cero, `POST /api/p8/vencimiento`
  // hace la transición PAGO_CONFIRMADO/PAQUETE_GENERADO → VENCIDO.
  await expect(page).toHaveURL(/\/solicitud-vencida$/, { timeout: 60_000 });

  await expect(page.getByText("Tu solicitud venció porque no completaste la firma")).toBeVisible();
  await expect(page.getByText("No existe póliza emitida ni cobertura iniciada.")).toBeVisible();

  // El pie declara el estado final: VENCIDO · DEVOLUCIÓN EN TRÁMITE (el
  // trámite ya se abrió automáticamente al entrar a la pantalla).
  await expect(page.getByText("Estado final del expediente")).toBeVisible();
  await expect(page.getByText("VENCIDO · DEVOLUCIÓN EN TRÁMITE")).toBeVisible();

  // No se devuelve en efectivo, a terceros ni a otra cuenta.
  await expect(page.getByText("No se devuelve en efectivo, a terceros ni a otra cuenta.")).toBeVisible();
});
