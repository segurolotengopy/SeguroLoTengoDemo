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
import { TEXTOS_03D } from "@/domain/v4/textos-identidad";
import { TEXTOS_04E } from "@/domain/v4/textos-firma";
import { TEXTOS_05A } from "@/domain/v4/textos-pago";
import { TEXTOS_05B } from "@/domain/v4/textos-confirmacion";

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
    // Las pantallas que cargan sus datos con un `fetch` al montarse se
    // fotografían recién cuando el dato está en pantalla: una captura del
    // esqueleto («Estamos cerrando…», «—») no le sirve a nadie.
    await expect(page.getByLabel(TEXTOS_03D.etiquetas.numeroCedula, { exact: true })).not.toHaveValue(
      "",
      { timeout: 15_000 },
    );
    await capturar(page, "03d-datos");

    await completarDatosPersonalesV4(page);
    await capturar(page, "03e-actividad");

    await completarActividadV4(page, { esPep: false });
    await capturar(page, "04a-declaraciones");

    await completarDeclaracionesV4(page, persona, /\/consentimientos$/);
    await capturar(page, "04d-consentimientos");

    await completarConsentimientosV4(page);
    // 04E cierra el paquete al entrar (`GET /api/p8/resumen`): se espera el
    // bloque «Qué vas a firmar», que aparece con el documento ya hasheado.
    await expect(page.getByText(TEXTOS_04E.seccionDocumentoTitulo, { exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await capturar(page, "04e-firma");

    await completarFirmaV4(page, persona);
    await expect(page).toHaveURL(/\/pago$/);
    // 05A trae el resumen del cobro con `GET /api/p7/resumen`: se espera a que
    // el premio esté en pantalla (formato «Gs. 575.000»), no el «—» inicial.
    await expect(page.getByText(TEXTOS_05A.rotuloPremio, { exact: true })).toBeVisible();
    await expect(page.getByText(/Gs\.\s?[0-9.]+/).first()).toBeVisible({ timeout: 30_000 });
    await capturar(page, "05a-pago");

    await completarPagoQrV4(page);
    await expect(page).toHaveURL(/\/confirmacion$/);
    await expect(page.getByText("Pago acreditado por Bancard.")).toBeVisible();
    // 05B ordena la emisión y archiva los PDF con `GET /api/p9/resumen`: se
    // espera a que los cuatro descargables estén ofrecidos (D-05, D-27) y el
    // número de propuesta impreso, que es lo que gerencia quiere ver.
    await expect(page.getByText(TEXTOS_05B.tituloDocumentos, { exact: true })).toBeVisible();
    await expect(page.getByText(TEXTOS_05B.botonDescargar, { exact: true }).first()).toBeVisible({
      timeout: 60_000,
    });
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
    // El número de caso (`PREFIJO-AAAA-NNNNNN`, `generarNumeroCaso`) llega por
    // `fetch`: sin él la fila dice «—» y la captura no prueba la derivación.
    await expect(page.getByText(/^[A-Z]+-\d{4}-\d{6}$/)).toBeVisible({ timeout: 30_000 });
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
    // El caso llega por `GET /api/pantalla-b/caso`: se espera el premio
    // formateado («Gs. 575.000»), que solo aparece con el caso cargado — la
    // propuesta se imprime sin prefijo (ocho dígitos), así que no sirve de
    // marcador.
    await expect(page.getByText(/Gs\.\s?[0-9.]+/).first()).toBeVisible({ timeout: 30_000 });
    await capturar(page, "pantalla-b-solicitud-vencida");
  });
});
