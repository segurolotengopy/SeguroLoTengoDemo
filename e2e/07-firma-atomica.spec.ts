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
  esperarHidratacion,
} from "./support/flujo";

/**
 * Escenario 7 — El sellado a medias, después de D-11 y de la enmienda del
 * 04-sep-2026 a D-08 (D-38, D-42), reescrito sobre el flujo v4.
 *
 * **Este escenario cambió de objeto dos veces incluso antes de v4.** Primero
 * probaba la regla inviolable #3 cortando el sellado entre la Solicitud y el
 * FIPF: con el PDF unificado esa falla dejó de existir. Después probaba que,
 * sin las institucionales, el expediente quedara en `FIRMADO_CLIENTE`
 * **antes** del pago — eso también dejó de ser cierto: desde la enmienda del
 * 04-sep, `FIRMADO_CLIENTE` ya habilita el cobro sin esperar a Interseguros.
 *
 * Lo que sí puede quedar a medias, y es donde ahora vive el riesgo, es el
 * tramo **después del pago**: el expediente cobró, pero la firma institucional
 * diferida de Interseguros no se aplicó (D-38). El expediente queda en
 * `PAGO_CONFIRMADO`, sin `firmasInstitucionales`, y la emisión no se ordena
 * — `emitirPolizaP9` devuelve `FIRMA_CORREDOR_PENDIENTE` (202, no es un
 * error).
 *
 * **04E ya no abre un modal de Code100**: la firma del cliente es interna
 * (OTP por WhatsApp, D1), así que no hay `idCode100` ni sesión de firma que
 * leer del panel. La prueba de que "la firma del cliente no se tocó" pasa
 * acá por `GET /api/p8/resumen`, que sigue respondiendo con el mismo
 * documento y la misma huella mientras el expediente exista (`EMITIDO`
 * incluido) — nunca por el modal simulado, que era exclusivo de Code100.
 *
 * **`Pantalla05A` navega sola a `/confirmacion` 900 ms después de acreditarse
 * el pago** (a diferencia de v2/v3, que esperaban un clic en "Ver la
 * confirmación →"). Si se dejara correr esa navegación, el propio montaje de
 * `Pantalla05B` consumiría la palanca con su `fetch` a `/api/p9/resumen`
 * antes de que el test pudiera observar el 202 — la misma razón por la que
 * la versión anterior de este escenario evitaba `/confirmacion`. Acá se
 * corta la navegación automática con un `goto("about:blank")` apenas se ve
 * "Pago acreditado", se prueba la API a mano, y recién después se entra a
 * `/confirmacion` por la ruta explícita.
 *
 * Con Mónica Mariana Gorena Tapia.
 */
test("si la firma institucional diferida falla, la emisión no se ordena", async ({ page }) => {
  test.setTimeout(180_000);

  const persona = obtenerPersonaDemo("camino-feliz");
  if (!persona) throw new Error("Fixture 'camino-feliz' no encontrado en personas.ts.");

  await prepararEscenario(page, {
    personaId: persona.id,
    fallas: ["FIRMAS_INSTITUCIONALES_FALLAN"],
  });

  await completarPlan(page, persona);
  await completarWhatsapp(page, persona);
  await completarPreparacion(page);
  await completarIdentidadAprobada(page, persona);
  await completarDatosPersonalesV4(page);
  await completarActividadV4(page, { esPep: false });
  await completarDeclaracionesV4(page, persona, /\/consentimientos$/);
  await completarConsentimientosV4(page);

  // D-08 enmendada / D-38 · con la institucional diferida, el cliente firma
  // solo y ya alcanza para pasar al pago: la palanca armada más arriba
  // todavía no tuvo ninguna oportunidad de actuar.
  await completarFirmaV4(page, persona);

  const hashAntes = await leerHashDocumentoFirmado(page);
  expect(hashAntes).toMatch(/^[0-9a-f]{64}$/);

  // --- Pago, deteniéndose apenas se acredita -------------------------------
  await expect(page).toHaveURL(/\/pago$/);
  await esperarHidratacion(page);
  await page.getByRole("radio", { name: "Elegir QR Bancard", exact: true }).click();
  await page.locator("#acepta-certificado").check();
  await page.getByRole("button", { name: "GENERAR QR BANCARD", exact: true }).click();
  await expect(page.getByText(TEXTOS_05A.qrTitulo)).toBeVisible();

  const pagado = page.getByRole("button", { name: TEXTOS_05A.botonPagadoDemo, exact: true });
  await expect(pagado).toBeEnabled({ timeout: 15_000 });
  await pagado.click();
  await expect(page.getByText(TEXTOS_05A.pagoAcreditadoTitulo, { exact: true })).toBeVisible({
    timeout: 15_000,
  });

  // Corta la navegación automática a `/confirmacion` (900 ms) antes de que
  // dispare: navegar a otro lado cancela los temporizadores de la página.
  await page.goto("about:blank");

  // La palanca actúa acá, dentro de `emitirPolizaP9` (`emision-p9.ts`), cuando
  // P9 intenta aplicar la diferida antes de remitir a Alianza.
  const resumenFallido = await page.request.get("/api/p9/resumen");
  expect(resumenFallido.status(), "P9 no puede emitir sin la institucional diferida").toBe(202);
  const datosFallidos = (await resumenFallido.json()) as { ok?: boolean; motivo?: string };
  expect(datosFallidos.ok).toBe(false);
  expect(datosFallidos.motivo).toBe("FIRMA_CORREDOR_PENDIENTE");

  // La firma del cliente no se tocó: sigue siendo la misma de siempre.
  const hashDespues = await leerHashDocumentoFirmado(page);
  expect(hashDespues).toBe(hashAntes);

  // La falla se consume en un solo intento (regla de las palancas del panel):
  // el llamado anterior ya la gastó, así que esta vez la diferida se aplica y
  // la emisión sigue su curso. Se entra por la pantalla, como haría la persona.
  await page.goto("/confirmacion");
  await expect(page.getByText("Pago acreditado por Bancard.")).toBeVisible({ timeout: 30_000 });
});

/** La huella del documento cerrado, según `GET /api/p8/resumen`. */
async function leerHashDocumentoFirmado(page: import("@playwright/test").Page): Promise<string> {
  const respuesta = await page.request.get("/api/p8/resumen");
  expect(respuesta.ok(), "GET /api/p8/resumen debería seguir respondiendo").toBeTruthy();
  const datos = (await respuesta.json()) as {
    ok?: boolean;
    resumen?: { documento?: { hashSha256?: string } };
  };
  expect(datos.ok).toBe(true);
  const hash = datos.resumen?.documento?.hashSha256;
  expect(hash, "sin huella del documento en /api/p8/resumen").toBeTruthy();
  return hash as string;
}
