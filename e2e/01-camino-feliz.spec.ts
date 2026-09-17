import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { obtenerPersonaDemo } from "@/adapters/mock/personas";
import { TEXTOS_05B } from "@/domain/v4/textos-confirmacion";
import { prepararEscenario } from "./support/demo-panel";
import {
  completarActividadV4,
  completarConsentimientosV4,
  completarDatosPersonalesV4,
  completarDeclaracionesV4,
  completarFirmaV4,
  completarIdentidadAprobada,
  completarPagoQrV4,
  completarPlan,
  completarPreparacion,
  completarWhatsapp,
  leerCorrelativoPropuestaV4,
} from "./support/flujo";

/**
 * Escenario 1 — Camino feliz completo (v4).
 *
 * 01 (portada) → 02 (plan VIVE) → 03A (OTP de WhatsApp) → 03B (preparación) →
 * 03C (identidad y correo) → 03D (datos personales) → 03E (actividad,
 * ingresos, PEP = No) → 04A (las tres declaraciones de salud compatibles) →
 * 04D (consentimientos) → 04E (firma interna con OTP de WhatsApp) → 05A
 * (pago QR) → 05B (contratación confirmada), con Mónica Mariana Gorena Tapia
 * (C.I. 9.323.336).
 *
 * La confirmación tiene que mostrar el certificado y el paquete firmado como
 * dos cosas distintas —el documento que ya emitió el cobro (D-12) frente a la
 * póliza, que Alianza emite a su ritmo— y los cuatro descargables (D-05,
 * D-12, D-27; la constancia porque la firma del cliente fue interna) tienen
 * que servir un PDF de verdad.
 */
test("camino feliz 01→05B con Mónica Gorena Tapia", async ({ page }) => {
  const persona = obtenerPersonaDemo("camino-feliz");
  if (!persona) throw new Error("Fixture 'camino-feliz' no encontrado en personas.ts.");

  await prepararEscenario(page, { personaId: persona.id });

  await completarPlan(page, persona);
  await completarWhatsapp(page, persona);
  await completarPreparacion(page);
  await completarIdentidadAprobada(page, persona);
  await completarDatosPersonalesV4(page);
  await completarActividadV4(page, { esPep: false });
  // D-33 · las tres declaraciones de salud compatibles llevan a 04D, no a
  // revisión manual.
  await completarDeclaracionesV4(page, persona, /\/consentimientos$/);
  await completarConsentimientosV4(page);
  // D-08 enmendada / D-38 · se firma en 04E y eso ya habilita el pago.
  await completarFirmaV4(page, persona);
  await completarPagoQrV4(page);

  await expect(page).toHaveURL(/\/confirmacion$/);
  await expect(page.getByText(TEXTOS_05B.franjaPago)).toBeVisible();

  // Los cinco hitos de "ESTADO DE LA SOLICITUD".
  await expect(page.getByText(TEXTOS_05B.filas.datos.concepto, { exact: true })).toBeVisible();
  await expect(page.getByText(TEXTOS_05B.filas.firma.concepto, { exact: true })).toBeVisible();
  await expect(page.getByText(TEXTOS_05B.filas.pago.concepto, { exact: true })).toBeVisible();
  await expect(page.getByText(TEXTOS_05B.filas.solicitud.concepto, { exact: true })).toBeVisible();
  await expect(page.getByText(TEXTOS_05B.filas.solicitud.estado, { exact: true }).first()).toBeVisible();

  // No se genera Nota de Cobertura — la leyenda obligatoria del producto.
  await expect(page.getByText(TEXTOS_05B.leyendaSinNotaCobertura, { exact: true })).toBeVisible();

  // CHG-41 · la ventana de cobertura consta en la pantalla, no se remite a un
  // documento que todavía no llegó.
  await expect(page.getByText(TEXTOS_05B.etiquetaInicio, { exact: true })).toBeVisible();
  await expect(page.getByText(TEXTOS_05B.detalleInicio)).toBeVisible();

  // D-05/D-12/D-27 · los cuatro documentos posibles y ninguno más. La
  // constancia aparece porque la firma del cliente fue interna (04E, WhatsApp).
  await expect(page.getByText(TEXTOS_05B.documentos.paquete.nombre, { exact: true })).toBeVisible();
  await expect(page.getByText(TEXTOS_05B.documentos.certificado.nombre, { exact: true })).toBeVisible();
  await expect(page.getByText(TEXTOS_05B.documentos.comprobante.nombre, { exact: true })).toBeVisible();
  await expect(page.getByText(TEXTOS_05B.documentos.constancia.nombre, { exact: true })).toBeVisible({
    timeout: 20_000,
  });

  // Los cuatro botones "Descargar" tienen que aparecer (documentosDisponibles).
  await expect(page.getByRole("link", { name: /Descargar/ }).first()).toBeVisible({ timeout: 20_000 });

  const correlativo = await leerCorrelativoPropuestaV4(page);
  await verificarDescargas(page, correlativo);

  // CMP-06 · el QR de los documentos con huella lleva a una página que los
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
      // La huella publicada es un SHA-256 de verdad, no un marcador. Con la
      // firma interna del cliente (D-27) el paquete publica **dos** huellas
      // —la del documento y la de la constancia `CONST-`—, así que se pide
      // «al menos una» y no exactamente una.
      await expect(publica.getByText(/^[0-9a-f]{64}$/).first()).toBeVisible();
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
  } finally {
    await sinSesion.close();
  }
}

/**
 * Los tres documentos con huella se piden por el mismo endpoint y tienen que
 * devolver un PDF de verdad. Se los pide desde el contexto de la página para
 * que viaje la cookie de sesión: sin ella el endpoint responde 400, que es
 * justamente la garantía de que nadie baja el certificado de otra persona.
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
