/**
 * Helpers del panel de demo (`/demo-panel`), usados como herramienta de
 * setup de los escenarios E2E — nunca como parte del flujo P0–P9 que se está
 * probando.
 *
 * Todo pasa por `page.request`, que comparte el `BrowserContext` (y por lo
 * tanto las cookies) con `page`: autenticarse una vez alcanza para el resto
 * de las llamadas de la misma prueba.
 */
import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { IdPersonaDemo } from "@/adapters/mock/personas";
import type { EscenarioIdentidadDemo } from "@/adapters/mock/persona-activa";
import type { FallaDemo } from "@/adapters/mock/fallas-demo";
import { obtenerClaveDelPanel } from "./secreto-panel";

async function esperarOk(promesa: ReturnType<APIRequestContext["post"]>, contexto: string): Promise<void> {
  const respuesta = await promesa;
  expect(respuesta.ok(), `${contexto}: esperaba 2xx, llegó ${respuesta.status()}`).toBeTruthy();
}

/** Login en `/demo-panel` con la clave real leída de Secrets Manager. */
export async function iniciarSesionPanel(page: Page): Promise<void> {
  const clave = await obtenerClaveDelPanel();
  const respuesta = await page.request.post("/api/demo-panel/sesion", { data: { clave } });
  expect(respuesta.ok(), `login al panel de demo: esperaba 2xx, llegó ${respuesta.status()}`).toBeTruthy();
}

/** Olvida el expediente de **esta** sesión de navegador (no toca la base). */
export async function reiniciarExpedienteDelNavegador(page: Page): Promise<void> {
  await esperarOk(page.request.post("/api/demo-panel/reiniciar"), "reiniciar expediente");
}

/** Fija la persona de prueba activa y, opcionalmente, fuerza un desenlace de P5. */
export async function fijarPersonaActiva(
  page: Page,
  personaId: IdPersonaDemo,
  escenarioIdentidadForzado: EscenarioIdentidadDemo | null = null,
): Promise<void> {
  await esperarOk(
    page.request.post("/api/demo-panel/persona", {
      data: { personaId, escenarioIdentidadForzado },
    }),
    `fijar persona activa (${personaId})`,
  );
}

/** Deja sin armar las cinco palancas de fallo del panel. */
export async function desarmarTodasLasFallas(page: Page): Promise<void> {
  await esperarOk(page.request.post("/api/demo-panel/fallas", { data: { reiniciar: true } }), "desarmar fallas");
}

export async function armarFalla(page: Page, falla: FallaDemo): Promise<void> {
  await esperarOk(
    page.request.post("/api/demo-panel/fallas", { data: { falla, activa: true } }),
    `armar falla ${falla}`,
  );
}

/** Plazo que se le va a asignar a la **próxima** firma que se complete (D-10). */
export async function fijarPlazoPagoMs(page: Page, plazoMs: number): Promise<void> {
  await esperarOk(page.request.post("/api/demo-panel/plazo-pago", { data: { plazoMs } }), "fijar plazo de pago");
}

/**

 * Prepara el tablero del panel antes de un escenario: sesión, sin fallas
 * armadas, plazo de pago real (24 h) salvo que se pida otro, y la persona
 * indicada. Deja el tablero determinista para que un escenario no herede
 * nada del anterior (el estado del panel es del **proceso**, no por test).
 */
export async function prepararEscenario(
  page: Page,
  opciones: {
    readonly personaId: IdPersonaDemo;
    readonly escenarioIdentidadForzado?: EscenarioIdentidadDemo | null;
    readonly plazoPagoMs?: number;
  },
): Promise<void> {
  await iniciarSesionPanel(page);
  await reiniciarExpedienteDelNavegador(page);
  await desarmarTodasLasFallas(page);
  // 24 h reales por defecto: el plazo del panel es memoria del proceso y un
  // escenario anterior puede haberlo dejado corto.
  await fijarPlazoPagoMs(page, opciones.plazoPagoMs ?? 24 * 60 * 60 * 1000);
  await fijarPersonaActiva(page, opciones.personaId, opciones.escenarioIdentidadForzado ?? null);
}

/**
 * Lee el código OTP más reciente enviado a un destino, desde la tabla
 * "Códigos OTP simulados" del panel (regla inviolable #2: es el único lugar
 * del sistema donde el código puede verse — nunca la API del flujo).
 *
 * `contieneEnDestino` es el fragmento enmascarado que identifica al destino
 * sin ambigüedad (los últimos 3 dígitos del celular, o el primer carácter +
 * dominio del correo).
 */
export async function leerCodigoOtpDelPanel(page: Page, contieneEnDestino: string): Promise<string> {
  const panel = await page.request.get("/demo-panel");
  expect(panel.ok(), `GET /demo-panel: esperaba 2xx, llegó ${panel.status()}`).toBeTruthy();
  const html = await panel.text();

  // Cada fila de la tabla es <tr>...<td>CÓDIGO</td><td>...DESTINO...</td>...</tr>.
  // Se parsea con una expresión regular en vez de traer un DOM parser nuevo:
  // el panel es HTML fijo, sin scripts que lo reescriban entre el fetch y acá.
  const filas = [...html.matchAll(/<tr class="border-t[^>]*>([\s\S]*?)<\/tr>/g)];
  for (const [, filaHtml] of filas) {
    if (!filaHtml.includes(contieneEnDestino)) continue;
    const codigo = filaHtml.match(/font-mono text-lg font-bold tracking-widest text-titulo">\s*(\d{6})\s*</);
    if (codigo) return codigo[1];
  }

  throw new Error(
    `No se encontró en /demo-panel ningún código OTP para un destino que contenga "${contieneEnDestino}". ` +
      "¿Se pidió el código (ENVIAR CÓDIGO) antes de leerlo?",
  );
}

export interface SesionFirmaLeida {
  readonly idCode100: string;
  readonly codigo: string | null;
  readonly hashSolicitudFirmada: string | null;
  readonly hashFipfFirmado: string | null;
}

/**
 * Lee del panel el estado de un acto de firma de Code100 por su `idCode100`:
 * el código OTP de firma (tercer OTP, regla inviolable #1) y las dos huellas,
 * que aparecen juntas o ninguna aparece (regla inviolable #3).
 */
export async function leerSesionFirmaDelPanel(page: Page, idCode100: string): Promise<SesionFirmaLeida> {
  const panel = await page.request.get("/demo-panel");
  expect(panel.ok()).toBeTruthy();
  const html = await panel.text();

  const inicio = html.indexOf(idCode100);
  if (inicio === -1) {
    throw new Error(`No se encontró en /demo-panel ningún acto de firma con id ${idCode100}.`);
  }
  // Recorta el bloque del <li> de esta sesión: entre este idCode100 y el próximo
  // (o el cierre de la lista), sin volver a traer un DOM parser nuevo.
  const siguiente = html.indexOf("font-mono text-xs font-semibold text-titulo", inicio + idCode100.length);
  const bloque = html.slice(inicio, siguiente === -1 ? html.length : siguiente);

  const codigo = bloque.match(/font-mono text-2xl font-bold tracking-widest text-titulo">(\d{6})</);
  const hashSolicitud = bloque.match(/Solicitud firmada: <\/dt>\s*<dd class="inline">([^<]*)<\/dd>/);
  const hashFipf = bloque.match(/FIPF firmado: <\/dt>\s*<dd class="inline">([^<]*)<\/dd>/);

  const limpiar = (valor: string | undefined): string | null => {
    if (!valor) return null;
    const texto = valor.trim();
    return texto === "— sin firmar —" ? null : texto;
  };

  return {
    idCode100,
    codigo: codigo ? codigo[1] : null,
    hashSolicitudFirmada: limpiar(hashSolicitud?.[1]),
    hashFipfFirmado: limpiar(hashFipf?.[1]),
  };
}

export type AccionFirmaPanel = "ABRIR" | "FIRMAR" | "RECHAZAR";

/** Llama a `POST /api/demo-panel/firma`, el "otro lado" del enlace de Code100. */
export async function accionarFirmaPanel(
  page: Page,
  idCode100: string,
  cuerpo: { readonly accion: AccionFirmaPanel; readonly codigo?: string; readonly fallarAMitad?: boolean },
): Promise<{ readonly ok: boolean; readonly status: number; readonly datos: Record<string, unknown> }> {
  const respuesta = await page.request.post("/api/demo-panel/firma", {
    data: { idCode100, ...cuerpo },
  });
  const datos = (await respuesta.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: respuesta.ok(), status: respuesta.status(), datos };
}
