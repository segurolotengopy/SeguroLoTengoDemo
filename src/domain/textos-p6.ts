/**
 * Literales de las 8 declaraciones obligatorias de P6, transcritos palabra por
 * palabra de docs/ESPECIFICACION_PANTALLAS.md → "P6 · Paso 6 de 9 — Datos y
 * declaraciones", bloque 2. Las tres médicas (1, 2 y 3) coinciden además con
 * el bloque 4 de `docs/Solicitud.pdf` y la 8 con el bloque 3 de `docs/FIPF.pdf`.
 *
 * Mismo criterio que `textos-p1.ts` y `textos-p3.ts`: módulo sin ninguna
 * dependencia (ni siquiera `node:*`) porque lo consumen las dos orillas —la
 * pantalla, que muestra los literales, y el caso de uso del servidor, que
 * registra su versión en la evidencia—.
 *
 * **Al cambiar una sola palabra de un literal hay que subir la versión.** Las
 * evidencias ya guardadas apuntan a la versión vieja y no se reescriben nunca
 * (regla inviolable #10).
 *
 * Respaldo normativo:
 *
 * - Declaraciones médicas (1, 2, 3): fila 20 de `docs/Tabla Cumplimiento
 *   SeguroLo Tengo - Tabla.csv` — "R2 - CONSENTIMIENTO, IDENTIFICACIÓN Y
 *   REPUDIO", *"Presentar declaraciones médicas claras, completas y coherentes
 *   con el producto"*, Código Civil, arts. 1349-1354 y 1387; Res. SS SG.
 *   215/2025, anexo 1, numerales 11.2 y 11.11.
 * - Declaración 8 (PEP): fila 18, *"Preguntar si el cliente es PEP o está
 *   relacionado con una PEP"*, Res. SEPRELAD 50/20, arts. 2-3; Res. SEPRELAD
 *   71/19, art. 26(1)(j). Y fila 19 para la derivación sin rechazo automático,
 *   Res. SEPRELAD 50/20, art. 7.
 * - Declaración 4 (inicio de cobertura a las 24 h del pago): fila 50, Res. SS
 *   SG. 215/2025, Anexo 1, numeral 6.13.14; Código Civil, art. 1374.
 * - Declaración 6 (entrega digital): fila 53, Res. SS SG. 215/2025, art. 4,
 *   primer párrafo; Ley 4868/13, art. 7(d).
 * - Declaración 7 (corredor y su remuneración): fila 1, Ley 4868/13, arts. 3,
 *   7(a) y 7(d); Ley 827/96, arts. 70-71; Res. SS SG. 223/17, numeral 9(c).
 */
import type { RespuestaDeclaracion } from "./tipos";

/**
 * v2 (19-ago-2026, CHG-22): se simplificó el literal de la declaración 4
 * (vigencia y carencias). Las evidencias emitidas hasta hoy apuntan a
 * `P6-DECLARACIONES-v1` y conservan su propio texto: no se reescriben nunca
 * (regla inviolable #10).
 */
export const VERSION_TEXTOS_DECLARACIONES_P6 = "P6-DECLARACIONES-v2";

export interface TextoDeclaracionP6 {
  readonly numero: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /** Rótulo en mayúsculas del badge de la izquierda: `ESTADO DE SALUD`, etc. */
  readonly titulo: string;
  readonly texto: string;
}

export const TEXTOS_DECLARACIONES_P6: readonly TextoDeclaracionP6[] = [
  {
    numero: 1,
    titulo: "Estado de salud",
    texto:
      "Declaro que me encuentro en buen estado de salud y que no contrato este seguro para cubrir " +
      "una enfermedad, diagnóstico o siniestro preexistente.",
  },
  {
    numero: 2,
    titulo: "Antecedentes de contratación",
    texto:
      "¿Alguna aseguradora rechazó, postergó o condicionó una solicitud de seguro similar, o " +
      "intentaste contratarlo para cubrir una enfermedad persistente?",
  },
  {
    numero: 3,
    titulo: "Enfermedades diagnosticadas",
    texto:
      "¿Tenés diagnosticado cáncer, enfermedad cardiovascular, insuficiencia renal, diabetes, " +
      "esclerosis, enfermedad autoinmune, enfermedad inmunodeficiente, hepatitis o cirrosis?",
  },
  {
    numero: 4,
    titulo: "Vigencia y carencias",
    // CHG-22 · simplificada a una sola afirmación (reunión 18-ago-2026,
    // 00:21:59). La versión anterior encadenaba tres cosas —inicio de
    // cobertura, emisión completada y "revisé todas las carencias"— y Andres
    // señaló el problema en la reunión: quien no está seguro de haber
    // revisado *todas* las carencias duda de responder que sí, y una duda
    // frente a un toggle que decide la elegibilidad es una salida del flujo.
    // Ahora declara únicamente el hecho que la persona puede afirmar sin
    // riesgo; las carencias se muestran en la pantalla del plan.
    texto:
      "Declaro que conozco y acepto que la cobertura comenzará 24 horas después del pago.",
  },
  {
    numero: 5,
    titulo: "Veracidad",
    texto:
      "Declaro que los datos proporcionados son verdaderos y que el WhatsApp y el correo declarados " +
      "son de mi propiedad y están bajo mi control.",
  },
  {
    numero: 6,
    titulo: "Entrega digital",
    texto:
      "Acepto recibir la póliza y la factura en mis canales verificados, y disponer de la Solicitud " +
      "y el FIPF firmados para descarga en SeguroLoTengo.",
  },
  {
    numero: 7,
    titulo: "Corredor de la póliza",
    texto:
      "Tomo conocimiento de que Interseguros S.A. es el corredor de esta póliza y que su remuneración " +
      "será pagada por Alianza Garantía.",
  },
  {
    numero: 8,
    titulo: "Condición PEP",
    texto: "¿Sos una persona expuesta políticamente o estás vinculada a una?",
  },
];

/**
 * Subtítulos que agrupan las declaraciones (CHG-20, reunión 00:18:13: "aquí
 * hay que poner unos titulitos, seguramente declaraciones de salud,
 * declaraciones…").
 *
 * La clave es el número de la declaración que **abre** el grupo; el resto de
 * las declaraciones no lleva subtítulo. Se separa así, y no en dos listas
 * distintas, porque la numeración 1-8 es continua y sale de la Solicitud: las
 * tres primeras van a la declaración médica y el resto a las declaraciones
 * generales, pero el documento las numera de corrido.
 */
export const SUBTITULOS_DECLARACIONES_P6: Readonly<Record<number, string>> = {
  1: "Declaraciones de salud",
  4: "Declaraciones",
};

/** Enlace `¿Qué significa PEP?` de la declaración 8 y su explicación. */
export const ROTULO_AYUDA_PEP = "¿Qué significa PEP?";

export const AYUDA_PEP =
  "Una Persona Expuesta Políticamente es quien ocupa o ocupó un cargo público relevante, o quien " +
  "está vinculada a una por parentesco cercano o por sociedad. Responder que sí no es un rechazo: " +
  "deriva el caso a un análisis reforzado de Interseguros y Alianza Garantía.";

/** Etiqueta del badge que indica qué respuesta habilita la emisión automática. */
export function rotuloRespuestaHabilitante(respuesta: RespuestaDeclaracion): string {
  return respuesta === "SI" ? "Habilita: Sí" : "Habilita: No";
}

/**
 * Si se muestra el badge `Habilita: Sí/No` junto a cada declaración.
 *
 * CHG-21: la reunión (00:20:37) lo dejó como **guía provisional sujeta a
 * testeo de usabilidad**, con el pedido explícito de que sea fácil de apagar
 * ("luego lo podemos quitar, no hay problema"). De ahí el flag: quitarlo no
 * debería ser una edición de código en medio de una demostración.
 *
 * Encendido por defecto. Se apaga con `GUIA_HABILITACION_P6=off`.
 *
 * Ojo con lo que el badge NO es: no evalúa nada ni condiciona el envío. Es
 * una ayuda de lectura; la elegibilidad la decide `elegibilidad.ts` en el
 * servidor, con el badge visible o sin él.
 */
export function guiaHabilitacionVisible(): boolean {
  return process.env.NEXT_PUBLIC_GUIA_HABILITACION_P6 !== "off";
}

// ---------------------------------------------------------------------------
// Declaración de origen lícito de fondos (checkbox obligatorio)
// ---------------------------------------------------------------------------

/**
 * Declaración de **licitud y veracidad**, con el literal de la Matriz Legal V4
 * §4 (bloque "Licitud y veracidad").
 *
 * ## Por qué ya no es una casilla
 *
 * La matriz es explícita en dos puntos: el efecto de este bloque es
 * *"Integrada al PDF Solicitud + FIPF; **no casilla adicional**"*, y de la
 * pantalla de datos dice *"No hay casillas innecesarias; declaraciones forman
 * parte del PDF que se firma"*. La declaración no se marca aparte: se imprime
 * en el documento y queda cubierta por el acto de firma único.
 *
 * En L4b fue una casilla bloqueante acá, y era un puente deliberado: la
 * inversión de firma y pago (D-08) sacó la declaración de la pantalla de pago
 * y el FIPF se habría cerrado sin ella. Con el PDF unificado (D-11) el literal
 * viaja adentro del documento, que es donde la matriz lo quiere.
 *
 * ## Por qué sube la versión
 *
 * El texto cambió: el anterior hablaba solo del origen de los fondos, el de la
 * matriz suma la veracidad de la información. **Las evidencias ya guardadas
 * apuntan a `v1` y no se reescriben** (regla inviolable #10), así que la
 * cadena nueva es `v2` y la vieja se conserva para poder leer lo que ya se
 * aceptó.
 */
export const VERSION_DECLARACION_LICITUD_Y_VERACIDAD = "LICITUD-VERACIDAD-v2";

/** Literal exacto de la Matriz V4 §4, bloque "Licitud y veracidad". */
export const TEXTO_DECLARACION_LICITUD_Y_VERACIDAD =
  "Declaro que los fondos utilizados provienen de actividades lícitas y que la información " +
  "proporcionada es verdadera, completa y actual según mi leal saber y entender.";

/**
 * Versión y literal anteriores (L4b). **No se borran**: hay expedientes con
 * evidencias que apuntan a esta cadena exacta y la consola tiene que poder
 * leerlas (regla inviolable #10). Ningún expediente nuevo los usa.
 */
export const VERSION_DECLARACION_ORIGEN_LICITO_LEGADO = "P7-ORIGEN-LICITO-v1";

export const TEXTO_DECLARACION_ORIGEN_LICITO_LEGADO =
  "Declaro que los fondos utilizados para pagar el premio son de mi propiedad y tienen origen lícito.";

/**
 * Declaración de **cuenta propia**, literal de la Matriz V4 §4 (CMP-20).
 *
 * Su efecto según la matriz: *"Integra al FIPF. Si existe tercero, el flujo
 * automático se detiene y se identifica al mandante."* Ese corte no hace falta
 * implementarlo como rama: la regla inviolable #9 ya hace que no exista un
 * flujo de contratación para terceros — no hay dónde declarar un mandante
 * porque no hay campo, que es la forma fuerte de la misma regla.
 */
export const VERSION_DECLARACION_CUENTA_PROPIA = "CUENTA-PROPIA-v1";

export const TEXTO_DECLARACION_CUENTA_PROPIA =
  "Declaro que actúo por cuenta propia en esta contratación y en el pago, y que el tomador y el " +
  "asegurado son la misma persona.";

/**
 * Advertencia del art. 1556 del Código Civil paraguayo (CMP-09).
 *
 * La Matriz V4 §4 la marca como **inclusión obligatoria** y precisa dónde: *"En
 * la Solicitud y, en forma destacada, en el anverso de la póliza."* Lo que le
 * toca a este sistema es la primera mitad — la póliza la emite Alianza y su
 * anverso no se dibuja acá (CMP-18).
 *
 * El literal es el de la matriz, transcrito sin reescribir: es una cláusula
 * legal y parafrasearla cambiaría lo que la persona firmó.
 */
export const VERSION_ADVERTENCIA_ART_1556 = "ART-1556-v1";

export const TEXTO_ADVERTENCIA_ART_1556 =
  "Cuando el texto de la póliza difiera del contenido de la propuesta, la diferencia se considerará " +
  "aprobada por el tomador si no reclama dentro de un mes de haber recibido la póliza " +
  "(Art. 1556 del Código Civil Paraguayo).";

/**
 * Declaración de acceso y revisión que el cliente acepta al firmar (Matriz V4
 * §4, bloque "Firma del cliente").
 *
 * La matriz la describe como *"Casilla vacía + firma simple"*: es lo único que
 * la persona marca en la pantalla de firma, y su efecto es que *"una firma del
 * cliente cubre el PDF completo; el OTP previo respalda identificación y
 * trazabilidad"*.
 */
export const VERSION_DECLARACION_ACCESO_Y_REVISION = "ACCESO-REVISION-v1";

export const TEXTO_DECLARACION_ACCESO_Y_REVISION =
  "Confirmo que tuve acceso al PDF único de Solicitud + FIPF, pude revisarlo y corregir mis datos, " +
  "acepto su contenido y deseo firmarlo mediante Code100.";

// ---------------------------------------------------------------------------
// Textos fijos del resto de la pantalla
// ---------------------------------------------------------------------------

export const TITULO_P6 = "Datos y declaraciones";

export const SUBTITULO_P6 =
  "Completá la información requerida para preparar la Solicitud y el FIPF.";

export const ADVERTENCIA_P6 = "Todavía no estás firmando, pagando ni autorizando un cobro.";

export const NOTA_BENEFICIARIO_DESIGNADO_P6 = "Una persona designada recibe el 100%.";

/** Bloque `REGLA AUTOMÁTICA DE ELEGIBILIDAD` (regla de negocio inviolable #5). */
export const REGLA_ELEGIBILIDAD_P6 =
  "Una respuesta incompatible de salud, antecedentes, enfermedades diagnosticadas o PEP impide la " +
  "emisión automática: no se prepara el pago ni la firma. SeguroLoTengo genera un número de caso " +
  "distinto, envía la información a Interseguros y Alianza y, conforme a la autorización inicial, " +
  "podrán contactar al solicitante.";

/** Leyenda inferior de la pantalla. */
export const LEYENDA_DOCUMENTOS_P6 =
  "Las declaraciones médicas integrarán la Solicitud y la condición PEP integrará el FIPF; ambos se " +
  "cierran al salir de esta pantalla y se firman en el paso siguiente mediante Code100.";
