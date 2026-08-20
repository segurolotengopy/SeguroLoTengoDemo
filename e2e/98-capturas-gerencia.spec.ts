import { mkdirSync } from "node:fs";
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
 * Capturas de las 11 pantallas del flujo (P1–P9, Pantalla A y Pantalla B)
 * para el PDF de revisión de gerencia. **No es un test de la batería**: solo
 * corre con `CAPTURAS_GERENCIA=1` y no verifica reglas de negocio — recorre
 * los mismos caminos que los escenarios 01, 02 y 06 y fotografía cada
 * pantalla completa a 1456 px de ancho (el lienzo de escritorio de
 * referencia del mockup).
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

  test("P1 a P9 — camino feliz", async ({ page }) => {
    test.setTimeout(240_000);
    const persona = obtenerPersonaDemo("camino-feliz");
    if (!persona) throw new Error("Fixture 'camino-feliz' no encontrado.");

    await prepararEscenario(page, { personaId: persona.id });

    // P0 · la puerta de entrada. No es un paso del contador, pero es la
    // primera pantalla que ve quien llega, así que el recorrido empieza ahí.
    await page.goto("/");
    await capturar(page, "00-inicio");

    await page.goto("/plan");
    await capturar(page, "01-plan");

    await completarPlan(page, persona);
    await capturar(page, "02-whatsapp");

    await completarWhatsapp(page, persona);
    await capturar(page, "03-preparacion");

    await completarPreparacion(page);
    await capturar(page, "04-identidad");

    await declararCorreo(page, persona);

    await completarP5Aprobado(page);
    await capturar(page, "05-declaraciones");

    await completarP6(page, persona);
    // D-08 · se firma en el paso 6 y se paga en el 7.
    await enviarP6(page, /\/firma$/);
    await capturar(page, "06-firma");

    const idCode100 = await enviarEnlaceYAbrir(page);
    await firmarNormalmente(page, idCode100);
    await expect(page).toHaveURL(/\/pago$/);
    await capturar(page, "07-pago");

    await completarP7Qr(page);
    await continuarAConfirmacion(page);
    await expect(page).toHaveURL(/\/confirmacion$/);
    await expect(page.getByText("¡Tu solicitud de seguro fue aceptada!")).toBeVisible();
    // El encabezado se renderiza en el servidor y aparece antes que los datos:
    // sin esperar al resumen, la captura sale con todos los campos en "—".
    await expect(page.getByText(/PROP-\d{8}/).first()).toBeVisible();
    await capturar(page, "08-confirmacion");
  });

  test("Pantalla A — derivación a revisión manual (PEP)", async ({ page }) => {
    test.setTimeout(240_000);
    const persona = obtenerPersonaDemo("pep-positivo");
    if (!persona) throw new Error("Fixture 'pep-positivo' no encontrado.");

    await prepararEscenario(page, { personaId: persona.id });
    await completarPlan(page, persona);
    await completarWhatsapp(page, persona);
    await completarPreparacion(page);
    await declararCorreo(page, persona);
    await completarP5Aprobado(page);
    await completarP6(page, persona);
    await enviarP6(page, /\/revision-manual$/);

    // Esperar el número de caso asíncrono antes de fotografiar.
    await expect(page.getByText("EN ANÁLISIS")).toBeVisible();
    await expect(page.locator("dd.font-mono.text-base.font-bold").first()).not.toHaveText("—");
    await capturar(page, "10-pantalla-a-revision-manual");
  });

  test("Pantalla B — solicitud vencida", async ({ page }) => {
    test.setTimeout(240_000);
    const persona = obtenerPersonaDemo("no-firma");
    if (!persona) throw new Error("Fixture 'no-firma' no encontrado.");

    await prepararEscenario(page, { personaId: persona.id, plazoPagoMs: 30_000 });
    await completarPlan(page, persona);
    await completarWhatsapp(page, persona);
    await completarPreparacion(page);
    await declararCorreo(page, persona);
    await completarP5Aprobado(page);
    await completarP6(page, persona);
    await enviarP6(page, /\/firma$/);

    // D-08 · se firma, no se paga, y el expediente caduca sin cobro: la
    // Pantalla B no promete ninguna devolución.
    const idCode100 = await enviarEnlaceYAbrir(page);
    await firmarNormalmente(page, idCode100);

    await expect(page).toHaveURL(/\/solicitud-vencida$/, { timeout: 60_000 });
    await expect(
      page.getByText("No se realizó ningún cobro:", { exact: false }),
    ).toBeVisible();
    await capturar(page, "11-pantalla-b-solicitud-vencida");
  });
});
