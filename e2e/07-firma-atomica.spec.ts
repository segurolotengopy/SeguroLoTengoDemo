import { test, expect } from "@playwright/test";
import { obtenerPersonaDemo } from "@/adapters/mock/personas";
import { leerSesionFirmaDelPanel, prepararEscenario } from "./support/demo-panel";
import {
  completarWhatsapp,
  completarPlan,
  completarPreparacion,
  declararCorreo,
  completarP5Aprobado,
  completarP6,
  completarP7Qr,
  enviarEnlaceYAbrir,
  enviarP6,
  firmarNormalmente,
} from "./support/flujo";

/**
 * Escenario 7 — El sellado a medias, después de D-11 y de la enmienda del
 * 04-sep-2026 a D-08 (D-38, D-42).
 *
 * **Este escenario cambió de objeto dos veces.** Primero probaba la regla
 * inviolable #3 cortando el sellado entre la Solicitud y el FIPF: con el PDF
 * unificado esa falla dejó de existir. Después probaba que, sin las
 * institucionales, el expediente quedara en `FIRMADO_CLIENTE` **antes** del
 * pago — eso también dejó de ser cierto: desde la enmienda del 04-sep,
 * `FIRMADO_CLIENTE` ya habilita el cobro sin esperar a Interseguros.
 *
 * Lo que sí puede quedar a medias, y es donde ahora vive el riesgo, es el
 * tramo **después del pago**: el expediente cobró, pero la firma institucional
 * diferida de Interseguros no se aplicó (D-38). El expediente queda en
 * `PAGO_CONFIRMADO`, sin `firmasInstitucionales`, y la emisión no se ordena
 * — `emitirPolizaP9` devuelve `FIRMA_CORREDOR_PENDIENTE` (202, no es un
 * error). Es la diferencia entre un cobro sin institucional y un expediente
 * sin firmar, que es exactamente lo que D-38/D-42 piden poder distinguir.
 *
 * Con Mónica Mariana Gorena Tapia.
 */
test("si la firma institucional diferida falla, la emisión no se ordena", async ({ page }) => {
  const persona = obtenerPersonaDemo("camino-feliz");
  if (!persona) throw new Error("Fixture 'camino-feliz' no encontrado en personas.ts.");

  await prepararEscenario(page, {
    personaId: persona.id,
    fallas: ["FIRMAS_INSTITUCIONALES_FALLAN"],
  });

  await completarPlan(page, persona);
  await completarWhatsapp(page, persona);
  await completarPreparacion(page);
  await declararCorreo(page, persona);
  await completarP5Aprobado(page);
  await completarP6(page, persona);
  // D-08 · se firma en el paso 6, antes de que exista ninguna operación de pago.
  await enviarP6(page, /\/firma$/);

  const idCode100 = await enviarEnlaceYAbrir(page);
  // Con la institucional diferida (D-38), el cliente firma solo y ya alcanza
  // para pasar al pago: la palanca armada más arriba todavía no tuvo ninguna
  // oportunidad de actuar.
  await firmarNormalmente(page, idCode100);
  await completarP7Qr(page);

  // La palanca actúa recién acá, dentro de `emitirPolizaP9` (`emision-p9.ts`),
  // cuando P9 intenta aplicar la diferida antes de remitir a Alianza. Se
  // comprueba por API y **sin pasar por `/confirmacion`**: esa pantalla monta
  // un único `fetch` a `/api/p9/resumen` al cargar, y si se llegara a esa ruta
  // primero, ese montaje consumiría la palanca (se consume en un solo intento)
  // antes de que el test pudiera observar la falla.
  const resumenFallido = await page.request.get("/api/p9/resumen");
  expect(resumenFallido.status(), "P9 no puede emitir sin la institucional diferida").toBe(202);
  const datosFallidos = (await resumenFallido.json()) as { ok?: boolean; motivo?: string };
  expect(datosFallidos.ok).toBe(false);
  expect(datosFallidos.motivo).toBe("FIRMA_CORREDOR_PENDIENTE");

  // La firma del cliente no se tocó: sigue siendo la misma de siempre.
  const sesionTrasLaFalla = await leerSesionFirmaDelPanel(page, idCode100);
  expect(sesionTrasLaFalla.hashDocumentoFirmado).not.toBeNull();

  // La falla se consume en un solo intento (regla de las palancas del panel):
  // el llamado anterior ya la gastó, así que esta vez la diferida se aplica y
  // la emisión sigue su curso. Se entra por la pantalla, como haría la persona.
  await page.goto("/confirmacion");
  await expect(page.getByText("¡Tu solicitud de seguro fue aceptada!")).toBeVisible({
    timeout: 30_000,
  });
});
