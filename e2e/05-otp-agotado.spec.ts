import { test, expect } from "@playwright/test";
import { obtenerPersonaDemo } from "@/adapters/mock/personas";
import { INTENTOS_MAXIMOS_OTP } from "@/domain/reglas-otp";
import { enmascararCelular } from "@/domain/telefono";
import { prepararEscenario, leerCodigoOtpDelPanel } from "./support/demo-panel";
import { completarPlan, celularLocal, esperarHidratacion } from "./support/flujo";

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

  // El expediente nace al elegir plan (CHG-01), así que este escenario ya no
  // puede entrar directo a la verificación del canal: sin plan no hay trámite
  // al que asociarle el código.
  await completarPlan(page, persona);
  await esperarHidratacion(page);
  // Formato maqueta: sin casilla — el acto de autorizar es el botón de enviar.
  await page.locator("#p1-destino").fill(celularLocal(persona));
  await page.getByRole("button", { name: "ENVIAR CÓDIGO POR WHATSAPP" }).click();

  const destinoEnmascarado = enmascararCelular(persona.celular);
  await expect(page.getByText(`Código enviado por WhatsApp a ${destinoEnmascarado}`)).toBeVisible();

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
    // Completar las seis casillas ya no verifica nada: hay que presionar.
    await page.getByRole("button", { name: "VERIFICAR WHATSAPP Y CONTINUAR" }).click();
  }

  // Intento 1 y 2: código incorrecto, rechazado, con el chip de intentos
  // subiendo (formato maqueta: `Intentos N/3`).
  await intentarCodigoIncorrecto();
  await expect(page.getByText("El código no coincide. Revisalo e intentá de nuevo.")).toBeVisible();
  await expect(page.getByText(`Intentos 2/${INTENTOS_MAXIMOS_OTP}`)).toBeVisible();

  await intentarCodigoIncorrecto();
  await expect(page.getByText("El código no coincide. Revisalo e intentá de nuevo.")).toBeVisible();
  await expect(page.getByText(`Intentos 3/${INTENTOS_MAXIMOS_OTP}`)).toBeVisible();

  // Intento 3: consume el último intento. El servidor todavía lo evalúa como
  // un intento normal (`CODIGO_INCORRECTO`, `intentosRestantes: 0`) — recién
  // el PRÓXIMO intento, con 0 ya en el contador, devuelve `INTENTOS_AGOTADOS`.
  // Verificado contra la respuesta real de `POST /api/p1/otp/verificar`.
  await intentarCodigoIncorrecto();
  await expect(page.getByText("El código no coincide. Revisalo e intentá de nuevo.")).toBeVisible();

  // No hay forma de continuar: la pantalla solo avanza con el código
  // verificado, y seguimos en el paso 2.
  await expect(page).toHaveURL(/\/whatsapp$/);

  // Intento extra, ya sin intentos disponibles: acá el código se bloquea de
  // verdad — ni siquiera el código *correcto* sirve (uso único / intentos
  // agotados son del código, no de si la persona "acertó a tiempo").
  for (let i = 0; i < codigoValido.length; i += 1) {
    await page.locator(`#p1-otp-${i}`).fill(codigoValido[i]);
  }
  await page.getByRole("button", { name: "VERIFICAR WHATSAPP Y CONTINUAR" }).click();
  await expect(
    page.getByText("Se agotaron los tres intentos. Pedí un código nuevo con «Reenviar código»."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/whatsapp$/);

  // El único camino que queda es reenviar: mientras dura el cooldown de 60 s,
  // "Reenviar código" sigue deshabilitado.
  const reenviar = page.getByRole("button", { name: /Reenviar código/ });
  await expect(reenviar).toBeDisabled();

  // Pasado el cooldown, el reenvío se habilita y un código nuevo desbloquea
  // el paso: es la prueba positiva de "sin permitir continuar hasta el
  // reenvío habilitado" del enunciado, no solo la mitad negativa.
  await expect(page.getByRole("button", { name: "Reenviar código" })).toBeEnabled({ timeout: 65_000 });
  await page.getByRole("button", { name: "Reenviar código" }).click();
  // El chip de intentos vuelve a arrancar con el código nuevo.
  await expect(page.getByText(`Intentos 1/${INTENTOS_MAXIMOS_OTP}`)).toBeVisible();

  const codigoNuevo = await leerCodigoOtpDelPanel(page, persona.celular.slice(-3));
  expect(codigoNuevo).not.toBe(codigoValido);

  // El código nuevo desbloquea el paso: verificar navega a la preparación.
  for (let i = 0; i < codigoNuevo.length; i += 1) {
    await page.locator(`#p1-otp-${i}`).fill(codigoNuevo[i]);
  }
  await page.getByRole("button", { name: "VERIFICAR WHATSAPP Y CONTINUAR" }).click();
  await expect(page).toHaveURL(/\/preparacion$/);
});
