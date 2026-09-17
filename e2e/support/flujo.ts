/**
 * Helpers de un paso por pantalla del flujo v4 (12 pantallas, D-43..D-48), para
 * no repetir selectores en cada escenario. Cada función usa los textos reales
 * de `src/domain/v4/textos-*.ts` (importados, nunca copiados) y los
 * componentes de `src/components/v4/pantallas/`.
 *
 * Ninguna función de acá lee un código OTP de una respuesta de la API del
 * flujo: siempre pasa por `leerCodigoOtpDelPanel` (`demo-panel.ts`), que es el
 * único lugar donde el código existe en claro (regla inviolable #2).
 *
 * Recorrido y rutas: `/` (01 portada) → `/plan` (02) → `/whatsapp` (03A) →
 * `/preparacion` (03B) → `/identidad` (03C) → `/datos` (03D) → `/actividad`
 * (03E) → `/declaraciones` (04A) → `/consentimientos` (04D) → `/firma` (04E)
 * → `/pago` (05A) → `/confirmacion` (05B).
 */
import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { PersonaDemo } from "@/adapters/mock/personas";
import { ORDEN_PLANES, PLANES } from "@/domain/catalogo";
import { enmascararCelular } from "@/domain/telefono";
import { TEXTOS_02 } from "@/domain/v4/textos-plan";
import { TEXTOS_03A, TEXTOS_03B } from "@/domain/v4/textos-verificacion";
import { TEXTOS_03C, TEXTOS_03D } from "@/domain/v4/textos-identidad";
import { TEXTOS_03E, TEXTOS_REVISION_MANUAL } from "@/domain/v4/textos-actividad";
import { TEXTOS_04A, TEXTOS_04D } from "@/domain/v4/textos-consentimientos";
import { TEXTOS_04E } from "@/domain/v4/textos-firma";
import { TEXTOS_05A } from "@/domain/v4/textos-pago";
import { TEXTOS_05B } from "@/domain/v4/textos-confirmacion";
import { leerCodigoOtpDelPanel } from "./demo-panel";

/** `+595981000123` → `981000123`, lo que se tipea en el campo de 03A. */
export function celularLocal(persona: PersonaDemo): string {
  return persona.celular.replace("+595", "");
}

/** Tipea un código de 6 dígitos en las casillas de `CamposOtpV4` (03A y 04E). */
export async function tipearOtpV4(page: Page, codigo: string): Promise<void> {
  for (let i = 0; i < codigo.length; i += 1) {
    await page.getByLabel(`Dígito ${i + 1} de 6`).fill(codigo[i]);
  }
}

/**
 * Espera a que la pantalla recién llegada por una navegación del lado del
 * cliente (`next/link` / `router.push`) termine de hidratarse antes de
 * interactuar.
 *
 * Hallazgo empírico (heredado del arnés v2, sigue siendo cierto acá):
 * `toHaveURL` cambia apenas el router actualiza la URL, pero el chunk JS del
 * componente cliente de la pantalla nueva puede seguir cargando — un
 * `.click()` inmediato encuentra el botón (ya está en el DOM por SSR/CSR) pero
 * cae antes de que React adjunte el handler, y el clic se pierde en silencio.
 *
 * La señal que se usa es exacta y no temporal: React 18 cuelga sus
 * propiedades internas (`__reactProps$…`, `__reactFiber$…`) de los nodos al
 * hidratarlos.
 */
export async function esperarHidratacion(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await expect
    .poll(
      async () =>
        page.evaluate(() =>
          [...document.querySelectorAll("button, input, select, a")].some((nodo) =>
            Object.keys(nodo).some((clave) => clave.startsWith("__react")),
          ),
        ),
      { timeout: 15_000, message: "la pantalla nunca terminó de hidratarse" },
    )
    .toBe(true);
}

/**
 * Espera a que **ese** elemento esté hidratado, y recién entonces lo clickea.
 * Mismo criterio que `esperarHidratacion`, aplicado a un botón puntual: estos
 * botones suelen disparar un POST que transiciona el expediente, y un segundo
 * clic mandaría una petición que el dominio rechazaría por estado inválido.
 */
export async function clickearHidratado(boton: Locator): Promise<void> {
  await boton.waitFor({ state: "visible" });
  await expect
    .poll(
      async () => boton.evaluate((nodo) => Object.keys(nodo).some((c) => c.startsWith("__react"))),
      { timeout: 15_000, message: "el botón nunca terminó de hidratarse" },
    )
    .toBe(true);
  await boton.click();
}

/**
 * Abre un `SelectorV4` (03D / 03E / 04A) por su etiqueta y elige una opción de
 * la lista que se despliega — en línea (`sexo`, `estadoCivil`) o en la hoja
 * inferior (`HojaV4`, el resto). Los dos casos exponen la misma estructura
 * accesible: un botón con la etiqueta como nombre y, al abrirse, un
 * `role="option"` por cada valor.
 */
export async function elegirEnSelectorV4(page: Page, etiqueta: string, opcion: string): Promise<void> {
  await page.getByLabel(etiqueta, { exact: true }).click();
  await page.getByRole("option", { name: opcion, exact: true }).click();
}

// ---------------------------------------------------------------------------
// 01 · Portada
// ---------------------------------------------------------------------------

/**
 * Entra desde la portada (`/`) y elige el único producto disponible
 * (Oncológico VIVE), que es el que deja en `/plan`. Los otros cinco no son
 * pulsables (`aria-disabled`).
 */
export async function entrarDesdePortada(page: Page): Promise<void> {
  await page.goto("/");
  await esperarHidratacion(page);
  // El nombre accesible del botón concatena el alt de la ilustración, el rótulo
  // y el badge («Oncológico Oncológico Disponible»): se matchea por prefijo.
  await clickearHidratado(page.getByRole("button", { name: /^Oncológico/ }));
  await expect(page).toHaveURL(/\/plan$/);
}

// ---------------------------------------------------------------------------
// 02 · Selección de plan
// ---------------------------------------------------------------------------

/**
 * 02 · Selección de plan. Entra siempre por la portada (01), así que ejercita
 * las dos pantallas de punta a punta. Deja a la persona en `/whatsapp`.
 */
export async function completarPlan(page: Page, persona: PersonaDemo): Promise<void> {
  await entrarDesdePortada(page);
  await esperarHidratacion(page);

  const indice = ORDEN_PLANES.indexOf(persona.planElegido);
  expect(indice, `Plan desconocido: ${persona.planElegido}`).toBeGreaterThanOrEqual(0);
  const nombrePlan = PLANES[persona.planElegido].nombre;

  await page.getByRole("radio", { name: `Elegir el plan ${nombrePlan}`, exact: true }).click();
  await clickearHidratado(page.getByRole("button", { name: TEXTOS_02.continuar, exact: true }));
  await expect(page).toHaveURL(/\/whatsapp$/);
}

// ---------------------------------------------------------------------------
// 03A · Verificación de WhatsApp (único OTP de canal, D-44: sin SMS)
// ---------------------------------------------------------------------------

export async function completarWhatsapp(page: Page, persona: PersonaDemo): Promise<void> {
  await expect(page).toHaveURL(/\/whatsapp$/);
  await esperarHidratacion(page);

  await page.locator("#numero-whatsapp").fill(celularLocal(persona));
  await page.locator("#autorizacion-whatsapp").check();
  await clickearHidratado(page.getByRole("button", { name: TEXTOS_03A.botonEnviar, exact: true }));

  const destinoEnmascarado = enmascararCelular(persona.celular);
  await expect(page.getByText(TEXTOS_03A.codigoEnviado(destinoEnmascarado))).toBeVisible();

  // Las casillas verifican solas al completar el sexto dígito
  // (`CamposOtpV4.alCompletar`): no hace falta un clic extra.
  const codigo = await leerCodigoOtpDelPanel(page, persona.celular.slice(-3));
  await tipearOtpV4(page, codigo);
  await expect(page).toHaveURL(/\/preparacion$/, { timeout: 30_000 });
}

// ---------------------------------------------------------------------------
// 03B · Preparación y autorización inicial
// ---------------------------------------------------------------------------

export async function completarPreparacion(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/preparacion$/);
  await esperarHidratacion(page);
  await page.locator("#consentimiento-privacidad").check();
  await clickearHidratado(page.getByRole("button", { name: TEXTOS_03B.continuar, exact: true }));
  await expect(page).toHaveURL(/\/identidad$/);
}

// ---------------------------------------------------------------------------
// 03C · Identidad y correo
// ---------------------------------------------------------------------------

type TipoCapturaIdentidad = "FRENTE" | "DORSO" | "SELFIE";

/** La tarjeta de una captura (frente/dorso/selfie), acotada por su título. */
function tarjetaCapturaV4(page: Page, tipo: TipoCapturaIdentidad): Locator {
  return page.locator("div.rounded-xl.border.p-3", { hasText: TEXTOS_03C.tarjetas[tipo] });
}

/**
 * Una de las tres tomas de 03C, de punta a punta: abrir la cámara, disparar
 * (o confirmar el disparo automático) y usar la foto. Solo funciona con la
 * tarjeta **activa** (la primera todavía no validada): 03C no deja saltar el
 * orden frente → dorso → selfie.
 *
 * El disparo automático puede adelantarse y congelar la foto antes de que el
 * test toque el obturador; con la cámara falsa de Chromium el cuadro es plano
 * y en la práctica no pasa, pero el helper contempla las dos posibilidades.
 */
export async function tomarCapturaIdentidadV4(page: Page, tipo: TipoCapturaIdentidad): Promise<void> {
  const tarjeta = tarjetaCapturaV4(page, tipo);
  const botonAbrir = tarjeta.getByRole("button", {
    name: tipo === "SELFIE" ? TEXTOS_03C.botones.tomarSelfie : TEXTOS_03C.botones.tomarFotografia,
    exact: true,
  });
  await botonAbrir.click();

  const dialogo = page.getByRole("dialog");
  const obturador = dialogo.getByRole("button", {
    name: tipo === "SELFIE" ? "Tomar la selfie" : "Tomar la foto",
    exact: true,
  });
  const usar = dialogo.getByRole("button", { name: "Usar esta foto", exact: true });

  await expect(obturador.or(usar).first()).toBeVisible();
  if (await obturador.isVisible()) await obturador.click();
  await usar.click();
}

/** Espera a que la tarjeta de esa captura quede en `✓ VALIDADO`. */
export async function esperarCapturaValidadaV4(page: Page, tipo: TipoCapturaIdentidad): Promise<void> {
  await expect(
    tarjetaCapturaV4(page, tipo).getByText(TEXTOS_03C.estados.validado, { exact: true }),
  ).toBeVisible({ timeout: 15_000 });
}

/**
 * 03C, camino que aprueba: las tres tomas, el correo declarado dos veces y
 * `VALIDAR Y CONTINUAR`. Deja a la persona en `/datos`.
 */
export async function completarIdentidadAprobada(page: Page, persona: PersonaDemo): Promise<void> {
  await expect(page).toHaveURL(/\/identidad$/);
  await esperarHidratacion(page);

  await tomarCapturaIdentidadV4(page, "FRENTE");
  await esperarCapturaValidadaV4(page, "FRENTE");
  await tomarCapturaIdentidadV4(page, "DORSO");
  await esperarCapturaValidadaV4(page, "DORSO");
  await tomarCapturaIdentidadV4(page, "SELFIE");
  await esperarCapturaValidadaV4(page, "SELFIE");

  await page.getByLabel(TEXTOS_03C.etiquetaCorreo, { exact: true }).fill(persona.correo);
  await page.getByLabel(TEXTOS_03C.etiquetaCorreoRepetido, { exact: true }).fill(persona.correo);

  const validar = page.getByRole("button", { name: TEXTOS_03C.validar, exact: true });
  await expect(validar).toBeEnabled();
  await validar.click();
  await expect(page).toHaveURL(/\/datos$/, { timeout: 30_000 });
}

/**
 * 03C, camino de biometría rechazada: las tres tomas pasan la captura
 * individual (calidad + prueba de vida), el correo se declara, pero
 * `VALIDAR Y CONTINUAR` rechaza por coincidencia facial —el chequeo cruzado
 * contra el frente ocurre recién acá, no en la captura de la selfie—.
 * A propósito **no** navega a `/datos`.
 */
export async function completarCapturasIdentidadRechazada(page: Page, persona: PersonaDemo): Promise<void> {
  await expect(page).toHaveURL(/\/identidad$/);
  await esperarHidratacion(page);

  await tomarCapturaIdentidadV4(page, "FRENTE");
  await esperarCapturaValidadaV4(page, "FRENTE");
  await tomarCapturaIdentidadV4(page, "DORSO");
  await esperarCapturaValidadaV4(page, "DORSO");
  await tomarCapturaIdentidadV4(page, "SELFIE");
  await esperarCapturaValidadaV4(page, "SELFIE");

  await page.getByLabel(TEXTOS_03C.etiquetaCorreo, { exact: true }).fill(persona.correo);
  await page.getByLabel(TEXTOS_03C.etiquetaCorreoRepetido, { exact: true }).fill(persona.correo);

  const validar = page.getByRole("button", { name: TEXTOS_03C.validar, exact: true });
  await expect(validar).toBeEnabled();
  await validar.click();

  await expect(page.getByText(TEXTOS_03C.errores.COINCIDENCIA_FACIAL.titulo)).toBeVisible({
    timeout: 15_000,
  });
}

// ---------------------------------------------------------------------------
// 03D · Datos personales
// ---------------------------------------------------------------------------

/**
 * 03D, valores por defecto que no derivan a manual. El estado civil se
 * corrige siempre: el OCR/fixture trae formas como "Soltera" o "Casado", y el
 * catálogo aprobado usa "Soltero/a" / "Casado/a" — no coteja contra el
 * documento (D-31), así que hay que elegir uno del catálogo para que el
 * servidor no lo rechace.
 */
export async function completarDatosPersonalesV4(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/datos$/);
  await esperarHidratacion(page);

  // Los campos prellenados llegan por un `fetch` en `useEffect`: hay que
  // esperar a que el número de cédula deje de estar vacío antes de tocar nada.
  await expect(page.getByLabel(TEXTOS_03D.etiquetas.numeroCedula, { exact: true })).not.toHaveValue(
    "",
    { timeout: 15_000 },
  );

  // `verificarIdentidadV4` deja país de nacimiento y de residencia en "" hasta
  // esta pantalla, y el sexo no lo completa el OCR (CLAUDE.md → Convenciones):
  // los seis selectores se eligen a mano, aunque alguno venga prellenado, para
  // que `completo` no dependa de lo que trajo el mock de identidad.
  await elegirEnSelectorV4(page, TEXTOS_03D.etiquetas.sexo, "Femenino");
  await elegirEnSelectorV4(page, TEXTOS_03D.etiquetas.estadoCivil, "Soltero/a");
  await elegirEnSelectorV4(page, TEXTOS_03D.etiquetas.paisNacimiento, "Paraguay");
  await elegirEnSelectorV4(page, TEXTOS_03D.etiquetas.nacionalidad, "Paraguay");
  await elegirEnSelectorV4(page, TEXTOS_03D.etiquetas.paisResidencia, "Paraguay");
  await elegirEnSelectorV4(page, TEXTOS_03D.etiquetas.ciudad, "Asunción");
  await page.getByLabel(TEXTOS_03D.etiquetas.direccion, { exact: true }).fill("Avda. España 123");
  await page.getByLabel(TEXTOS_03D.etiquetas.barrio, { exact: true }).fill("Villa Morra");

  const continuar = page.getByRole("button", { name: TEXTOS_03D.continuar, exact: true });
  await expect(continuar).toBeEnabled();
  await continuar.click();
  await expect(page).toHaveURL(/\/actividad$/, { timeout: 30_000 });
}

// ---------------------------------------------------------------------------
// 03E · Actividad, ingresos y condición PEP
// ---------------------------------------------------------------------------

/**
 * 03E con valores que no derivan a manual, salvo `esPep`. Responder **Sí** a
 * la condición PEP no rechaza nada: deriva a `/revision-manual` — quien lo
 * garantiza es el grafo de estados (`DERIVADO_MANUAL` no tiene salidas), no
 * esta pantalla.
 */
export async function completarActividadV4(
  page: Page,
  opciones: { readonly esPep: boolean } = { esPep: false },
): Promise<void> {
  await expect(page).toHaveURL(/\/actividad$/);
  await esperarHidratacion(page);

  await elegirEnSelectorV4(page, TEXTOS_03E.etiquetas.situacionLaboral, "Empleado (dependiente)");
  await elegirEnSelectorV4(page, TEXTOS_03E.etiquetas.actividadEconomica, "Servicios financieros y seguros");
  await elegirEnSelectorV4(page, TEXTOS_03E.etiquetas.ocupacion, "Empleado administrativo");
  await elegirEnSelectorV4(page, TEXTOS_03E.etiquetas.profesion, "Contador");
  await page.getByLabel(TEXTOS_03E.etiquetas.empresa, { exact: true }).fill("Estudio Contable SRL");
  await page.getByLabel(TEXTOS_03E.etiquetas.ingreso, { exact: true }).fill("8000000");
  await elegirEnSelectorV4(page, TEXTOS_03E.etiquetas.origenIngresos, "Salario");

  const grupoPep = page.getByRole("group", { name: TEXTOS_03E.preguntaPep, exact: true });
  await grupoPep.getByRole("button", { name: opciones.esPep ? "SÍ" : "NO", exact: true }).click();

  const continuar = page.getByRole("button", { name: TEXTOS_03E.continuar, exact: true });
  await expect(continuar).toBeEnabled();
  await continuar.click();

  if (opciones.esPep) {
    await expect(page).toHaveURL(/\/revision-manual$/, { timeout: 30_000 });
  } else {
    await expect(page).toHaveURL(/\/declaraciones$/, { timeout: 30_000 });
  }
}

// ---------------------------------------------------------------------------
// 04A · Datos y declaraciones (tres preguntas de salud + beneficiario, D-33)
// ---------------------------------------------------------------------------

/**
 * Responde las **tres** declaraciones de salud tal como están en el fixture de
 * la persona (`personas.ts`) y completa el beneficiario, sin decidir acá qué
 * deriva o no: esa regla la aplica siempre el servidor
 * (`registrarDeclaracionesSalud`).
 */
export async function completarDeclaracionesV4(
  page: Page,
  persona: PersonaDemo,
  destinoEsperado: RegExp,
): Promise<void> {
  await expect(page).toHaveURL(/\/declaraciones$/);
  await esperarHidratacion(page);

  for (const pregunta of TEXTOS_04A.preguntas) {
    const clave = pregunta.clave as keyof PersonaDemo["declaraciones"];
    const esSi = persona.declaraciones[clave] === "SI";
    const grupo = page.getByRole("group", { name: pregunta.texto, exact: true });
    await grupo.getByRole("button", { name: esSi ? "SÍ" : "NO", exact: true }).click();
  }

  if (persona.beneficiario.tipo === "PERSONA_DESIGNADA") {
    await page.getByRole("radio", { name: TEXTOS_04A.opciones.designada, exact: true }).check();
    await page
      .getByLabel(TEXTOS_04A.etiquetas.nombre, { exact: true })
      .fill(persona.beneficiario.nombreCompleto ?? "");
    await page
      .getByLabel(TEXTOS_04A.etiquetas.domicilio, { exact: true })
      .fill(persona.beneficiario.domicilio ?? "");
    await elegirEnSelectorV4(page, TEXTOS_04A.etiquetas.parentesco, persona.beneficiario.parentesco ?? "");
  }

  const continuar = page.getByRole("button", { name: TEXTOS_04A.continuar, exact: true });
  await expect(continuar).toBeEnabled();
  await continuar.click();
  await expect(page).toHaveURL(destinoEsperado, { timeout: 30_000 });
}

// ---------------------------------------------------------------------------
// 04D · Consentimientos (única puerta a DECLARACIONES_OK)
// ---------------------------------------------------------------------------

export async function completarConsentimientosV4(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/consentimientos$/);
  await esperarHidratacion(page);
  await page.locator("#consentimiento-entrega").check();
  await page.locator("#consentimiento-cobertura").check();

  const continuar = page.getByRole("button", { name: TEXTOS_04D.continuar, exact: true });
  await expect(continuar).toBeEnabled();
  await continuar.click();
  await expect(page).toHaveURL(/\/firma$/);
}

// ---------------------------------------------------------------------------
// 04E · Revisá, aceptá y firmá (firma interna del cliente, D1)
// ---------------------------------------------------------------------------

/**
 * Espera a que el paquete documental se cierre y la pantalla muestre el
 * bloque de elección de canal. Margen largo: acá el servidor cierra el PDF,
 * lo hashea y lo guarda antes de responder (`GET /api/p8/resumen`).
 */
export async function abrirBloqueCodigoFirma(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/firma$/);
  await esperarHidratacion(page);
  await expect(page.getByRole("heading", { name: TEXTOS_04E.bloque1Titulo, exact: true })).toBeVisible({
    timeout: 60_000,
  });
}

/** Pide el código de firma por WhatsApp (el único canal que usan los fixtures de prueba). */
export async function enviarCodigoFirmaPorWhatsappV4(page: Page): Promise<void> {
  const enviar = page.getByRole("button", { name: /^Enviar por WhatsApp/ });
  await clickearHidratado(enviar);
  await expect(page.getByText(/^Enviamos (un|un nuevo) código de firma a/)).toBeVisible({
    timeout: 15_000,
  });
}

/** Tipea el código de firma. Las casillas firman solas al completar el sexto dígito. */
export async function firmarConCodigoV4(page: Page, codigo: string): Promise<void> {
  await tipearOtpV4(page, codigo);
}

/**
 * 04E de punta a punta con el código real leído del panel. Con la enmienda
 * del 04-sep-2026 a D-08 (D-38), `FIRMADO_CLIENTE` ya habilita el pago: no
 * hay ninguna firma institucional que esperar acá. Deja a la persona en
 * `/pago`.
 */
export async function completarFirmaV4(page: Page, persona: PersonaDemo): Promise<void> {
  await abrirBloqueCodigoFirma(page);
  await enviarCodigoFirmaPorWhatsappV4(page);

  const codigo = await leerCodigoOtpDelPanel(page, persona.celular.slice(-3));
  await firmarConCodigoV4(page, codigo);
  await expect(page).toHaveURL(/\/pago$/, { timeout: 60_000 });
}

// ---------------------------------------------------------------------------
// 05A · Realizá el pago (D-08: después de firmar; D-32: 10 minutos)
// ---------------------------------------------------------------------------

/**
 * Paga con QR Bancard y espera la acreditación. El medio **no** viene
 * preseleccionado en v4 (a diferencia de v2, que heredaba QR por defecto):
 * hay que elegirlo. Al confirmarse el pago, la propia pantalla navega sola a
 * `/confirmacion` 900 ms después.
 */
export async function completarPagoQrV4(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/pago$/);
  await esperarHidratacion(page);

  await page.getByRole("radio", { name: "Elegir QR Bancard", exact: true }).click();
  await page.locator("#acepta-certificado").check();
  await page.getByRole("button", { name: "GENERAR QR BANCARD", exact: true }).click();
  await expect(page.getByText(TEXTOS_05A.qrTitulo)).toBeVisible();

  // El botón *PAGADO* de demostración se habilita a los 5 s, simulando el
  // tiempo de escanear y pagar. `toBeEnabled` espera con el auto-retry de
  // Playwright: no hace falta un `waitForTimeout`.
  const pagado = page.getByRole("button", { name: TEXTOS_05A.botonPagadoDemo, exact: true });
  await expect(pagado).toBeEnabled({ timeout: 15_000 });
  await pagado.click();

  await expect(page.getByText(TEXTOS_05A.pagoAcreditadoTitulo, { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page).toHaveURL(/\/confirmacion$/, { timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// 05B · Contratación confirmada
// ---------------------------------------------------------------------------

/**
 * Lee el valor a la derecha de una etiqueta de fila (`<span>etiqueta</span>
 * <span>valor</span>`), esperando a que deje de mostrar el `—` inicial. Sirve
 * tanto para el número de propuesta de 05B como para el número de caso de la
 * Pantalla A (`PantallaRevisionManual`), que comparten la misma gramática.
 */
export async function leerValorDeFilaV4(page: Page, etiqueta: string): Promise<string> {
  const etiquetaLocator = page.getByText(etiqueta, { exact: true });
  await expect(etiquetaLocator).toBeVisible();
  const valor = etiquetaLocator.locator("xpath=following-sibling::span[1]");
  await expect(valor).not.toHaveText("—", { timeout: 20_000 });
  return (await valor.textContent())?.trim() ?? "";
}

/** El correlativo de ocho dígitos que muestra 05B junto a "N.º de propuesta". */
export async function leerCorrelativoPropuestaV4(page: Page): Promise<string> {
  const correlativo = await leerValorDeFilaV4(page, TEXTOS_05B.etiquetaPropuesta);
  expect(correlativo).toMatch(/^\d{8}$/);
  return correlativo;
}

/** El número de caso que muestra la Pantalla A junto a "N.º de caso". */
export async function leerNumeroCasoV4(page: Page): Promise<string> {
  return leerValorDeFilaV4(page, TEXTOS_REVISION_MANUAL.etiquetaCaso);
}
