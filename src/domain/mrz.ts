/**
 * Lectura y verificación de la zona legible por máquina (MRZ) del dorso de la
 * cédula, formato **TD1** de ICAO Doc 9303 (tres líneas de 30 caracteres).
 *
 * Para qué sirve acá: es la única verificación de **autenticidad documental**
 * que podemos hacer con código propio, sin proveedor especializado ni fuente
 * oficial. El MRZ trae dígitos verificadores calculados sobre sus propios
 * datos, así que un dorso cuyos dígitos cierran y cuyos campos coinciden con lo
 * que el OCR leyó en el frente es mucho más difícil de falsificar que una
 * imagen editada a mano. No reemplaza a un análisis documental de verdad
 * (hologramas, tipografía, foto-de-pantalla) — ver §3 de
 * `docs/RECOMENDACIONES_ONBOARDING_IDENTIDAD.md` — pero cierra el hueco más
 * grosero y es gratis.
 *
 * **Alcance honesto:** esto verifica *consistencia interna*, no que el
 * documento exista en el registro civil. Un MRZ inventado con dígitos bien
 * calculados pasa estas verificaciones. Lo que las supera es cruzar contra el
 * Departamento de Identificaciones (ítem 9 de la tabla de integraciones).
 *
 * Sin dependencias: el algoritmo son treinta líneas y las librerías de MRZ
 * traen parseadores de decenas de formatos que no usamos — mismo criterio que
 * con el PDF y el QR en `src/documentos/`.
 *
 * ---
 *
 * ## Estructura TD1 (ICAO Doc 9303 Parte 5)
 *
 * ```
 * Línea 1: [1-2] código de documento   [3-5] estado emisor
 *          [6-14] número de documento  [15] verificador del número
 *          [16-30] datos opcionales 1
 * Línea 2: [1-6] nacimiento AAMMDD     [7] verificador de nacimiento
 *          [8] sexo                    [9-14] vencimiento AAMMDD
 *          [15] verificador de venc.   [16-18] nacionalidad
 *          [19-29] datos opcionales 2  [30] verificador compuesto
 * Línea 3: [1-30] apellidos<<nombres
 * ```
 *
 * El verificador compuesto de la posición 30 se calcula sobre
 * `L1[6-30] + L2[1-7] + L2[9-15] + L2[19-29]`, que es lo que ata las dos
 * primeras líneas entre sí: cambiar un dígito de la fecha de nacimiento sin
 * recalcular dos verificadores rompe la cadena.
 */

/** Longitud de cada línea y cantidad de líneas del formato TD1. */
export const TD1_LARGO_LINEA = 30;
export const TD1_CANTIDAD_LINEAS = 3;

/** Estado emisor y nacionalidad de la cédula paraguaya en ICAO Doc 9303 Parte 3. */
export const CODIGO_PARAGUAY = "PRY";

// ---------------------------------------------------------------------------
// Dígitos verificadores
// ---------------------------------------------------------------------------

/** Pesos que se repiten de a tres, de izquierda a derecha (ICAO Doc 9303). */
const PESOS = [7, 3, 1] as const;

/**
 * Valor numérico de un carácter del MRZ: dígitos su propio valor, letras
 * A–Z de 10 a 35, y el relleno `<` vale 0.
 *
 * Devuelve `null` para cualquier otro carácter — un MRZ con un carácter que no
 * pertenece al alfabeto no es un MRZ mal leído, es otra cosa, y conviene que
 * falle en vez de calcular un verificador sobre basura.
 */
function valorCaracter(caracter: string): number | null {
  if (caracter === "<") return 0;
  if (caracter >= "0" && caracter <= "9") return caracter.charCodeAt(0) - 48;
  if (caracter >= "A" && caracter <= "Z") return caracter.charCodeAt(0) - 55;
  return null;
}

/**
 * Dígito verificador de ICAO Doc 9303: se multiplica cada carácter por el peso
 * 7-3-1 que le toca según su posición, se suman los productos y el resto de
 * dividir por 10 es el dígito.
 *
 * `null` si algún carácter está fuera del alfabeto del MRZ.
 */
export function digitoVerificador(campo: string): number | null {
  let suma = 0;
  for (let i = 0; i < campo.length; i += 1) {
    const valor = valorCaracter(campo[i]);
    if (valor === null) return null;
    suma += valor * PESOS[i % PESOS.length];
  }
  return suma % 10;
}

/**
 * `true` si `campo` está seguido por su dígito verificador correcto.
 *
 * ICAO admite `<` como verificador cuando el campo entero es relleno; se trata
 * como 0, que es lo que devuelve `digitoVerificador` para un campo vacío.
 */
export function verificadorCorrecto(campo: string, verificador: string): boolean {
  const esperado = digitoVerificador(campo);
  if (esperado === null) return false;
  const recibido = verificador === "<" ? 0 : valorCaracter(verificador);
  return recibido !== null && recibido === esperado && verificador !== "";
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

export interface DatosMrz {
  readonly codigoDocumento: string;
  readonly estadoEmisor: string;
  /** Sin el relleno `<`. En la cédula paraguaya, el número de cédula. */
  readonly numeroDocumento: string;
  /** ISO 8601 (AAAA-MM-DD). */
  readonly fechaNacimiento: string;
  /** `M`, `F` o `X` (no especificado), tal como lo define ICAO Doc 9303. */
  readonly sexo: string;
  /** ISO 8601 (AAAA-MM-DD). */
  readonly fechaVencimiento: string;
  readonly nacionalidad: string;
  readonly apellidos: string;
  readonly nombres: string;
}

export type MotivoMrzInvalido =
  | "ESTRUCTURA_INVALIDA"
  | "CARACTER_NO_PERMITIDO"
  | "VERIFICADOR_NUMERO_DOCUMENTO"
  | "VERIFICADOR_FECHA_NACIMIENTO"
  | "VERIFICADOR_FECHA_VENCIMIENTO"
  | "VERIFICADOR_COMPUESTO"
  | "FECHA_INVALIDA";

export type ResultadoMrz =
  | { readonly ok: true; readonly datos: DatosMrz }
  | { readonly ok: false; readonly motivos: readonly MotivoMrzInvalido[] };

/**
 * Convierte `AAMMDD` del MRZ a ISO 8601, infiriendo el siglo.
 *
 * El MRZ **no codifica el siglo** — es una ambigüedad del formato, no una
 * omisión nuestra. Se resuelve con la ventana que corresponde al campo:
 *
 * - `nacimiento`: la fecha ya ocurrió, así que si el año de dos dígitos
 *   interpretado como 20xx cae en el futuro, es 19xx.
 * - `vencimiento`: siempre 20xx. Una cédula que venció antes del año 2000 no
 *   es un documento vigente, y la vigencia se controla aparte.
 *
 * `null` si la fecha no existe (mes 13, 31 de febrero, etc.).
 */
function fechaIso(
  aammdd: string,
  campo: "nacimiento" | "vencimiento",
  referencia: Date,
): string | null {
  if (!/^\d{6}$/.test(aammdd)) return null;

  const aa = Number(aammdd.slice(0, 2));
  const mm = Number(aammdd.slice(2, 4));
  const dd = Number(aammdd.slice(4, 6));

  let anio = 2000 + aa;
  if (campo === "nacimiento") {
    const hoy = new Date(
      Date.UTC(referencia.getUTCFullYear(), referencia.getUTCMonth(), referencia.getUTCDate()),
    );
    const comoSiglo21 = Date.UTC(anio, mm - 1, dd);
    if (comoSiglo21 > hoy.getTime()) anio = 1900 + aa;
  }

  // `Date.UTC` normaliza en silencio (mes 13 pasa a enero del año siguiente),
  // así que se compara contra lo pedido para detectar una fecha inexistente.
  const fecha = new Date(Date.UTC(anio, mm - 1, dd));
  const existe =
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mm - 1 && fecha.getUTCDate() === dd;
  return existe ? fecha.toISOString().slice(0, 10) : null;
}

/** Convierte un campo de nombre del MRZ (`GORENA<TAPIA`) a texto (`GORENA TAPIA`). */
function texto(campo: string): string {
  return campo.replace(/</g, " ").trim().replace(/\s+/g, " ");
}

/**
 * Normaliza el MRZ tal como lo devuelve un OCR: mayúsculas, sin espacios ni
 * saltos sueltos, y separado en las tres líneas de 30 caracteres.
 *
 * Acepta las líneas separadas por saltos o pegadas en 90 caracteres corridos,
 * porque un OCR puede devolver cualquiera de las dos formas.
 */
export function normalizarLineasTd1(crudo: string): readonly string[] | null {
  const limpio = crudo.toUpperCase().replace(/[^A-Z0-9<\n]/g, "");
  const porSaltos = limpio
    .split("\n")
    .map((linea) => linea.trim())
    .filter((linea) => linea !== "");

  if (
    porSaltos.length === TD1_CANTIDAD_LINEAS &&
    porSaltos.every((linea) => linea.length === TD1_LARGO_LINEA)
  ) {
    return porSaltos;
  }

  const corrido = limpio.replace(/\n/g, "");
  if (corrido.length === TD1_LARGO_LINEA * TD1_CANTIDAD_LINEAS) {
    return [
      corrido.slice(0, 30),
      corrido.slice(30, 60),
      corrido.slice(60, 90),
    ];
  }

  return null;
}

/**
 * Lee un MRZ TD1 y verifica sus cuatro dígitos verificadores.
 *
 * Devuelve **todos** los motivos de falla, no el primero: distinguir "el OCR
 * leyó mal un dígito" (un solo verificador roto) de "esto no es un MRZ" (todos
 * rotos) sirve para decidir si tiene sentido pedir repetir la captura.
 */
export function leerMrzTd1(crudo: string, referencia: Date = new Date()): ResultadoMrz {
  const lineas = normalizarLineasTd1(crudo);
  if (!lineas) return { ok: false, motivos: ["ESTRUCTURA_INVALIDA"] };

  const [l1, l2, l3] = lineas;

  // Un carácter fuera del alfabeto invalida todos los verificadores a la vez;
  // se corta acá para no reportar cuatro fallas que en realidad son una.
  if ([...l1, ...l2, ...l3].some((caracter) => valorCaracter(caracter) === null)) {
    return { ok: false, motivos: ["CARACTER_NO_PERMITIDO"] };
  }

  const numeroDocumentoCrudo = l1.slice(5, 14);
  const verificadorNumero = l1.slice(14, 15);
  const opcionales1 = l1.slice(15, 30);

  const nacimientoCrudo = l2.slice(0, 6);
  const verificadorNacimiento = l2.slice(6, 7);
  const sexo = l2.slice(7, 8);
  const vencimientoCrudo = l2.slice(8, 14);
  const verificadorVencimiento = l2.slice(14, 15);
  const nacionalidad = l2.slice(15, 18);
  const opcionales2 = l2.slice(18, 29);
  const verificadorCompuesto = l2.slice(29, 30);

  const motivos: MotivoMrzInvalido[] = [];

  if (!verificadorCorrecto(numeroDocumentoCrudo, verificadorNumero)) {
    motivos.push("VERIFICADOR_NUMERO_DOCUMENTO");
  }
  if (!verificadorCorrecto(nacimientoCrudo, verificadorNacimiento)) {
    motivos.push("VERIFICADOR_FECHA_NACIMIENTO");
  }
  if (!verificadorCorrecto(vencimientoCrudo, verificadorVencimiento)) {
    motivos.push("VERIFICADOR_FECHA_VENCIMIENTO");
  }

  // ICAO Doc 9303 Parte 5: el compuesto abarca L1[6-30] + L2[1-7] + L2[9-15]
  // + L2[19-29] (posiciones 1-indexadas, inclusive).
  const compuesto =
    numeroDocumentoCrudo +
    verificadorNumero +
    opcionales1 +
    nacimientoCrudo +
    verificadorNacimiento +
    vencimientoCrudo +
    verificadorVencimiento +
    opcionales2;
  if (!verificadorCorrecto(compuesto, verificadorCompuesto)) {
    motivos.push("VERIFICADOR_COMPUESTO");
  }

  const fechaNacimiento = fechaIso(nacimientoCrudo, "nacimiento", referencia);
  const fechaVencimiento = fechaIso(vencimientoCrudo, "vencimiento", referencia);
  if (fechaNacimiento === null || fechaVencimiento === null) motivos.push("FECHA_INVALIDA");

  if (motivos.length > 0 || fechaNacimiento === null || fechaVencimiento === null) {
    return { ok: false, motivos };
  }

  const [apellidos = "", nombres = ""] = l3.split("<<");

  return {
    ok: true,
    datos: {
      codigoDocumento: texto(l1.slice(0, 2)),
      estadoEmisor: texto(l1.slice(2, 5)),
      numeroDocumento: texto(numeroDocumentoCrudo).replace(/\s/g, ""),
      fechaNacimiento,
      sexo,
      fechaVencimiento,
      nacionalidad: texto(nacionalidad),
      apellidos: texto(apellidos),
      nombres: texto(nombres),
    },
  };
}

// ---------------------------------------------------------------------------
// Cruce contra lo leído en el frente
// ---------------------------------------------------------------------------

/** Los campos del frente que se cruzan contra el MRZ del dorso. */
export interface DatosFrenteParaCruce {
  readonly numeroCedula: string;
  /** ISO 8601 (AAAA-MM-DD). */
  readonly fechaNacimiento: string;
  readonly sexo: string;
}

export type MotivoCruceMrz =
  | "NUMERO_CEDULA_NO_COINCIDE"
  | "FECHA_NACIMIENTO_NO_COINCIDE"
  | "SEXO_NO_COINCIDE"
  | "DOCUMENTO_VENCIDO"
  | "ESTADO_EMISOR_NO_ES_PARAGUAY";

export interface ResultadoCruceMrz {
  readonly coincide: boolean;
  readonly motivos: readonly MotivoCruceMrz[];
}

/** Deja solo dígitos: la cédula se imprime `9.323.336` y el MRZ la trae `9323336`. */
function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * Cruza los datos leídos del frente contra el MRZ del dorso, y de paso verifica
 * vigencia y estado emisor.
 *
 * Esta es la verificación que hace que el par frente+dorso valga más que la
 * suma de las dos caras: el frente aporta los datos legibles y el dorso los
 * confirma con dígitos verificadores. Que no coincidan significa **repetir la
 * captura**, nunca corregir a mano (regla de P5).
 *
 * La comparación de sexo es tolerante a la inicial (`F` ↔ `FEMENINO`) porque el
 * frente y el MRZ no lo escriben igual; la del número de cédula ignora puntos.
 */
export function cruzarConMrz(
  frente: DatosFrenteParaCruce,
  mrz: DatosMrz,
  referencia: Date = new Date(),
): ResultadoCruceMrz {
  const motivos: MotivoCruceMrz[] = [];

  if (soloDigitos(frente.numeroCedula) !== soloDigitos(mrz.numeroDocumento)) {
    motivos.push("NUMERO_CEDULA_NO_COINCIDE");
  }
  if (frente.fechaNacimiento !== mrz.fechaNacimiento) {
    motivos.push("FECHA_NACIMIENTO_NO_COINCIDE");
  }

  const inicialFrente = frente.sexo.trim().toUpperCase().slice(0, 1);
  const inicialMrz = mrz.sexo.trim().toUpperCase().slice(0, 1);
  // `X` en el MRZ significa "no especificado" (ICAO Doc 9303): no contradice
  // nada de lo que diga el frente, así que no se cuenta como discrepancia.
  if (inicialMrz !== "X" && inicialFrente !== inicialMrz) {
    motivos.push("SEXO_NO_COINCIDE");
  }

  const hoy = referencia.toISOString().slice(0, 10);
  if (mrz.fechaVencimiento < hoy) motivos.push("DOCUMENTO_VENCIDO");

  if (mrz.estadoEmisor !== CODIGO_PARAGUAY) motivos.push("ESTADO_EMISOR_NO_ES_PARAGUAY");

  return { coincide: motivos.length === 0, motivos };
}
