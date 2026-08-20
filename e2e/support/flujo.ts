/**
 * Helpers de un paso por pantalla del flujo P0–P9, para no repetir selectores
 * en cada escenario. Cada función usa los textos reales de
 * `docs/ESPECIFICACION_PANTALLAS.md` (ya verificados leyendo los componentes
 * de `src/app/(flujo)/`), nunca textos inventados.
 *
 * Ninguna función de acá lee un código OTP de una respuesta de la API del
 * flujo: siempre pasa por `leerCodigoOtpDelPanel` / `leerSesionFirmaDelPanel`
 * (`demo-panel.ts`), que es el único lugar donde el código existe en claro
 * (regla inviolable #2).
 */
import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { PersonaDemo } from "@/adapters/mock/personas";
import { enmascararCelular } from "@/domain/telefono";
import { accionarFirmaPanel, leerCodigoOtpDelPanel, leerSesionFirmaDelPanel } from "./demo-panel";

/** `+595981000123` → `981000123`, lo que se tipea en el campo de P1. */
export function celularLocal(persona: PersonaDemo): string {
  return persona.celular.replace("+595", "");
}

async function tipearOtp(page: Page, idPrefijo: string, codigo: string): Promise<void> {
  for (let i = 0; i < codigo.length; i += 1) {
    await page.locator(`#${idPrefijo}-otp-${i}`).fill(codigo[i]);
  }
}

/**
 * Espera a que la pantalla recién llegada por una navegación del lado del
 * cliente (`next/link`) termine de hidratarse antes de interactuar.
 *
 * Hallazgo empírico: `toHaveURL` cambia apenas el router actualiza la URL,
 * pero el chunk JS del componente cliente de la pantalla nueva puede seguir
 * cargando — un `.click()` inmediato encuentra el botón (ya está en el DOM
 * por SSR) pero cae antes de que React adjunte el handler, y el clic se
 * pierde en silencio. `page.goto()` no lo necesita (ya espera `load`); esto
 * es solo para las transiciones que arrancan con `<Link>`/`router.push`.
 */
export async function esperarHidratacion(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");

  // `networkidle` dice que dejó de haber pedidos, no que React ya montó. En esa
  // ventana los controles existen —los pintó el SSR— pero todavía no tienen
  // handler, y la interacción se pierde **en silencio**: el clic no hace nada,
  // el radio no cambia de estado, y lo que se ve después es una aserción
  // agotando su plazo con el dedo apuntando al código.
  //
  // La señal que se usa es exacta y no temporal: React 18 cuelga sus
  // propiedades internas (`__reactProps$…`, `__reactFiber$…`) de los nodos al
  // hidratarlos. Que alguna aparezca sobre un control de la pantalla significa
  // que el árbol de cliente ya montó. No hace falta tocar código de producción
  // para saberlo: la señal ya está ahí, solo hay que mirarla.
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
 *
 * `networkidle` dice que dejó de haber pedidos, no que React ya montó. En esa
 * ventana el botón existe —lo pintó el SSR— pero todavía no tiene handler, y
 * el clic se pierde **en silencio**: no falla nada, simplemente no pasa nada,
 * y lo que se ve después es una aserción de navegación agotando su plazo a los
 * quince segundos. Un margen fijo tapa el problema la mayoría de las veces y
 * lo deja aparecer justo cuando la máquina está cargada, que es la peor forma
 * de fallar: intermitente y con el dedo apuntando al código.
 *
 * La señal que se usa acá es exacta en lugar de temporal. React 18 cuelga sus
 * propiedades internas (`__reactProps$…`, `__reactFiber$…`) del nodo del DOM
 * al hidratarlo; que existan sobre este botón significa que este botón ya
 * tiene su handler. No se toca código de producción para lograrlo: la señal
 * ya está ahí, solo hay que mirarla.
 *
 * Se prefiere esperar antes que reintentar el clic: estos botones hacen un
 * POST que transiciona el expediente, y un segundo clic mandaría una petición
 * que el dominio rechazaría por estado inválido — cambiaría un test frágil por
 * uno que ensucia el expediente.
 */
export async function clickearHidratado(boton: Locator): Promise<void> {
  await boton.waitFor({ state: "visible" });
  await expect
    .poll(
      // `evaluate` sobre el localizador y no `querySelector` con el selector:
      // los selectores de Playwright (`:has-text`, `:text-is`) no son CSS
      // válido y el navegador los rechaza. Acá el nodo ya viene resuelto.
      async () => boton.evaluate((nodo) => Object.keys(nodo).some((c) => c.startsWith("__react"))),
      { timeout: 15_000, message: "el botón nunca terminó de hidratarse" },
    )
    .toBe(true);
  await boton.click();
}


/**
 * Paso 2 (`Pv2-2`) — Verificación de WhatsApp. Deja a la persona en
 * /preparacion.
 *
 * Los helpers se nombran por pantalla y no por número desde CHG-01: el número
 * es una propiedad de la posición y ya cambió una vez. `completarWhatsapp`
 * seguirá diciendo la verdad cuando el paso se mueva otra vez.
 */
export async function completarWhatsapp(page: Page, persona: PersonaDemo): Promise<void> {
  await expect(page).toHaveURL(/\/whatsapp$/);
  // Antes este paso empezaba con un `goto` propio; ahora se llega navegando
  // desde el catálogo, así que hay que esperar la hidratación como en el resto
  // de las pantallas: sin React montado, marcar la casilla no cambia el estado
  // y el botón de enviar se queda deshabilitado para siempre.
  await esperarHidratacion(page);
  await page.locator("#p1-destino").fill(celularLocal(persona));
  await page.getByRole("checkbox").check();
  // `exact: true`: "Enviar código" es substring de "Reenviar código", que ya
  // está en el DOM (deshabilitado) antes de enviar el primero.
  await clickearHidratado(page.getByRole("button", { name: "Enviar código", exact: true }));

  const destinoEnmascarado = enmascararCelular(persona.celular);
  await expect(page.getByText(`Código enviado al número ${destinoEnmascarado}`)).toBeVisible();

  const codigo = await leerCodigoOtpDelPanel(page, persona.celular.slice(-3));
  await tipearOtp(page, "p1", codigo);
  await expect(page.getByRole("button", { name: "Verificar WhatsApp", exact: true })).toBeDisabled();

  const continuar = page.getByRole("link", { name: "Continuar →" });
  await expect(continuar).not.toHaveAttribute("aria-disabled", "true");
  await continuar.click();
  await expect(page).toHaveURL(/\/preparacion$/);
}

/**
 * P2 · Paso 2 de 9 — Selección de plan.
 *
 * Las tres tarjetas de plan se ubican en el mismo orden en el que están
 * declaradas en `src/domain/catalogo.ts` (CONFÍO, CONFÍO+, CONFÍO TOTAL), sin
 * reordenarse en pantalla — se identifica la tarjeta por posición y no por su
 * rótulo, porque "CONFÍO" es substring de los otros dos nombres y filtrar por
 * texto es frágil acá.
 */
const ORDEN_PLANES: readonly PersonaDemo["planElegido"][] = ["CONFIO", "CONFIO_PLUS", "CONFIO_TOTAL"];
const ROTULO_PLAN: Readonly<Record<PersonaDemo["planElegido"], string>> = {
  CONFIO: "CONFÍO",
  CONFIO_PLUS: "CONFÍO+",
  CONFIO_TOTAL: "CONFÍO TOTAL",
};

export async function completarPlan(page: Page, persona: PersonaDemo): Promise<void> {
  // Primer paso del flujo: acá empieza el recorrido y acá nace el expediente.
  await page.goto("/plan");
  await esperarHidratacion(page);
  const indice = ORDEN_PLANES.indexOf(persona.planElegido);
  expect(indice, `Plan desconocido: ${persona.planElegido}`).toBeGreaterThanOrEqual(0);
  const rotulo = ROTULO_PLAN[persona.planElegido];

  const tarjeta = page.getByRole("article").nth(indice);
  await expect(tarjeta.getByRole("heading", { name: rotulo, exact: true })).toBeVisible();
  await tarjeta.getByRole("button", { name: /^(Seleccionar|Plan elegido)$/ }).click();
  await expect(tarjeta.getByRole("button", { name: "Plan elegido", exact: true })).toBeVisible();

  await page.getByRole("button", { name: `Seleccionar ${rotulo} y continuar →`, exact: true }).click();
  await expect(page).toHaveURL(/\/whatsapp$/);
}

/** Paso 3 (`Pv2-3`) — Preparación y autorización inicial. */
export async function completarPreparacion(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/preparacion$/);
  await esperarHidratacion(page);
  await clickearHidratado(page.getByRole("button", { name: "Tengo todo listo →" }));
  await expect(page).toHaveURL(/\/identidad$/);
}

/**
 * Declara el correo dentro de la pantalla de identidad (CHG-14/17, D-06).
 *
 * Reemplaza al viejo `completarP4`: el correo dejó de tener paso propio y de
 * tener código. Lo que queda es escribirlo dos veces, que es el control que
 * sustituye al OTP.
 */
export async function declararCorreo(page: Page, persona: PersonaDemo): Promise<void> {
  await expect(page).toHaveURL(/\/identidad$/);
  await esperarHidratacion(page);
  await page.locator("#p5-correo").fill(persona.correo);
  await page.locator("#p5-correo-repetido").fill(persona.correo);
  await expect(page.getByText("Las dos direcciones coinciden.")).toBeVisible();
}

/**
 * Una de las tres tomas de P5, de punta a punta: abrir el visor, disparar y
 * confirmar la foto.
 *
 * Son tres pasos y no uno desde que el visor tiene revisión previa
 * (`CapturaConCamara`): encuadrar → revisar → mandar. La confirmación es lo que
 * evita que una foto movida llegue al proveedor sin que nadie la haya mirado, y
 * por eso el helper la atraviesa en vez de saltearla.
 *
 * El disparo automático puede adelantarse y congelar la foto antes de que el
 * test toque el obturador. Con la cámara falsa de Chrome el cuadro es plano y
 * la medición de calidad no lo da por apto, así que en la práctica no pasa —
 * pero el helper contempla las dos posibilidades para no depender de una
 * propiedad del video sintético.
 */
async function tomarCapturaP5(page: Page, toma: "FRENTE" | "DORSO" | "SELFIE"): Promise<void> {
  const enTarjeta =
    toma === "SELFIE"
      ? page.getByRole("button", { name: "Tomar selfie", exact: true })
      : page.getByRole("button", { name: "Tomar fotografía", exact: true }).first();
  await enTarjeta.click();

  const obturador = page.getByRole("button", {
    name: toma === "SELFIE" ? "Tomar la selfie" : "Tomar la foto",
    exact: true,
  });
  const usar = page.getByRole("button", { name: "Usar esta foto", exact: true });

  await expect(obturador.or(usar).first()).toBeVisible();
  if (await obturador.isVisible()) await obturador.click();
  await usar.click();
}

/**
 * P5 · Paso 5 de 9 — Verificación de identidad, camino que aprueba (frente,
 * dorso y selfie aprobadas, país y estado civil completos). Deja a la persona
 * en /declaraciones.
 */
export async function completarP5Aprobado(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/identidad$/);
  await esperarHidratacion(page);

  await tomarCapturaP5(page, "FRENTE");
  await expect(page.getByText("Aprobada", { exact: true })).toHaveCount(1);

  await tomarCapturaP5(page, "DORSO");
  await expect(page.getByText("Aprobada", { exact: true })).toHaveCount(2);

  await tomarCapturaP5(page, "SELFIE");

  await expect(
    page.getByText("Datos extraídos de la cédula y confirmados con la selfie en vivo."),
  ).toBeVisible();

  await page.getByLabel(/Autorizo la captura y comparación/).check();
  await page.locator("#p5-pais").selectOption("Paraguay");
  await page.locator("#p5-estado-civil").selectOption("Soltero/a");

  const continuar = page.getByRole("button", { name: "Validar identidad y continuar →" });
  await expect(continuar).toBeEnabled();
  await continuar.click();
  await expect(page).toHaveURL(/\/declaraciones$/);
}

/**
 * P5, camino de biometría rechazada: la selfie no coincide con la cédula.
 * A propósito **no** navega a P6 — es lo que el escenario 4 tiene que probar.
 */
export async function completarCapturasP5(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/identidad$/);
  await esperarHidratacion(page);
  await tomarCapturaP5(page, "FRENTE");
  await expect(page.getByText("Aprobada", { exact: true })).toHaveCount(1);
  await tomarCapturaP5(page, "DORSO");
  await expect(page.getByText("Aprobada", { exact: true })).toHaveCount(2);
  await tomarCapturaP5(page, "SELFIE");
  // La comparación facial rechaza: el aviso rojo de P5 avisa que hay que
  // repetir la captura, nunca editar los campos a mano.
  await expect(
    page.getByText("La selfie no coincide con la fotografía de la cédula.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel(/Autorizo la captura y comparación/).check();
  await page.locator("#p5-pais").selectOption("Paraguay");
  await page.locator("#p5-estado-civil").selectOption("Soltero/a");
}

interface DeclaracionesTexto {
  readonly numero: number;
  readonly titulo: string;
}

/** Las ocho declaraciones de P6, en el orden y con el texto de `textos-p6.ts`. */
export const DECLARACIONES_TEXTO: readonly DeclaracionesTexto[] = [
  { numero: 1, titulo: "Estado de salud" },
  { numero: 2, titulo: "Antecedentes de contratación" },
  { numero: 3, titulo: "Enfermedades diagnosticadas" },
  { numero: 4, titulo: "Vigencia y carencias" },
  { numero: 5, titulo: "Veracidad" },
  { numero: 6, titulo: "Entrega digital" },
  { numero: 7, titulo: "Corredor de la póliza" },
  { numero: 8, titulo: "Condición PEP" },
];

const CAMPO_DECLARACION: readonly (keyof PersonaDemo["declaraciones"])[] = [
  "estadoDeSalud",
  "antecedentesDeContratacion",
  "enfermedadesDiagnosticadas",
  "vigenciaYCarencias",
  "veracidad",
  "entregaDigital",
  "corredorDeLaPoliza",
  "condicionPep",
];

/**
 * P6 · Paso 6 de 9 — Datos y declaraciones. Completa el bloque 1 con los
 * datos complementarios de la persona y responde las ocho declaraciones tal
 * como están en su fixture (`personas.ts`), sin decidir acá qué habilita o
 * bloquea: esa regla la aplica siempre el servidor.
 */
export async function completarP6(page: Page, persona: PersonaDemo): Promise<void> {
  await expect(page).toHaveURL(/\/declaraciones$/);
  await esperarHidratacion(page);
  const datos = persona.datosComplementarios;

  await page.locator("#p6-domicilio").fill(datos.domicilio);
  await page.locator("#p6-ciudad").selectOption(datos.ciudad);
  await page.locator("#p6-situacion-laboral").selectOption(datos.situacionLaboral);
  await page.locator("#p6-actividad").selectOption(datos.actividad);
  await page.locator("#p6-profesion").selectOption(datos.profesion);
  if (datos.empresa) await page.locator("#p6-empresa").fill(datos.empresa);
  await page.locator("#p6-ingreso").fill(String(datos.ingresoMensualDeclaradoGs));

  if (datos.beneficiario.tipo === "PERSONA_DESIGNADA") {
    await page.getByRole("radio", { name: "Designar una persona — 100%" }).check();
    await page.locator("#p6-benef-nombre").fill(datos.beneficiario.nombreCompleto ?? "");
    await page.locator("#p6-benef-parentesco").selectOption(datos.beneficiario.parentesco ?? "");
    await page.locator("#p6-benef-domicilio").fill(datos.beneficiario.domicilio ?? "");
  }

  for (const [indice, campo] of CAMPO_DECLARACION.entries()) {
    const { numero, titulo } = DECLARACIONES_TEXTO[indice];
    const respuesta = persona.declaraciones[campo];
    const opcion = respuesta === "SI" ? "Sí" : "No";
    // `force: true`: el patrón accesible de estos radios es un <input> real
    // pero visualmente oculto (`sr-only`) dentro de un <label> que es lo que
    // se ve; Playwright detecta al label como el que "intercepta" el click
    // sobre el input. Es el patrón que la propia documentación de Playwright
    // recomienda para checkboxes/radios estilizados así: el estado marcado
    // se verifica igual (`.check()` espera `checked`), lo que se salta es el
    // chequeo de accionabilidad visual del <input> en sí, no la interacción.
    await page.getByRole("radio", { name: `${numero}. ${titulo}: ${opcion}` }).check({ force: true });
  }
}

/** Envía el formulario de P6 y espera terminar en el destino esperado. */
export async function enviarP6(page: Page, destinoEsperado: RegExp): Promise<void> {
  const continuar = page.getByRole("button", { name: "Guardar y continuar →" });
  await expect(continuar).toBeEnabled();
  await continuar.click();
  await expect(page).toHaveURL(destinoEsperado, { timeout: 20_000 });
}

/**
 * P7 · Paso 7 de 9 — Facturación y garantía de pago, con QR Bancard. Deja a
 * la persona en /pago, pago confirmado.
 *
 * **No confía en el sondeo del propio cliente para confirmar el pago.**
 * Hallazgo al correr esta batería contra el stack real: `FormularioPagoP7`
 * (`src/app/(flujo)/pago/FormularioPagoP7.tsx`, función `sondear`) deja de
 * sondear apenas `GET /api/p7/estado` responde una vez con `ok:false` —
 * incluida una respuesta transitoria de `PAGO_NO_INICIADO` (fila cerca del
 * borde de `DEMORA_ACREDITACION_MS`, `src/domain/pago-p7.ts:585-588`, cuando
 * `consultarEstadoPago` todavía no encuentra la operación) — y no vuelve a
 * reintentar sola: la pantalla se queda mostrando el QR sin llegar nunca a
 * "Pago acreditado", aunque el pago sí termine confirmándose del lado del
 * servidor. Se reprodujo así, de punta a punta, en 2 de 2 corridas contra
 * AWS real.
 *
 * Para no acoplar el resto del escenario a ese límite de la UI, se sondea acá
 * la verdad del servidor directamente (`GET /api/p7/estado`, con reintentos
 * propios) y recién al confirmarse se recarga la pantalla una vez para leer
 * el estado real ya asentado.
 */
export async function completarP7Qr(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/pago$/);
  await esperarHidratacion(page);
  await page.getByLabel(/Declaro que los fondos utilizados/).check();
  await page.getByRole("button", { name: "GENERAR QR BANCARD" }).click();
  await expect(page.getByText("Escaneá el QR con tu app de banco")).toBeVisible();

let ultimaRespuestaDiagnostico = "";
  await expect(async () => {
    const respuesta = await page.request.get("/api/p7/estado");
    const texto = await respuesta.text();
    ultimaRespuestaDiagnostico = `status=${respuesta.status()} body=${texto}`;
    const datos = JSON.parse(texto || "{}") as { ok?: boolean; confirmado?: boolean };
    expect(datos.ok === true && datos.confirmado === true, ultimaRespuestaDiagnostico).toBe(true);
  }).toPass({ timeout: 30_000, intervals: [1_000] });

  await page.reload();
  await expect(page.getByRole("heading", { name: "Pago acreditado" })).toBeVisible();
}

export async function continuarAFirma(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Continuar a firma →" }).click();
  await expect(page).toHaveURL(/\/firma$/);
}

/**
 * P8 · Paso 8 de 9 — envía el enlace de firma por WhatsApp y abre el "otro
 * lado" (el panel de demo haciendo de Code100). No firma: eso lo hacen
 * `firmarNormalmente` / `firmarConFallaAMitad` de abajo, según el escenario.
 */
export async function enviarEnlaceYAbrir(page: Page): Promise<string> {
  await expect(page).toHaveURL(/\/firma$/);
  await esperarHidratacion(page);
  await expect(page.getByRole("heading", { name: "GARANTÍA DE PAGO LISTA" })).toBeVisible();

  await page.getByRole("button", { name: "ENVIAR ENLACE SEGURO DE FIRMA" }).click();
  await expect(
    page.getByText("Enviamos el enlace de firma a tu canal verificado.", { exact: false }),
  ).toBeVisible();

  const idMatch = await page.getByText(/^ID MOCK-CODE100-/).textContent();
  const idCode100 = (idMatch ?? "").replace(/^ID\s*/, "").trim();
  expect(idCode100, "No se encontró el ID de Code100 en la pantalla de P8.").not.toBe("");

  const abierto = await accionarFirmaPanel(page, idCode100, { accion: "ABRIR" });
  expect(abierto.ok, `abrir enlace de firma: ${JSON.stringify(abierto.datos)}`).toBeTruthy();

  return idCode100;
}

/** Firma normalmente con el código real leído del panel; espera terminar en P9. */
export async function firmarNormalmente(page: Page, idCode100: string): Promise<void> {
  const sesion = await leerSesionFirmaDelPanel(page, idCode100);
  expect(sesion.codigo, "El panel no tiene código de firma para esta sesión.").not.toBeNull();

  const resultado = await accionarFirmaPanel(page, idCode100, {
    accion: "FIRMAR",
    codigo: sesion.codigo as string,
  });
  expect(resultado.ok, `firmar: ${JSON.stringify(resultado.datos)}`).toBeTruthy();

  await expect(page).toHaveURL(/\/confirmacion$/, { timeout: 20_000 });
}
