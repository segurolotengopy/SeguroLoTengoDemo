/**
 * Flujo v3 · El camino feliz completo, de los T&C a la confirmación.
 *
 * Es el recorrido que la demo muestra: inscripción (identidad → WhatsApp →
 * aceptación agrupada 1) → seguro (plan → beneficiario → 5 preguntas →
 * aceptación agrupada 2) → pago y firma (aceptación agrupada 3 → **firma
 * interna del cliente** con su código propio → institucionales del mock →
 * pago QR simulado) → confirmación.
 *
 * Reutiliza los helpers de la batería v2 donde son agnósticos de URL
 * (capturas, OTP tipeado, panel de demo) y hace inline lo que en v2 era una
 * pantalla propia.
 */
import { expect, test } from "@playwright/test";
import { obtenerPersonaDemo } from "@/adapters/mock/personas";
import { leerCodigoOtpDelPanel, prepararEscenario } from "../support/demo-panel";
import {
  celularLocal,
  clickearHidratado,
  completarDatosComplementarios,
  esperarHidratacion,
  tipearOtp,
  tomarCapturaP5,
} from "../support/flujo";

test("camino feliz v3: T&C → inscripción → seguro → firma interna → pago → confirmación", async ({
  page,
}) => {
  const persona = obtenerPersonaDemo("camino-feliz");
  if (!persona) throw new Error("Fixture 'camino-feliz' no encontrado en personas.ts.");

  await prepararEscenario(page, { personaId: persona.id });

  // ── El inicio: T&C que crean el expediente (DI-10, página real de F5) ─
  await page.goto("/");
  await esperarHidratacion(page);
  await page.getByRole("checkbox").check();
  await clickearHidratado(page.getByRole("button", { name: /empezar/i }));
  await expect(page).toHaveURL(/\/inscripcion$/);

  // ── Paso 1 · sección identidad (el formulario v2 montado como sección) ─
  await expect(page.getByRole("heading", { name: /empecemos por tu cédula/i })).toBeVisible();
  await tomarCapturaP5(page, "FRENTE");
  await expect(page.getByText("Aprobada", { exact: true })).toHaveCount(1);
  await tomarCapturaP5(page, "DORSO");
  await expect(page.getByText("Aprobada", { exact: true })).toHaveCount(2);
  await tomarCapturaP5(page, "SELFIE");
  await expect(
    page.getByText("Datos extraídos de la cédula y confirmados con la selfie en vivo."),
  ).toBeVisible();

  await page.getByLabel(/Autorizo la captura y comparación/).check();
  await page.locator("#p5-sexo").selectOption("Femenino");
  await page.locator("#p5-pais").selectOption("Paraguay");
  await page.locator("#p5-pais-residencia").selectOption("Paraguay");
  await page.locator("#p5-estado-civil").selectOption("Soltero/a");
  await page.locator("#p5-correo").fill(persona.correo);
  await page.locator("#p5-correo-repetido").fill(persona.correo);
  await completarDatosComplementarios(page);

  const validar = page.getByRole("button", { name: "Validar identidad y continuar →" });
  await expect(validar).toBeEnabled();
  await validar.click();

  // ── Paso 1 · sección canal (gating en cascada, sin cambiar de URL) ────
  await expect(page.getByText(/verificá tu whatsapp personal/i)).toBeVisible();
  await page.locator("#p1-destino").fill(celularLocal(persona));
  await clickearHidratado(page.getByRole("button", { name: "ENVIAR CÓDIGO POR WHATSAPP" }));
  // El panel se lee recién cuando la pantalla confirma el envío: leerlo antes
  // es una carrera contra el POST (lección del helper v2).
  await expect(page.getByText(/Código enviado por WhatsApp a/)).toBeVisible();
  const codigoCanal = await leerCodigoOtpDelPanel(page, persona.celular.slice(-3));
  await tipearOtp(page, "p1", codigoCanal);
  await page.getByRole("button", { name: "VERIFICAR WHATSAPP Y CONTINUAR" }).click();

  // ── Paso 1 · aceptación agrupada 1 → paso 2 ───────────────────────────
  await expect(page.getByText(/aceptá lo necesario para inscribirte/i)).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /continuar al paso 2/i }).click();
  await expect(page).toHaveURL(/\/seguro$/);

  // ── Paso 2 · plan (selector v2 como sección) ──────────────────────────
  await esperarHidratacion(page);
  const tarjeta = page.getByRole("article").nth(1); // CONFÍO+
  await tarjeta.getByRole("radio").click();
  await page.getByRole("button", { name: "CONTINUAR CON EL PLAN SELECCIONADO →" }).click();

  // ── Paso 2 · beneficiario + 5 preguntas + aceptación agrupada 2 ───────
  await expect(page.getByText("✓ Plan elegido: CONFÍO+", { exact: false })).toBeVisible();
  for (const [titulo, respuesta] of [
    ["Estado de salud", "Sí"],
    ["Antecedentes de contratación", "No"],
    ["Enfermedades diagnosticadas", "No"],
    ["Condición PEP", "No"],
    ["Carencias e inicio de vigencia", "Sí"],
  ] as const) {
    await page
      .getByRole("radiogroup", { name: titulo })
      .getByRole("radio", { name: respuesta, exact: true })
      .click();
  }
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /continuar al paso 3/i }).click();
  await expect(page).toHaveURL(/\/pago-y-firma$/);

  // ── Paso 3 · la firma interna del cliente ─────────────────────────────
  await esperarHidratacion(page);
  await expect(page.getByText(/Propuesta de Interseguros \+ FIPF · PROP-/)).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /firmar por WhatsApp/i }).click();
  await expect(page.getByText(/te enviamos el código de firma/i)).toBeVisible();

  // El código de FIRMA es el más reciente para ese destino: el panel lista
  // primero lo último emitido, y el de canal ya se consumió.
  const codigoFirma = await leerCodigoOtpDelPanel(page, persona.celular.slice(-3));
  expect(codigoFirma, "El código de firma no puede ser el del canal ya usado.").not.toBe(
    codigoCanal,
  );
  await tipearOtp(page, "firma-v3", codigoFirma);
  await page.getByRole("button", { name: "Firmar el documento" }).click();

  // Las institucionales las aplica el sondeo (mock de Code100, cualificadas):
  // la sección de pago aparece sola cuando el expediente queda FIRMADO.
  await expect(
    page.getByText("✓ Documento firmado · cliente + Interseguros + Alianza Garantía"),
  ).toBeVisible({ timeout: 20_000 });

  // La constancia de la firma: el cliente firma con la firma no cualificada
  // del portal (D1), así que no hay certificado de prestador que abrir — lo
  // que la respalda es su evidencia, y tiene que poder verla.
  await clickearHidratado(page.getByRole("button", { name: "Ver la evidencia de mi firma" }));
  const constancia = page.getByRole("dialog", { name: "Constancia de tu firma" });
  await expect(constancia.getByText(/firma electrónica simple, no cualificada/i)).toBeVisible();
  await expect(constancia.getByText("Qué firmaste")).toBeVisible();
  await expect(constancia.getByText("Desde dónde y cuándo")).toBeVisible();
  await expect(constancia.getByText(/Res\. SS\.SG\. N\.º 210\/2025/)).toBeVisible();
  await constancia.getByRole("button", { name: "Cerrar" }).click();
  await expect(constancia).toBeHidden();

  // ── Paso 3 · el pago (formulario v2 como sección, gated por FIRMADO) ──
  await page.locator("#p7-acepta-certificado").check();
  await page.getByRole("button", { name: "GENERAR QR BANCARD" }).click();
  await expect(page.getByText("Escaneá el QR con tu app de banco")).toBeVisible();
  const pagado = page.getByRole("button", { name: "Pagado", exact: true });
  await expect(pagado).toBeEnabled({ timeout: 15_000 });
  await pagado.click();
  await expect(page.getByRole("heading", { name: "Pago acreditado" })).toBeVisible({
    timeout: 15_000,
  });

  // ── Confirmación ──────────────────────────────────────────────────────
  await page.getByRole("link", { name: "Ver la confirmación →" }).click();
  await expect(page).toHaveURL(/\/confirmacion$/);
  await expect(page.getByText("¡Listo! Tu familia ya está protegida")).toBeVisible();

  // La constancia sigue alcanzable después de pagar: si viviera solo en el
  // paso 3, se perdería en cuanto la persona avanza.
  await clickearHidratado(page.getByRole("button", { name: "Ver la evidencia de mi firma" }));
  await expect(
    page.getByRole("dialog", { name: "Constancia de tu firma" }).getByText("Quién firmó"),
  ).toBeVisible();
});
