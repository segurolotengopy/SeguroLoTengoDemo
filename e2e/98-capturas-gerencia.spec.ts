import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { obtenerPersonaDemo } from "@/adapters/mock/personas";
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
} from "./support/flujo";

/**
 * Capturas de las doce pantallas del flujo v4 (01–05B) más las dos derivadas
 * (Pantalla A · revisión manual, Pantalla B · solicitud vencida) para el PDF
 * de revisión de gerencia. **No es un test de la batería**: solo corre con
 * `CAPTURAS_GERENCIA=1` y no verifica reglas de negocio — recorre los mismos
 * caminos que los escenarios 01, 02 y 06 y fotografía cada pantalla completa
 * a 1456 px de ancho (el lienzo de escritorio de referencia del mockup).
 *
 * Con `CAPTURAS_MOVIL=1` fotografía en cambio la vista de celular (390 px,
 * emulación móvil a densidad 2x) y guarda en `pantallas/capturas-movil`.
 */

const MOVIL = process.env.CAPTURAS_MOVIL === "1";
const DIR_CAPTURAS = MOVIL ? "pantallas/capturas-movil" : "pantallas/capturas";

test.describe("capturas para gerencia", () => {
  test.skip(
    process.env.CAPTURAS_GERENCIA !== "1",
    "Solo para generar el PDF de gerencia (CAPTURAS_GERENCIA=1).",
  );

  test.use(
    MOVIL
      ? {
          viewport: { width: 390, height: 844 },
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true,
        }
      : { viewport: { width: 1456, height: 900 } },
  );

  test.beforeAll(() => {
    mkdirSync(DIR_CAPTURAS, { recursive: true });
  });

  async function capturar(page: Page, nombre: string): Promise<void> {
    // Sin animaciones ni cursor de texto: la captura debe ser estable. Se
    // oculta también el indicador de desarrollo de Next.js (nextjs-portal),
    // que no forma parte de la pantalla.
    await page.addStyleTag({
      content:
        "*{animation:none!important;transition:none!important;caret-color:transparent!important}" +
        "nextjs-portal{display:none!important}",
    });
    await page.screenshot({
      path: `${DIR_CAPTURAS}/${nombre}.jpg`,
      type: "jpeg",
      quality: 90,
      fullPage: true,
    });
  }

  test("01 a 05B — camino feliz", async ({ page }) => {
    test.setTimeout(240_000);
    const persona = obtenerPersonaDemo("camino-feliz");
    if (!persona) throw new Error("Fixture 'camino-feliz' no encontrado.");

    await prepararEscenario(page, { personaId: persona.id });

    await page.goto("/");
    await capturar(page, "01-portada");

    await page.goto("/plan");
    await capturar(page, "02-plan");

    await completarPlan(page, persona);
    await capturar(page, "03a-whatsapp");

    await completarWhatsapp(page, persona);
    await capturar(page, "03b-preparacion");

    await completarPreparacion(page);
    await capturar(page, "03c-identidad");

    await completarIdentidadAprobada(page, persona);
    await capturar(page, "03d-datos");

    await completarDatosPersonalesV4(page);
    await capturar(page, "03e-actividad");

    await completarActividadV4(page, { esPep: false });
    await capturar(page, "04a-declaraciones");

    await completarDeclaracionesV4(page, persona, /\/consentimientos$/);
    await capturar(page, "04d-consentimientos");

    await completarConsentimientosV4(page);
    await capturar(page, "04e-firma");

    await completarFirmaV4(page, persona);
    await expect(page).toHaveURL(/\/pago$/);
    await capturar(page, "05a-pago");

    await completarPagoQrV4(page);
    await expect(page).toHaveURL(/\/confirmacion$/);
    await expect(page.getByText("Pago acreditado por Bancard.")).toBeVisible();
    await capturar(page, "05b-confirmacion");
  });

  test("Pantalla A — derivación a revisión manual (PEP)", async ({ page }) => {
    test.setTimeout(240_000);
    const persona = obtenerPersonaDemo("pep-positivo");
    if (!persona) throw new Error("Fixture 'pep-positivo' no encontrado.");

    await prepararEscenario(page, { personaId: persona.id });
    await completarPlan(page, persona);
    await completarWhatsapp(page, persona);
    await completarPreparacion(page);
    await completarIdentidadAprobada(page, persona);
    await completarDatosPersonalesV4(page);
    await completarActividadV4(page, { esPep: true });

    await expect(page).toHaveURL(/\/revision-manual$/);
    await expect(page.getByText("En revisión", { exact: false }).first()).toBeVisible();
    await capturar(page, "pantalla-a-revision-manual");
  });

  test("Pantalla B — solicitud vencida", async ({ page }) => {
    test.setTimeout(240_000);
    const persona = obtenerPersonaDemo("no-firma");
    if (!persona) throw new Error("Fixture 'no-firma' no encontrado.");

    await prepararEscenario(page, { personaId: persona.id, plazoPagoMs: 30_000 });
    await completarPlan(page, persona);
    await completarWhatsapp(page, persona);
    await completarPreparacion(page);
    await completarIdentidadAprobada(page, persona);
    await completarDatosPersonalesV4(page);
    await completarActividadV4(page, { esPep: false });
    await completarDeclaracionesV4(page, persona, /\/consentimientos$/);
    await completarConsentimientosV4(page);

    // D-08 · se firma, no se paga, y el expediente caduca sin cobro: la
    // Pantalla B no promete ninguna devolución.
    await completarFirmaV4(page, persona);

    await expect(page).toHaveURL(/\/solicitud-vencida$/, { timeout: 60_000 });
    await expect(page.getByText("No se realizó ningún cobro:", { exact: false })).toBeVisible();
    await capturar(page, "pantalla-b-solicitud-vencida");
  });
});
