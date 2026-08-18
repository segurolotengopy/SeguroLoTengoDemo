/**
 * Reconocimiento **básico** de cédula paraguaya o boliviana a partir del texto
 * que devolvió el OCR.
 *
 * ## Qué es y qué no es
 *
 * Esto **no verifica autenticidad documental**. No detecta una cédula
 * falsificada, ni una adulterada, ni la foto de una foto. Es el control más
 * barato que existe para una sola cosa: que lo que la persona fotografió sea
 * plausiblemente una cédula de identidad de uno de los dos países, y no la
 * pared, un vaso o el carné del videoclub.
 *
 * La brecha de autenticidad documental sigue abierta y está documentada en §2
 * de `docs/RECOMENDACIONES_ONBOARDING_IDENTIDAD.md`: cerrarla requiere fuente
 * oficial (`RegistroCivilProvider`, ítem 33) o un proveedor documental
 * especializado. Nada de lo que hay acá la reemplaza, y por eso este módulo
 * devuelve "señales", no un veredicto de validez.
 *
 * ## Por qué vive en el dominio y no en el adaptador
 *
 * Qué documentos acepta el producto es una **regla de negocio**, no un detalle
 * de Textract. Si mañana el OCR lo hace otro proveedor, esta tabla no cambia.
 * El adaptador aporta las líneas de texto; acá se decide qué significan.
 *
 * ## Procedencia de los marcadores
 *
 * Son los rótulos impresos en el propio documento — información pública, no
 * una base de datos de proveedor de pago:
 *
 * - **Paraguay**: cédula de identidad civil emitida por el Departamento de
 *   Identificaciones de la Policía Nacional. Formato ID-1 en policarbonato con
 *   chip desde el 10/07/2023; el formato anterior sigue vigente en paralelo,
 *   por eso los marcadores tienen que servir para los dos.
 *   (es.wikipedia.org/wiki/Cédula_de_identidad_(Paraguay),
 *   policianacional.gov.py/identificaciones/cedula-de-identidad/)
 * - **Bolivia**: cédula de identidad emitida por el SEGIP, formato vigente
 *   desde el 01/11/2023. Anverso con SERIE, SECCIÓN, NOMBRES, APELLIDOS y las
 *   tres fechas; reverso con LUGAR DE NACIMIENTO, DOMICILIO, PROFESIÓN U
 *   OCUPACIÓN, ESTADO CIVIL, GRUPO SANGUÍNEO, NPIOC y zona legible por
 *   máquina. (es.wikipedia.org/wiki/Cédula_de_identidad_(Bolivia),
 *   segip.gob.bo/cedula-de-identidad/)
 *
 * ## Aviso de alcance
 *
 * **Aceptar cédula boliviana es una decisión de demo, no de producto.**
 * `docs/ESPECIFICACION_PANTALLAS.md` (P5) dice hoy "No se admite pasaporte ni
 * documento extranjero", y no hay ninguna fila en
 * `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv` que respalde ampliar el
 * documento admitido: el producto se vende en Paraguay. Por eso el país
 * boliviano solo se habilita explícitamente (ver `PAISES_ACEPTADOS_POR_DEFECTO`
 * y quien construye el adaptador), y nunca por omisión.
 */

export type PaisDocumento = "PY" | "BO";

export type CaraDocumento = "FRENTE" | "DORSO";

/**
 * Países admitidos si nadie dice lo contrario: **solo Paraguay**.
 *
 * El default es el del producto, no el de la demo. Ampliarlo es una decisión
 * consciente de quien arma el adaptador, y así queda registrada en el
 * composition root en vez de escondida acá.
 */
export const PAISES_ACEPTADOS_POR_DEFECTO: readonly PaisDocumento[] = ["PY"];

/**
 * Cuántos marcadores distintos tiene que encontrar el OCR para dar por
 * reconocido el país.
 *
 * **Dos, no uno.** "CEDULA DE IDENTIDAD" sola aparece en los documentos de
 * media región y en cualquier formulario que la mencione; el par
 * país + tipo de documento ya es difícil de encontrar por casualidad en algo
 * que no sea una cédula. Y **no más de dos**, porque el OCR de una foto de
 * celular con reflejos pierde líneas con facilidad: exigir cuatro rechazaría
 * cédulas buenas, que es el error caro acá (la otra dirección la ataja el
 * resto de los controles de P5).
 *
 * Decisión de producto, sin respaldo en la matriz de cumplimiento.
 */
export const MARCADORES_MINIMOS_DOCUMENTO = 2;

/**
 * Marcadores por país y por cara. Se comparan **normalizados** (mayúsculas,
 * sin tildes, espacios colapsados), así que acá van sin acentos.
 *
 * Cada entrada es un texto impreso en el documento. No se incluyen rótulos
 * genéricos que aparecen en cualquier formulario ("NOMBRES", "FIRMA"): un
 * marcador que también matchea un papel cualquiera no distingue nada.
 */
const MARCADORES: Readonly<Record<PaisDocumento, Readonly<Record<CaraDocumento, readonly string[]>>>> = {
  PY: {
    FRENTE: [
      "REPUBLICA DEL PARAGUAY",
      "CEDULA DE IDENTIDAD",
      "IDENTIDAD CIVIL",
      "POLICIA NACIONAL",
      "IDENTIFICACIONES",
      "PARAGUAYA",
      "NACIONALIDAD",
      "DONANTE",
    ],
    DORSO: [
      "REPUBLICA DEL PARAGUAY",
      "LUGAR DE NACIMIENTO",
      "FECHA DE EXPEDICION",
      "VENCIMIENTO",
      "IDENTIFICACIONES",
      // Código de país ISO 3166-1 alfa-3 en el MRZ TD1 del dorso. La lectura
      // completa del MRZ, con sus dígitos verificadores, la hace `mrz.ts`;
      // acá alcanza con verlo como señal de país.
      "PRY",
    ],
  },
  // Bolivia tiene **dos formatos vigentes en paralelo** y los marcadores
  // sirven para los dos: el del SEGIP desde el 01/11/2023 (SERIE/SECCIÓN, tres
  // fechas, zona legible por máquina) y el anterior, que sigue circulando —
  // rotula "serie"/"sección" en el anverso y pone los datos personales en el
  // reverso, con las fechas escritas en palabras y sin MRZ.
  BO: {
    FRENTE: [
      "ESTADO PLURINACIONAL DE BOLIVIA",
      "CEDULA DE IDENTIDAD",
      "SERVICIO GENERAL DE IDENTIFICACION PERSONAL",
      "SEGIP",
      "BOLIVIA",
      "SECCION",
      "SERIE",
      "FECHA DE EXPIRACION",
      // Formato anterior: las fechas del anverso van en palabras.
      "EMITIDA EL",
      "EXPIRA EL",
    ],
    DORSO: [
      "ESTADO PLURINACIONAL DE BOLIVIA",
      "SERVICIO GENERAL DE IDENTIFICACION PERSONAL",
      // El reverso del formato anterior escribe "Profesión/Ocupación" con
      // barra, no "u"; se buscan las dos formas.
      "PROFESION U OCUPACION",
      "PROFESION/OCUPACION",
      "PROFESION",
      "GRUPO SANGUINEO",
      "LUGAR DE NACIMIENTO",
      "ESTADO CIVIL",
      "DOMICILIO",
      "NACIDO EL",
      "DOCUMENTOS REGISTRADOS",
      "NPIOC",
      "SEGIP",
      "BOL",
    ],
  },
};

/**
 * Número impreso, por país.
 *
 * - **Paraguay**: hasta 7 dígitos, con o sin puntos de millar (`9.323.336`).
 * - **Bolivia**: 5 a 8 dígitos, con "complemento" opcional — un código corto
 *   que el SEGIP agrega para desambiguar homónimos (`1234567-1A`, `1234567 LP`).
 *   El complemento **no se conserva**: el flujo identifica por número, y
 *   arrastrarlo obligaría a normalizarlo en todas las comparaciones.
 */
const PATRON_NUMERO: Readonly<Record<PaisDocumento, RegExp>> = {
  PY: /\b(\d{1,3}(?:\.\d{3})+|\d{5,8})\b/,
  BO: /\b(\d{5,8})\b(?:\s*[- ]\s*\d?[A-Z]{1,2}\b)?/,
};

export interface SenalesDocumento {
  /** País reconocido, o `null` si ninguno alcanzó `MARCADORES_MINIMOS_DOCUMENTO`. */
  readonly pais: PaisDocumento | null;
  /** Marcadores efectivamente encontrados del país ganador. Van a la evidencia. */
  readonly marcadoresEncontrados: readonly string[];
  /**
   * Número leído del texto, sin puntos ni complemento. `null` si no apareció
   * ninguno con forma de número de cédula.
   *
   * **No es un dato confirmado.** Es lo mismo que
   * `ResultadoOcrCedula.numeroCedulaSinConfirmar`: una pista para ir a buscar
   * la verdad a otro lado, no un valor para persistir sin más.
   */
  readonly numeroDetectado: string | null;
}

/** Mayúsculas, sin tildes ni diacríticos, espacios colapsados. */
export function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Busca señales de cédula paraguaya o boliviana en el texto reconocido.
 *
 * Recibe las líneas ya extraídas por quien hizo el OCR — este módulo no habla
 * con ningún proveedor. Evalúa **todos** los países pedidos y se queda con el
 * de más marcadores; ante empate gana el primero de `paisesAceptados`, que por
 * eso es una lista ordenada y no un conjunto.
 */
export function reconocerDocumentoRegional(
  lineas: readonly string[],
  cara: CaraDocumento,
  paisesAceptados: readonly PaisDocumento[] = PAISES_ACEPTADOS_POR_DEFECTO,
): SenalesDocumento {
  // Un solo texto: los rótulos se parten en varias líneas según cómo caiga el
  // recorte, y buscar por línea perdería "REPUBLICA DEL / PARAGUAY".
  const texto = normalizarTexto(lineas.join(" "));

  let mejor: { pais: PaisDocumento; encontrados: string[] } | null = null;

  for (const pais of paisesAceptados) {
    const encontrados = MARCADORES[pais][cara].filter((marcador) => texto.includes(marcador));
    if (mejor === null || encontrados.length > mejor.encontrados.length) {
      mejor = { pais, encontrados };
    }
  }

  if (mejor === null || mejor.encontrados.length < MARCADORES_MINIMOS_DOCUMENTO) {
    return { pais: null, marcadoresEncontrados: [], numeroDetectado: null };
  }

  return {
    pais: mejor.pais,
    marcadoresEncontrados: mejor.encontrados,
    numeroDetectado: numeroDe(texto, mejor.pais),
  };
}

/**
 * Número rotulado: `No. 2441214`, `Nº 2441214`, `NRO 2441214`.
 *
 * Se busca **antes** que el patrón suelto porque el anverso boliviano del
 * formato anterior imprime `serie 42333` y `sección 42222` **arriba** del
 * número real, y quedarse con la primera corrida de dígitos devolvía la serie
 * como si fuera la cédula.
 */
const PATRON_NUMERO_ROTULADO = /\bN(?:RO|UMERO|[O°º])?\.?\s*:?\s*(\d{1,3}(?:\.\d{3})+|\d{5,8})\b/;

/**
 * Elige el número de cédula del texto.
 *
 * Orden: rotulado primero; si no hay rótulo, **la corrida de dígitos más
 * larga**, no la primera. Un número de cédula tiene más dígitos que una serie
 * o una sección, así que ante varios candidatos el más largo es la mejor
 * apuesta — y sigue siendo eso, una apuesta: el valor viaja como
 * `numeroDetectado`, que el puerto define como pista sin confirmar.
 */
function numeroDe(texto: string, pais: PaisDocumento): string | null {
  const rotulado = texto.match(PATRON_NUMERO_ROTULADO);
  if (rotulado) return rotulado[1].replace(/\./g, "");

  const patron = new RegExp(PATRON_NUMERO[pais].source, "g");
  const candidatos = [...texto.matchAll(patron)]
    .map((coincidencia) => coincidencia[1].replace(/\./g, ""))
    .filter((valor) => valor !== "");
  if (candidatos.length === 0) return null;

  return candidatos.reduce((mejor, actual) => (actual.length > mejor.length ? actual : mejor));
}

/** Nacionalidad que corresponde a cada país, tal como va al FIPF. */
export const NACIONALIDAD_POR_PAIS: Readonly<Record<PaisDocumento, string>> = {
  PY: "PARAGUAYA",
  BO: "BOLIVIANA",
};

/** Nombre del país para los mensajes de la pantalla. */
export const NOMBRE_PAIS: Readonly<Record<PaisDocumento, string>> = {
  PY: "Paraguay",
  BO: "Bolivia",
};

/**
 * Mensaje para la persona cuando no se reconoció el documento.
 *
 * Dice qué hacer, no qué falló técnicamente, y **no revela qué marcadores
 * busca el sistema**: publicar la lista sería publicar cómo pasarla.
 */
export function mensajeDocumentoNoReconocido(
  paisesAceptados: readonly PaisDocumento[],
): string {
  const nombres = paisesAceptados.map((pais) => NOMBRE_PAIS[pais]);
  const lista =
    nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} o ${nombres.at(-1)}` : nombres[0];
  return (
    `No reconocimos una cédula de identidad de ${lista} en la fotografía. ` +
    `Enfocá el documento completo, sin reflejos, y repetí la captura.`
  );
}
