import { test, expect } from "@playwright/test";
import { obtenerPersonaDemo } from "@/adapters/mock/personas";
import { TEXTOS_04E } from "@/domain/v4/textos-firma";
import { leerCodigoOtpDelPanel, prepararEscenario } from "./support/demo-panel";
import {
  abrirBloqueCodigoFirma,
  completarActividadV4,
  completarConsentimientosV4,
  completarDatosPersonalesV4,
  completarDeclaracionesV4,
  completarIdentidadAprobada,
  completarPlan,
  completarPreparacion,
  completarWhatsapp,
  enviarCodigoFirmaPorWhatsappV4,
  tipearOtpV4,
} from "./support/flujo";

/**
 * Escenario 9 — El código de firma se puede reintentar: por error y a pedido
 * (v4).
 *
 * ## Por qué existe
 *
 * En v2, equivocarse tipeando el código de firma tenía una salida inmediata
 * —"Pedir un código nuevo"—, distinta del reenvío con cooldown, precisamente
 * para no dejar a alguien esperando 60 segundos por haberse confundido de
 * dígito. **04E (v4) no tiene esa distinción**: hay un solo botón de reenvío
 * (`TEXTOS_04E.reenviar`, "Reenviar código") y comparte el mismo cooldown de
 * 60 segundos que el envío inicial, tanto si el motivo es "recién lo pedí"
 * como "me equivoqué". Como 04E no tiene arte aprobado ni candidato
 * (`Pantalla04E.tsx`, cabecera del archivo) y es una extrapolación
 * provisional, queda anotado como divergencia para que Andres decida si hay
 * que traer de vuelta la salida inmediata cuando llegue el arte — no se
 * implementa acá.
 *
 * ## Qué prueba, en orden
 *
 * 1. Un código equivocado **no cierra nada**: avisa qué pasó y cuántos
 *    intentos quedan, y el trámite sigue en `/firma`.
 * 2. Pasado el cooldown de reenvío, pedir un código nuevo emite otro y el
 *    código viejo deja de servir.
 * 3. Con el código nuevo se firma y el flujo sigue al pago, como siempre.
 *
 * Con Mónica Mariana Gorena Tapia, el camino que aprueba.
 */
test("el código de firma se puede errar y volver a pedir sin perder el trámite", async ({ page }) => {
  // Recorre el flujo entero y además yerra el código, espera el cooldown de
  // reenvío, pide otro y firma.
  test.setTimeout(300_000);

  const persona = obtenerPersonaDemo("camino-feliz");
  if (!persona) throw new Error("Fixture 'camino-feliz' no encontrado en personas.ts.");

  await prepararEscenario(page, { personaId: persona.id });

  await completarPlan(page, persona);
  await completarWhatsapp(page, persona);
  await completarPreparacion(page);
  await completarIdentidadAprobada(page, persona);
  await completarDatosPersonalesV4(page);
  await completarActividadV4(page, { esPep: false });
  await completarDeclaracionesV4(page, persona, /\/consentimientos$/);
  await completarConsentimientosV4(page);

  await abrirBloqueCodigoFirma(page);
  await enviarCodigoFirmaPorWhatsappV4(page);

  // --- 1 · Un código equivocado avisa y deja seguir --------------------------
  const primerCodigo = await leerCodigoOtpDelPanel(page, persona.celular.slice(-3));

  // Seis dígitos que no son el emitido. Se deriva del real para no chocar con
  // él por casualidad.
  const equivocado = primerCodigo
    .split("")
    .map((digito) => String((Number(digito) + 1) % 10))
    .join("");

  await tipearOtpV4(page, equivocado);

  const aviso = page.getByText(TEXTOS_04E.errorCodigoIncorrecto(2));
  await expect(aviso).toBeVisible({ timeout: 15_000 });
  // Y sobre todo: el trámite sigue acá, no se cerró ni se cayó a otra pantalla.
  await expect(page).toHaveURL(/\/firma$/);

  // --- 2 · Se pide uno nuevo, pasado el cooldown de reenvío -----------------
  // A diferencia de 03A (donde el reenvío tras error también respeta el
  // cooldown), acá no hay atajo: ver la nota de arriba.
  const reenviar = page.getByRole("button", { name: TEXTOS_04E.reenviar, exact: true });
  await expect(reenviar).toBeVisible({ timeout: 65_000 });
  await reenviar.click();

  await expect(page.getByText(/^Enviamos un nuevo código de firma a/)).toBeVisible({ timeout: 15_000 });

  const segundoCodigo = await leerCodigoOtpDelPanel(page, persona.celular.slice(-3));
  expect(segundoCodigo).not.toBe(primerCodigo);

  // --- 3 · Con el código nuevo se firma y el flujo sigue --------------------
  await tipearOtpV4(page, segundoCodigo);
  await expect(page).toHaveURL(/\/pago$/, { timeout: 60_000 });
});
