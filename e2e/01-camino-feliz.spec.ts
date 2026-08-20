import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
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
  continuarAConfirmacion,
  enviarEnlaceYAbrir,
  enviarP6,
  firmarNormalmente,
} from "./support/flujo";

/**
 * Escenario 1 — Camino feliz completo.
 *
 * P0 → P1 (OTP celular) → P2 (CONFÍO+) → P3 (checklist + consentimiento) →
 * P4 (OTP correo) → P5 (identidad aprobada) → P6 (las ocho declaraciones
 * compatibles) → P7 (pago QR) → P8 (firma Code100) → P9 (contratación
 * aceptada), con Mónica Mariana Gorena Tapia (C.I. 9.323.336).
 *
 * La confirmación tiene que mostrar el `Certificado de Cobertura Provisional ✓`
 * junto a `Emisión de la póliza y la factura ⋯`: son dos cosas distintas
 * —el documento que el portal ya emitió (D-12) frente al que Alianza emite a
 * su ritmo— y los tres descargables tienen que servir un PDF de verdad.
 */
test("camino feliz P0→P9 con Mónica Gorena Tapia", async ({ page }) => {
  const persona = obtenerPersonaDemo("camino-feliz");
  if (!persona) throw new Error("Fixture 'camino-feliz' no encontrado en personas.ts.");

  await prepararEscenario(page, { personaId: persona.id });

  await page.goto("/");
  await expect(page.getByText("La contratación comienza recién en el paso 1.")).toBeVisible();
  // La puerta de entrada lleva ahora al catálogo, que es el paso 1 (CHG-01).
  await page.getByRole("link", { name: "Elegí tu plan y cotizá →" }).click();
  await expect(page).toHaveURL(/\/plan$/);

  await completarPlan(page, persona);
  await completarWhatsapp(page, persona);
  await completarPreparacion(page);
  await declararCorreo(page, persona);
  await completarP5Aprobado(page);
  await completarP6(page, persona);
  // D-08 · se firma en el paso 6 y se paga en el 7.
  await enviarP6(page, /\/firma$/);

  const idCode100 = await enviarEnlaceYAbrir(page);
  await firmarNormalmente(page, idCode100);

  await completarP7Qr(page);
  await continuarAConfirmacion(page);

  // Paso 8 · Contratación aceptada.
  await expect(page).toHaveURL(/\/confirmacion$/);
  await expect(page.getByText("¡Tu solicitud de seguro fue aceptada!")).toBeVisible();

  // El certificado ya existe cuando la pantalla carga: nació con el cobro
  // (D-12), no lo emite esta pantalla.
  const hitoCertificado = page.locator("li", { hasText: "Certificado de Cobertura Provisional" });
  await expect(hitoCertificado.getByText("✓", { exact: false })).toBeVisible();

  const hitoPoliza = page.locator("li", { hasText: "Emisión de la póliza y la factura" });
  await expect(hitoPoliza).toBeVisible();
  await expect(hitoPoliza.getByText("⋯", { exact: false })).toBeVisible();

  await expect(page.getByText("ACEPTADA", { exact: true })).toBeVisible();
  await expect(page.getByText("No se genera Nota de Cobertura.")).toBeVisible();

  // CHG-41 · la fecha de inicio de cobertura consta en la pantalla, no se
  // remite a un documento que todavía no llegó.
  // Por rol y no por texto: el rótulo se escribe en minúsculas (lo pone en
  // mayúsculas el CSS) y "inicio de la cobertura" aparece además dentro de la
  // descripción del certificado.
  await expect(page.getByRole("heading", { name: "Inicio de la cobertura" })).toBeVisible();
  await expect(page.getByText("24 horas exactas después de la confirmación del pago.")).toBeVisible();

  // CHG-42/43 · los tres descargables, cada uno con su código y su PDF.
  const correlativo = await propuestaVisible(page);
  for (const codigo of [`CPC-${correlativo}`, `PROP-${correlativo}`, `REC-${correlativo}`]) {
    await expect(page.getByText(codigo, { exact: true })).toBeVisible();
  }
  await verificarDescargas(page, correlativo);
});

/** El correlativo que la pantalla muestra, para armar los tres códigos. */
async function propuestaVisible(page: Page): Promise<string> {
  const codigo = await page.getByText(/^PROP-\d{8}$/).first().textContent();
  const correlativo = (codigo ?? "").replace("PROP-", "");
  expect(correlativo).toMatch(/^\d{8}$/);
  return correlativo;
}

/**
 * Los tres documentos se piden por el mismo endpoint y tienen que devolver un
 * PDF de verdad. Se los pide desde el contexto de la página para que viaje la
 * cookie de sesión: sin ella el endpoint responde 400, que es justamente la
 * garantía de que nadie baja el certificado de otra persona.
 */
async function verificarDescargas(page: Page, correlativo: string): Promise<void> {
  const pedidos: readonly { codigo: string; firmado: boolean; conHuella: boolean }[] = [
    { codigo: `CPC-${correlativo}`, firmado: false, conHuella: true },
    { codigo: `PROP-${correlativo}`, firmado: true, conHuella: true },
    // El comprobante se genera al vuelo y no tiene huella registrada (D-05).
    { codigo: `REC-${correlativo}`, firmado: false, conHuella: false },
  ];

  for (const { codigo, firmado, conHuella } of pedidos) {
    const url = `/api/p8/documento?codigo=${codigo}${firmado ? "&firmado=1" : ""}&descargar=1`;
    const respuesta = await page.request.get(url);
    expect(respuesta.status(), `descarga de ${codigo}`).toBe(200);
    expect(respuesta.headers()["content-type"]).toContain("application/pdf");
    const cuerpo = await respuesta.body();
    expect(cuerpo.subarray(0, 5).toString("latin1"), `${codigo} no es un PDF`).toBe("%PDF-");
    if (conHuella) {
      expect(respuesta.headers()["x-sha256"], `${codigo} sin huella`).toMatch(/^[0-9a-f]{64}$/);
    } else {
      expect(respuesta.headers()["x-sha256"]).toBeUndefined();
    }
  }
}
