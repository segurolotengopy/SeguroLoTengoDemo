import { test, expect } from "@playwright/test";
import { obtenerPersonaDemo } from "@/adapters/mock/personas";
import { INTENTOS_MAXIMOS_OTP } from "@/domain/reglas-otp";
import { enmascararCelular } from "@/domain/telefono";
import { TEXTOS_03A } from "@/domain/v4/textos-verificacion";
import { leerCodigoOtpDelPanel, prepararEscenario } from "./support/demo-panel";
import { celularLocal, completarPlan, esperarHidratacion, tipearOtpV4 } from "./support/flujo";

/**
 * Escenario 5 — OTP agotado en 03A (v4).
 *
 * Tres intentos fallidos con el mismo código → bloqueo: el código deja de
 * servir y no hay forma de continuar hasta reenviar. Reglas verificadas
 * (CLAUDE.md, regla inviolable #1): 6 dígitos, uso único, vigencia 5 minutos,
 * **máximo 3 intentos**, reenvío bloqueado 60 segundos.
 *
 * `CamposOtpV4` verifica sola al completar el sexto dígito (`alCompletar`):
 * no hay un botón de "verificar" que presionar aparte de tipear el código.
 * Al agotarse los intentos las seis casillas quedan **deshabilitadas** (no
 * solo "el código no sirve"): es la pantalla la que impide seguir tipeando,
 * no solo el servidor el que rechaza.
 *
 * Con Mónica Mariana Gorena Tapia — cualquier persona sirve para este
 * escenario, ya que la regla de intentos es del motor de OTP, no de la
 * elegibilidad de una persona en particular.
 */
test("tres intentos fallidos de OTP en 03A bloquean el código y exigen reenvío", async ({ page }) => {
  test.setTimeout(120_000); // Incluye una espera real del cooldown de reenvío de 60 s.

  const persona = obtenerPersonaDemo("camino-feliz");
  if (!persona) throw new Error("Fixture 'camino-feliz' no encontrado en personas.ts.");

  await prepararEscenario(page, { personaId: persona.id });

  // El expediente nace al elegir plan, así que este escenario ya no puede
  // entrar directo a la verificación del canal: sin plan no hay trámite al
  // que asociarle el código.
  await completarPlan(page, persona);
  await esperarHidratacion(page);

  await page.locator("#numero-whatsapp").fill(celularLocal(persona));
  await page.locator("#autorizacion-whatsapp").check();
  await page.getByRole("button", { name: TEXTOS_03A.botonEnviar, exact: true }).click();

  const destinoEnmascarado = enmascararCelular(persona.celular);
  await expect(page.getByText(TEXTOS_03A.codigoEnviado(destinoEnmascarado))).toBeVisible();

  const codigoValido = await leerCodigoOtpDelPanel(page, persona.celular.slice(-3));

  async function intentarCodigo(codigo: string): Promise<void> {
    await tipearOtpV4(page, codigo);
  }

  function digitosDistintosDe(codigo: string): string {
    return codigo === "111111" ? "222222" : "111111";
  }

  // Intento 1 y 2: código incorrecto, rechazado, con el mensaje bajando la
  // cuenta de intentos restantes.
  await intentarCodigo(digitosDistintosDe(codigoValido));
  await expect(page.getByText(TEXTOS_03A.errorCodigoIncorrecto(2))).toBeVisible();

  await intentarCodigo(digitosDistintosDe(codigoValido));
  await expect(page.getByText(TEXTOS_03A.errorCodigoIncorrecto(1))).toBeVisible();

  // Intento 3: consume el último intento. El servidor todavía lo evalúa como
  // un intento normal (`CODIGO_INCORRECTO`, `intentosRestantes: 0`) — recién
  // el PRÓXIMO intento devuelve `INTENTOS_AGOTADOS`.
  await intentarCodigo(digitosDistintosDe(codigoValido));
  await expect(page.getByText(TEXTOS_03A.errorCodigoIncorrecto(0))).toBeVisible();

  // No hay forma de continuar: seguimos en la verificación de WhatsApp.
  await expect(page).toHaveURL(/\/whatsapp$/);

  // Intento extra, ya sin intentos disponibles: acá el código se bloquea de
  // verdad — ni siquiera el código *correcto* sirve (uso único / intentos
  // agotados son del código, no de si la persona "acertó a tiempo").
  await intentarCodigo(codigoValido);
  await expect(page.getByText(TEXTOS_03A.errorIntentosAgotados)).toBeVisible();
  await expect(page).toHaveURL(/\/whatsapp$/);

  // Las seis casillas quedan deshabilitadas: no hay forma de seguir tipeando
  // con un código invalidado.
  await expect(page.getByLabel("Dígito 1 de 6")).toBeDisabled();

  // El único camino que queda es reenviar: mientras dura el cooldown de 60 s,
  // no hay ningún botón de reenvío — solo la cuenta regresiva.
  await expect(page.getByRole("button", { name: TEXTOS_03A.reenviar, exact: true })).toHaveCount(0);

  // Pasado el cooldown, el reenvío se habilita y un código nuevo desbloquea
  // el paso: es la prueba positiva de "sin permitir continuar hasta el
  // reenvío habilitado" del enunciado, no solo la mitad negativa.
  const reenviar = page.getByRole("button", { name: TEXTOS_03A.reenviar, exact: true });
  await expect(reenviar).toBeVisible({ timeout: 65_000 });
  await reenviar.click();

  await expect(
    page.getByText(TEXTOS_03A.codigoReenviado(destinoEnmascarado)),
  ).toBeVisible();

  const codigoNuevo = await leerCodigoOtpDelPanel(page, persona.celular.slice(-3));
  expect(codigoNuevo).not.toBe(codigoValido);
  expect(codigoNuevo, `deben haberse emitido ${INTENTOS_MAXIMOS_OTP} intentos como máximo por código`).toMatch(
    /^\d{6}$/,
  );

  // El código nuevo desbloquea el paso: verificar navega a la preparación.
  await tipearOtpV4(page, codigoNuevo);
  await expect(page).toHaveURL(/\/preparacion$/, { timeout: 30_000 });
});
