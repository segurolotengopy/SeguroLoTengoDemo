/**
 * Lleva un trámite v3 desde los T&C hasta `/pago-y-firma` con el expediente ya
 * **FIRMADO_CLIENTE**, que es la puerta del paso de pago (regla 6-bis: no hay
 * cobro sin la firma del cliente; la de Interseguros llega después del pago).
 *
 * Existe para que los specs que prueban **la parte de Bancard** no tengan que
 * repetir el recorrido de los dos pasos anteriores. Es el mismo camino que
 * hace `04-camino-feliz.spec.ts` hasta la línea del pago; aquel spec no se
 * refactorizó para usar esto a propósito: es el que prueba el recorrido
 * completo, y hacerlo depender de un helper compartido le sacaría justamente
 * lo que lo hace valioso —que recorre todo, escrito de corrido y a la vista—.
 *
 * Lo que sigue de acá lo escribe cada spec, porque es lo que cada uno prueba.
 */
import { expect, type Page } from "@playwright/test";
import { obtenerPersonaDemo } from "@/adapters/mock/personas";
import { BOTON_CONTINUAR_PLAN } from "@/domain/textos-plan";
import { leerCodigoOtpDelPanel, prepararEscenario } from "../../support/demo-panel";
import type { FallaDemo } from "@/adapters/mock/fallas-demo";
import {
  celularLocal,
  clickearHidratado,
  completarDatosComplementarios,
  esperarHidratacion,
  tipearOtp,
  tomarCapturaP5,
} from "../../support/flujo";

export async function llegarAPagoYFirmaFirmado(
  page: Page,
  opciones: { readonly fallas?: readonly FallaDemo[] } = {},
): Promise<void> {
  const persona = obtenerPersonaDemo("camino-feliz");
  if (!persona) throw new Error("Fixture 'camino-feliz' no encontrado en personas.ts.");

  await prepararEscenario(page, { personaId: persona.id, fallas: opciones.fallas });

  // ── T&C: crean el expediente ────────────────────────────────────────────
  await page.goto("/");
  await esperarHidratacion(page);
  await page.getByRole("checkbox").check();
  await clickearHidratado(page.getByRole("button", { name: /empezar/i }));
  await expect(page).toHaveURL(/\/inscripcion$/);

  // ── Paso 1 · identidad ──────────────────────────────────────────────────
  await tomarCapturaP5(page, "FRENTE");
  await expect(page.getByText("✓ Aprobada", { exact: true })).toHaveCount(1);
  await tomarCapturaP5(page, "DORSO");
  await expect(page.getByText("✓ Aprobada", { exact: true })).toHaveCount(2);
  await tomarCapturaP5(page, "SELFIE");
  await page.getByRole("button", { name: /leer los datos de mi cédula/i }).click();
  await expect(
    page.getByText("Datos extraídos de la cédula y confirmados con la selfie en vivo."),
  ).toBeVisible({ timeout: 20_000 });

  await page.getByLabel(/Autorizo la captura y comparación/).check();
  await page.locator("#p5-sexo").selectOption("Femenino");
  await page.locator("#p5-pais").selectOption("Paraguay");
  await page.locator("#p5-pais-residencia").selectOption("Paraguay");
  await page.locator("#p5-estado-civil").selectOption("Soltero/a");
  await page.locator("#p5-correo").fill(persona.correo);
  await page.locator("#p5-correo-repetido").fill(persona.correo);
  await completarDatosComplementarios(page);
  await page.getByRole("button", { name: "Validar identidad y continuar →" }).click();

  // ── Paso 1 · canal de WhatsApp ──────────────────────────────────────────
  await page.locator("#p1-destino").fill(celularLocal(persona));
  await clickearHidratado(page.getByRole("button", { name: "ENVIAR CÓDIGO POR WHATSAPP" }));
  await expect(page.getByText(/Código enviado por WhatsApp a/)).toBeVisible();
  const codigoCanal = await leerCodigoOtpDelPanel(page, persona.celular.slice(-3));
  await tipearOtp(page, "p1", codigoCanal);
  await page.getByRole("button", { name: "VERIFICAR WHATSAPP Y CONTINUAR" }).click();

  // ── Paso 1 · aceptación agrupada 1 ──────────────────────────────────────
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /continuar al paso 2/i }).click();
  await expect(page).toHaveURL(/\/seguro$/);

  // ── Paso 2 · plan, declaraciones y aceptación agrupada 2 ────────────────
  await esperarHidratacion(page);
  await page.getByRole("article").nth(1).getByRole("radio").click(); // CONFÍO+
  await page.getByRole("button", { name: BOTON_CONTINUAR_PLAN, exact: true }).click();
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

  // ── Paso 3 · la firma interna del cliente ───────────────────────────────
  await esperarHidratacion(page);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /firmar por WhatsApp/i }).click();
  await expect(page.getByText(/te enviamos el código de firma/i)).toBeVisible();
  const codigoFirma = await leerCodigoOtpDelPanel(page, persona.celular.slice(-3));
  await tipearOtp(page, "firma-v3", codigoFirma);
  await page.getByRole("button", { name: "Firmar el documento" }).click();

  // Enmienda del 04-sep-2026 a D-08 (D-38, D-42): la firma del cliente alcanza
  // para pagar —FIRMADO_CLIENTE— y la de Interseguros llega después del pago;
  // Alianza ya no firma el paquete. La sección de pago aparece sola apenas el
  // sondeo confirma la firma, igual que en `04-camino-feliz.spec.ts`.
  await expect(page.getByText("✓ Documento firmado")).toBeVisible({ timeout: 20_000 });
}
