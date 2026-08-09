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
 *   215/15, anexo 1, numerales 11.2 y 11.11.
 * - Declaración 8 (PEP): fila 18, *"Preguntar si el cliente es PEP o está
 *   relacionado con una PEP"*, Res. SEPRELAD 50/20, arts. 2-3; Res. SEPRELAD
 *   71/19, art. 26(1)(j). Y fila 19 para la derivación sin rechazo automático,
 *   Res. SEPRELAD 50/20, art. 7.
 * - Declaración 4 (inicio de cobertura a las 24 h del pago): fila 50, Res. SS
 *   SG. 215/15, Anexo 1, numeral 6.13.14; Código Civil, art. 1374.
 * - Declaración 6 (entrega digital): fila 53, Res. SS SG. 215/15, art. 4,
 *   primer párrafo; Ley 4868/13, art. 7(d).
 * - Declaración 7 (corredor y su remuneración): fila 1, Ley 4868/13, arts. 3,
 *   7(a) y 7(d); Ley 827/96, arts. 70-71; Res. SS SG. 223/17, numeral 9(c).
 */
import type { RespuestaDeclaracion } from "./tipos";

export const VERSION_TEXTOS_DECLARACIONES_P6 = "P6-DECLARACIONES-v1";

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
    texto:
      "Declaro que la cobertura comienza 24 horas después del pago confirmado, una vez completadas " +
      "la contratación y la emisión; revisé todas las carencias aplicables.",
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
  "firmarán en la Pantalla 8 mediante Code100.";
