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

  // P0 no existe (revisión de gerencia del 20-ago): la raíz redirige al paso 1.
  await page.goto("/");
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

  // CHG-44 / CMP-05 · los documentos se entregan a los dos canales verificados
  // y la pantalla muestra el acuse, no solo el envío.
  await expect(page.getByText("Entregado").first()).toBeVisible({ timeout: 30_000 });
  const entregas = page.locator("li", { hasText: "Entregado" });
  await expect(entregas).toHaveCount(2);

  // CMP-06 · el QR de los dos documentos con huella lleva a una página que los
  // verifica de verdad.
  await verificarRutaPublica(page, correlativo);
});

/**
 * La ruta pública de verificación (CMP-06), con los tres códigos.
 *
 * Es la única pantalla del producto que se abre **sin sesión**, así que se la
 * visita con un contexto limpio: si funcionara solo con la cookie del flujo,
 * el hospital que escanea el QR del certificado vería un error.
 */
async function verificarRutaPublica(page: Page, correlativo: string): Promise<void> {
  const sinSesion = await page.context().browser()?.newContext();
  if (!sinSesion) throw new Error("No se pudo abrir un contexto sin sesión.");
  const publica = await sinSesion.newPage();

  try {
    for (const codigo of [`CPC-${correlativo}`, `PROP-${correlativo}`, `FIPF-${correlativo}`]) {
      await publica.goto(`/verificar/${codigo}`);
      await expect(publica.getByText("DOCUMENTO VERIFICADO")).toBeVisible();
      // La huella publicada es un SHA-256 de verdad, no un marcador.
      await expect(publica.getByText(/^[0-9a-f]{64}$/)).toBeVisible();
    }

    // El certificado publica además la ventana de cobertura que declara.
    await publica.goto(`/verificar/CPC-${correlativo}`);
    await expect(
      publica.getByRole("heading", { name: "COBERTURA QUE DECLARA EL CERTIFICADO" }),
    ).toBeVisible();

    // Y ninguna de las tres muestra un dato de la persona (regla #7).
    const texto = (await publica.locator("body").innerText()).toLowerCase();
    expect(texto).not.toContain("gorena");
    expect(texto).not.toContain("9.323.336");

    // El comprobante no se verifica solo, y lo explica en vez de decir que no existe.
    await publica.goto(`/verificar/REC-${correlativo}`);
    await expect(publica.getByText("NO PUDIMOS VERIFICAR ESTE CÓDIGO")).toBeVisible();
    await expect(publica.getByText(/no se verifica por sí solo/)).toBeVisible();

    // Un código inventado tampoco revienta la página.
    await publica.goto("/verificar/PROP-00000001");
    await expect(publica.getByText("NO PUDIMOS VERIFICAR ESTE CÓDIGO")).toBeVisible();

    // La otra forma de llegar es el token del QR, y un sufijo inventado sobre
    // un correlativo que **sí** existe no abre nada: es la propiedad por la
    // que el QR lleva el token y no el código.
    await publica.goto(`/verificar/${correlativo}-${"0".repeat(32)}`);
    await expect(publica.getByText("NO PUDIMOS VERIFICAR ESTE CÓDIGO")).toBeVisible();
  } finally {
    await sinSesion.close();
  }
}

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
