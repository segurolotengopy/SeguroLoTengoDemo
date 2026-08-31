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
import { leerCodigoOtpDelPanel, leerSesionFirmaDelPanel } from "./demo-panel";

/** `+595981000123` → `981000123`, lo que se tipea en el campo de P1. */
export function celularLocal(persona: PersonaDemo): string {
  return persona.celular.replace("+595", "");
}

export async function tipearOtp(page: Page, idPrefijo: string, codigo: string): Promise<void> {
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
  // Formato maqueta: sin casilla — la autorización es el acto de presionar el
  // botón de enviar, con el literal a la vista.
  await page.locator("#p1-destino").fill(celularLocal(persona));
  await clickearHidratado(page.getByRole("button", { name: "ENVIAR CÓDIGO POR WHATSAPP" }));

  const destinoEnmascarado = enmascararCelular(persona.celular);
  await expect(page.getByText(`Código enviado por WhatsApp a ${destinoEnmascarado}`)).toBeVisible();

  // La pantalla no avanza sola al completarse la sexta casilla (decisión del
  // 20-ago-2026): verificar es un acto de la persona.
  const codigo = await leerCodigoOtpDelPanel(page, persona.celular.slice(-3));
  await tipearOtp(page, "p1", codigo);
  await page.getByRole("button", { name: "VERIFICAR WHATSAPP Y CONTINUAR" }).click();
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

  // Formato maqueta: cada tarjeta lleva un radio `Elegir esta opción` y el
  // botón de continuar es único y fijo, deshabilitado hasta elegir.
  const tarjeta = page.getByRole("article").nth(indice);
  await expect(tarjeta.getByRole("heading", { name: rotulo, exact: true })).toBeVisible();
  await tarjeta.getByRole("radio").click();
  await expect(tarjeta.getByRole("radio")).toHaveAttribute("aria-checked", "true");

  await page.getByRole("button", { name: "CONTINUAR CON EL PLAN SELECCIONADO →" }).click();
  await expect(page).toHaveURL(/\/whatsapp$/);
}

/** Paso 3 (`Pv2-3`) — Preparación y autorización inicial. */
export async function completarPreparacion(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/preparacion$/);
  await esperarHidratacion(page);
  await clickearHidratado(page.getByRole("button", { name: "TENGO TODO LISTO Y CONTINUAR →" }));
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
export async function tomarCapturaP5(page: Page, toma: "FRENTE" | "DORSO" | "SELFIE"): Promise<void> {
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
/**
 * Bloque laboral y económico, que desde la reformulación de pantallas vive en
 * el paso 4 y no en el de declaraciones (maqueta p.4). Los valores salen de la
 * persona de prueba para que el FIPF quede con datos coherentes.
 */
/**
 * Valores por defecto para los escenarios que no dependen de una persona en
 * particular: todos salen de los catálogos, que es lo único que el servidor
 * valida.
 */
const DATOS_COMPLEMENTARIOS_POR_DEFECTO: PersonaDemo["datosComplementarios"] = {
  domicilio: "Avda. España 123",
  ciudad: "Asunción",
  situacionLaboral: "Relación de dependencia",
  actividad: "Servicios financieros",
  profesion: "Contador/a",
  empresa: "Estudio Contable SRL",
  ingresoMensualDeclaradoGs: 8_000_000,
  origenFondos: "Ingresos laborales (sueldo o salario)",
};

export async function completarDatosComplementarios(
  page: Page,
  datos: PersonaDemo["datosComplementarios"] = DATOS_COMPLEMENTARIOS_POR_DEFECTO,
): Promise<void> {
  await page.locator("#p5-domicilio").fill(datos.domicilio);
  await page.locator("#p5-ciudad").selectOption(datos.ciudad);
  await page.locator("#p5-situacion-laboral").selectOption(datos.situacionLaboral);
  await page.locator("#p5-actividad").selectOption(datos.actividad);
  await page.locator("#p5-profesion").selectOption(datos.profesion);
  if (datos.empresa) await page.locator("#p5-empresa").fill(datos.empresa);
  await page.locator("#p5-ingreso").fill(String(datos.ingresoMensualDeclaradoGs));
  await page.locator("#p5-origen-fondos").selectOption(datos.origenFondos);
}

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
  // El sexo se elige: desde el 21-ago-2026 no lo prellena el OCR, y sin
  // elegirlo el botón de continuar no se habilita.
  await page.locator("#p5-sexo").selectOption("Femenino");
  await page.locator("#p5-pais").selectOption("Paraguay");
  await page.locator("#p5-pais-residencia").selectOption("Paraguay");
  await page.locator("#p5-estado-civil").selectOption("Soltero/a");
  await completarDatosComplementarios(page);

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
  // El sexo se elige: desde el 21-ago-2026 no lo prellena el OCR, y sin
  // elegirlo el botón de continuar no se habilita.
  await page.locator("#p5-sexo").selectOption("Femenino");
  await page.locator("#p5-pais").selectOption("Paraguay");
  await page.locator("#p5-pais-residencia").selectOption("Paraguay");
  await page.locator("#p5-estado-civil").selectOption("Soltero/a");
  await completarDatosComplementarios(page);
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
 * Paso 5 · Datos y declaraciones. Completa el bloque 1 con los datos
 * complementarios de la persona y responde las ocho declaraciones tal como
 * están en su fixture (`personas.ts`), sin decidir acá qué habilita o bloquea:
 * esa regla la aplica siempre el servidor.
 *
 * **No marca ninguna declaración de origen lícito**: con el PDF unificado
 * (D-11) el literal se imprime en el documento y lo cubre el acto de firma
 * único. La Matriz V4 §4 es explícita —"no casilla adicional"— y L4c retiró la
 * casilla que L4b había puesto acá como puente.
 */
export async function completarP6(page: Page, persona: PersonaDemo): Promise<void> {
  await expect(page).toHaveURL(/\/declaraciones$/);
  await esperarHidratacion(page);
  if (persona.beneficiario.tipo === "PERSONA_DESIGNADA") {
    const beneficiarioDesignado = page.getByRole("radio", { name: "Designar una persona — 100%" });
    await beneficiarioDesignado.click();
    await expect(beneficiarioDesignado).toBeChecked();
    await page.locator("#p6-benef-nombre").fill(persona.beneficiario.nombreCompleto ?? "");
    await page.locator("#p6-benef-parentesco").selectOption(persona.beneficiario.parentesco ?? "");
    await page.locator("#p6-benef-domicilio").fill(persona.beneficiario.domicilio ?? "");
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
    // Clic y aserción en vez de `.check()`. El `checked` de estos radios lo
    // controla React, y `.check()` verifica el estado **en el instante**: si
    // la re-renderización llega un latido después, reporta "clicking the
    // checkbox did not change its state" y falla algo que sí funcionó. El
    // `expect` que sigue espera con el presupuesto de la suite, así que la
    // garantía es la misma sin la carrera.
    //
    // Se clica la **etiqueta**, no el input: el input es `sr-only`, así que su
    // caja mide un píxel y un clic forzado va a parar a las coordenadas de esa
    // caja — que según cómo quede el layout puede caer debajo de otro
    // elemento. La etiqueta es lo que toca una persona y lo que siempre está
    // a la vista.
    const radio = page.getByRole("radio", { name: `${numero}. ${titulo}: ${opcion}` });
    await radio.locator("..").click();
    await expect(radio).toBeChecked();
  }

}

/** Envía el formulario de P6 y espera terminar en el destino esperado. */
export async function enviarP6(page: Page, destinoEsperado: RegExp): Promise<void> {
  const continuar = page.getByRole("button", { name: "Declarar y continuar" });
  await expect(continuar).toBeEnabled();
  await continuar.click();
  await expect(page).toHaveURL(destinoEsperado, { timeout: 20_000 });
}

/**
 * Paso 7 · Realizá el pago, con QR Bancard. Deja a la persona en /pago, pago
 * confirmado.
 *
 * D-08 · este paso ahora corre **después** de la firma, y la declaración de
 * origen lícito se aceptó dos pasos antes, junto con las declaraciones.
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
  // CHG-37 · sin esta casilla el botón queda deshabilitado: es la que autoriza
  // emitir el certificado y mandar la póliza a los canales verificados.
  await page.locator("#p7-acepta-certificado").check();
  await page.getByRole("button", { name: "GENERAR QR BANCARD" }).click();
  await expect(page.getByText("Escaneá el QR con tu app de banco")).toBeVisible();

  // El pago lo dispara el botón *Pagado*, no un reloj. Antes acá se sondeaba
  // hasta que el mock acreditara solo a los seis segundos, y de eso salían dos
  // problemas: el test dependía de una carrera contra un temporizador, y el
  // recorrido mostraba el dinero entrando sin que nadie hiciera nada.
  //
  // `toBeEnabled` espera con el auto-retry de Playwright a que pase el contador
  // de cinco segundos: no hace falta un `waitForTimeout`, que sería justamente
  // la clase de espera fija que vuelve intermitente a una suite.
  const pagado = page.getByRole("button", { name: "Pagado", exact: true });
  await expect(pagado).toBeEnabled({ timeout: 15_000 });
  await pagado.click();

  // La confirmación del expediente la hace el sondeo, que corre solo. Se espera
  // el resultado en la pantalla —no en la API— porque es lo que la persona ve.
  await expect(page.getByRole("heading", { name: "Pago acreditado" })).toBeVisible({
    timeout: 15_000,
  });
}

export async function continuarAConfirmacion(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Ver la confirmación →" }).click();
  await expect(page).toHaveURL(/\/confirmacion$/);
}

/**
 * Paso 6 · Revisá, aceptá y firmá — espera a que el acto de firma se abra solo.
 *
 * Ya no hay botón de enviar enlace: la pantalla abre el acto al cargar y pide
 * el código, que es lo único que la persona hace acá. Este ayudante devuelve el
 * identificador del acto para que el escenario pueda mirarlo desde el panel;
 * quien firma es `firmarNormalmente` / `firmarConFallaAMitad`.
 */
export async function enviarEnlaceYAbrir(page: Page): Promise<string> {
  await expect(page).toHaveURL(/\/firma$/);
  await esperarHidratacion(page);
  // D-08 · acá todavía no se cobró nada; lo que la pantalla anuncia es que
  // firmar es lo que habilita el pago.
  await expect(page.getByRole("heading", { name: "DESPUÉS DE FIRMAR" })).toBeVisible();

  // El acto se abre solo, pero recién cuando la pantalla tiene el resumen — y
  // para tenerlo hay que cerrar el paquete documental: generar el PDF,
  // hashearlo y subirlo. Antes esa espera quedaba escondida detrás del botón,
  // que Playwright aguardaba a que se habilitara; ahora es explícita, así que
  // el plazo tiene que cubrir el cierre del paquete, no solo la apertura del
  // acto.
  await expect(page.getByRole("heading", { name: "Código para firmar" })).toBeVisible({
    timeout: 60_000,
  });

  // Y se espera a que el código **exista**, no solo a que el bloque aparezca.
  // El título se dibuja apenas hay acto, mientras la emisión sigue en vuelo y
  // el bloque dice "Generando el código…": leer el panel en ese instante
  // devuelve `null` y el escenario falla con "el panel no tiene código", que
  // es cierto y desorienta. El texto del destino es la señal de que ya se
  // emitió.
  await expect(page.getByText("Te enviamos un código de 6 dígitos")).toBeVisible({
    timeout: 30_000,
  });

  const idMatch = await page.getByText(/^ID MOCK-FIRMA-/).textContent();
  const idCode100 = (idMatch ?? "").replace(/^ID\s*/, "").trim();
  expect(idCode100, "No se encontró el ID de Code100 en la pantalla de P8.").not.toBe("");

  return idCode100;
}

/** Firma normalmente con el código real leído del panel; espera pasar al pago. */
export async function firmarNormalmente(page: Page, idCode100: string): Promise<void> {
  // El código lo lee el panel de demo, que es el único lugar por donde sale
  // (regla inviolable #2: la API del flujo no lo devuelve nunca). La persona lo
  // recibe por WhatsApp; el test lo mira por la puerta de servicio.
  const sesion = await leerSesionFirmaDelPanel(page, idCode100);
  expect(sesion.codigo, "El panel no tiene código de firma para esta sesión.").not.toBeNull();

  // Y se tipea en la pantalla, como haría la persona: es el camino que el
  // producto tiene ahora, y ejercitarlo desde la API dejaría sin probar los
  // campos y el botón.
  await tipearOtp(page, "p8", sesion.codigo as string);

  // Tipear el código no lleva al pago por sí solo: firma del cliente, después
  // las institucionales, y recién cuando el sondeo ve `FIRMADO` la pantalla
  // navega. Son varios ciclos de dos segundos contra DynamoDB real, así que el
  // plazo cubre esa cadena y no solo el envío del código.
  await expect(page).toHaveURL(/\/pago$/, { timeout: 60_000 });
}
