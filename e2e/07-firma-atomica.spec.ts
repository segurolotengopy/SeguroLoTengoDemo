import { test, expect } from "@playwright/test";
import { obtenerPersonaDemo } from "@/adapters/mock/personas";
import { accionarFirmaPanel, leerSesionFirmaDelPanel, prepararEscenario } from "./support/demo-panel";
import {
  completarWhatsapp,
  completarPlan,
  completarPreparacion,
  declararCorreo,
  completarP5Aprobado,
  completarP6,
  completarP7Qr,
  continuarAFirma,
  enviarEnlaceYAbrir,
  enviarP6,
  firmarNormalmente,
} from "./support/flujo";

/**
 * Escenario 7 — Regla atómica de firma (regla inviolable #3).
 *
 * Se fuerza un fallo a mitad del proceso de firma en P8 (el botón "Firmar
 * con falla a mitad" del panel, que corta el sellado entre la Solicitud y el
 * FIPF). La aserción central: **ninguno de los dos documentos queda
 * firmado**, no que la pantalla haya mostrado un error.
 *
 * Con Mónica Mariana Gorena Tapia, hasta llegar a P8 con la garantía de pago
 * lista.
 */
test("un fallo a mitad de la firma no deja ningún documento firmado", async ({ page }) => {
  const persona = obtenerPersonaDemo("camino-feliz");
  if (!persona) throw new Error("Fixture 'camino-feliz' no encontrado en personas.ts.");

  await prepararEscenario(page, { personaId: persona.id });

  await completarPlan(page, persona);
  await completarWhatsapp(page, persona);
  await completarPreparacion(page);
  await declararCorreo(page, persona);
  await completarP5Aprobado(page);
  await completarP6(page, persona);
  await enviarP6(page, /\/pago$/);
  await completarP7Qr(page);
  await continuarAFirma(page);

  const idCode100 = await enviarEnlaceYAbrir(page);

  // Antes de firmar: las dos huellas están sin firmar.
  const antes = await leerSesionFirmaDelPanel(page, idCode100);
  expect(antes.hashSolicitudFirmada).toBeNull();
  expect(antes.hashFipfFirmado).toBeNull();
  expect(antes.codigo, "Code100 tiene que haber emitido el tercer OTP al abrir el enlace.").not.toBeNull();

  // Firma con falla forzada a mitad del sellado (misma API que usa el botón
  // "Firmar con falla a mitad" del panel: código correcto, pero
  // `fallarAMitad: true` corta la escritura entre las dos huellas).
  const resultadoFallido = await accionarFirmaPanel(page, idCode100, {
    accion: "FIRMAR",
    codigo: antes.codigo as string,
    fallarAMitad: true,
  });
  expect(resultadoFallido.ok, "la llamada con falla forzada tiene que fallar").toBeFalsy();

  // La aserción central: NINGUNO de los dos documentos quedó firmado. No
  // "uno sí y el otro no" — regla inviolable #3, sin estado intermedio.
  const despues = await leerSesionFirmaDelPanel(page, idCode100);
  expect(despues.hashSolicitudFirmada, "la Solicitud no debe quedar firmada tras el fallo a mitad").toBeNull();
  expect(despues.hashFipfFirmado, "el FIPF no debe quedar firmado tras el fallo a mitad").toBeNull();

  // El expediente sigue en P8 — nunca llegó a P9 con una firma a medias.
  await expect(page).toHaveURL(/\/firma$/);
  const resumenP9 = await page.request.get("/api/p9/resumen");
  expect(resumenP9.status()).toBe(409);

  // La falla a mitad NO cierra el acto: como no se escribió nada, la sesión
  // queda abierta y la persona puede reintentar el mismo acto. Es la semántica
  // que documenta y prueba el unitario de dominio ("después de la falla,
  // completar el acto firma los dos y recién ahí avanza", firma-p8.test.ts) —
  // distinta del rechazo de Code100, que sí cierra la sesión.
  await firmarNormalmente(page, idCode100);

  const sesionFinal = await leerSesionFirmaDelPanel(page, idCode100);
  expect(sesionFinal.hashSolicitudFirmada).not.toBeNull();
  expect(sesionFinal.hashFipfFirmado).not.toBeNull();
});
