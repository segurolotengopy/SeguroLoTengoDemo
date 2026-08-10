import { test, expect } from "@playwright/test";
import { obtenerPersonaDemo } from "@/adapters/mock/personas";
import { INTENTOS_MAXIMOS_OTP } from "@/domain/reglas-otp";
import { enmascararCelular } from "@/domain/telefono";
import { prepararEscenario, leerCodigoOtpDelPanel } from "./support/demo-panel";
import { celularLocal } from "./support/flujo";

/**
 * Escenario 5 — OTP agotado en P1.
 *
 * Tres intentos fallidos con el mismo código → bloqueo: el código deja de
 * servir y no hay forma de continuar hasta reenviar. Reglas verificadas
 * (CLAUDE.md, regla inviolable #1): 6 dígitos, uso único, vigencia 5
 * minutos, **máximo 3 intentos**, reenvío bloqueado 60 segundos.
 *
 * Con Mónica Mariana Gorena Tapia — cualquier persona sirve para este
 * escenario, ya que la regla de intentos es del motor de OTP, no de la
 * elegibilidad de una persona en particular.
 */
test("tres intentos fallidos de OTP en P1 bloquean el código y exigen reenvío", async ({ page }) => {
  test.setTimeout(120_000); // Incluye una espera real del cooldown de reenvío de 60 s.

  const persona = obtenerPersonaDemo("camino-feliz");
  if (!persona) throw new Error("Fixture 'camino-feliz' no encontrado en personas.ts.");

  await prepararEscenario(page, { personaId: persona.id });

  await page.goto("/p1-whatsapp");
  await page.locator("#p1-destino").fill(celularLocal(persona));
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Enviar código", exact: true }).click();

  const destinoEnmascarado = enmascararCelular(persona.celular);
  await expect(page.getByText(`Código enviado al número ${destinoEnmascarado}`)).toBeVisible();

  // El reenvío arranca bloqueado 60 segundos apenas se envía el primer código.
  await expect(page.getByRole("button", { name: /Reenviar código \(\d+s\)/ })).toBeVisible();

  const codigoValido = await leerCodigoOtpDelPanel(page, persona.celular.slice(-3));

  async function intentarCodigoIncorrecto(): Promise<void> {
    // Un código de 6 dígitos, siempre distinto del válido: no hace falta que
    // "parezca" un típo — lo único que importa es que no coincida con el hash.
    const digitosIncorrectos = codigoValido === "111111" ? "222222" : "111111";
    for (let i = 0; i < digitosIncorrectos.length; i += 1) {
      await page.locator(`#p1-otp-${i}`).fill(digitosIncorrectos[i]);
    }
  }

  // Intento 1 y 2: código incorrecto, rechazado, con intentos que bajan.
  await intentarCodigoIncorrecto();
  await expect(page.getByText("El código no es correcto.")).toBeVisible();
  await expect(page.getByText(`Te quedan ${INTENTOS_MAXIMOS_OTP - 1} de ${INTENTOS_MAXIMOS_OTP} intentos`)).toBeVisible();

  await intentarCodigoIncorrecto();
  await expect(page.getByText("El código no es correcto.")).toBeVisible();
  await expect(page.getByText(`Te quedan ${INTENTOS_MAXIMOS_OTP - 2} de ${INTENTOS_MAXIMOS_OTP} intentos`)).toBeVisible();

  // Intento 3: consume el último intento. El servidor todavía lo evalúa como
  // un intento normal (`CODIGO_INCORRECTO`, `intentosRestantes: 0`) — recién
  // el PRÓXIMO intento, con 0 ya en el contador, devuelve `INTENTOS_AGOTADOS`.
  // Verificado contra la respuesta real de `POST /api/p1/otp/verificar`.
  await intentarCodigoIncorrecto();
  await expect(page.getByText("El código no es correcto.")).toBeVisible();
  await expect(page.getByText(`Te quedan 0 de ${INTENTOS_MAXIMOS_OTP} intentos`)).toBeVisible();

  // No hay forma de continuar todavía: el botón de avanzar sigue deshabilitado.
  const continuar = page.getByRole("link", { name: "Continuar →" });
  await expect(continuar).toHaveAttribute("aria-disabled", "true");

  // Intento extra, ya sin intentos disponibles: acá el código se bloquea de
  // verdad — ni siquiera el código *correcto* sirve (uso único / intentos
  // agotados son del código, no de si la persona "acertó a tiempo").
  for (let i = 0; i < codigoValido.length; i += 1) {
    await page.locator(`#p1-otp-${i}`).fill(codigoValido[i]);
  }
  await expect(page.getByText("Se agotaron los intentos de este código. Pedí uno nuevo.")).toBeVisible();
  await expect(continuar).toHaveAttribute("aria-disabled", "true");

  // El único camino que queda es reenviar: mientras dura el cooldown de 60 s,
  // "Reenviar código" sigue deshabilitado.
  const reenviar = page.getByRole("button", { name: /Reenviar código/ });
  await expect(reenviar).toBeDisabled();

  // Pasado el cooldown, el reenvío se habilita y un código nuevo desbloquea
  // el paso: es la prueba positiva de "sin permitir continuar hasta el
  // reenvío habilitado" del enunciado, no solo la mitad negativa.
  await expect(page.getByRole("button", { name: "Reenviar código" })).toBeEnabled({ timeout: 65_000 });
  await page.getByRole("button", { name: "Reenviar código" }).click();
  await expect(page.getByText("Te enviamos un código nuevo. El anterior dejó de servir.")).toBeVisible();

  const codigoNuevo = await leerCodigoOtpDelPanel(page, persona.celular.slice(-3));
  expect(codigoNuevo).not.toBe(codigoValido);

  for (let i = 0; i < codigoNuevo.length; i += 1) {
    await page.locator(`#p1-otp-${i}`).fill(codigoNuevo[i]);
  }
  await expect(continuar).not.toHaveAttribute("aria-disabled", "true");
});
