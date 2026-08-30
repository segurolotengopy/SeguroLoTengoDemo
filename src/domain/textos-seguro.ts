/**
 * Textos del paso 2 del flujo v3 · «Elegí tu seguro» (`/seguro`), tal como
 * figuran en docs/ESPECIFICACION_PANTALLAS.md → "Paso 2" y decidieron DI-3 y
 * DI-8 (Bloque E de docs/plan/DECISIONES.md).
 *
 * Mismo criterio que `textos-inscripcion.ts`: los importan las dos orillas,
 * así que este módulo solo depende de otros módulos de dominio libres de
 * `node:*`. **Cambiar una palabra de un literal aceptado obliga a subir su
 * versión** — la evidencia guardada no se reescribe.
 *
 * Acá viven dos cosas versionadas:
 * - Las **5 preguntas** que la pantalla hace (reemplazan en v3 a las 8 de P6;
 *   el PDF sigue imprimiendo las 8 vía el mapa de `declaraciones-v3.ts`).
 * - La **aceptación agrupada 2** (DI-8): una casilla, cinco ítems, un literal
 *   persistido — es la fuente de las claves 5/6/7 del mapa.
 */
import { PLANES, formatearGuaranies } from "./catalogo";
import type { PlanId } from "./tipos";
import {
  CARENCIA_CANCER,
  CARENCIA_GENERAL,
  CARENCIA_RENTA,
} from "./certificado-cobertura";

// ---------------------------------------------------------------------------
// Las 5 preguntas (v3). Su respaldo de impresión son las 8 de `textos-p6.ts`.
// ---------------------------------------------------------------------------

export interface PreguntaSeguroV3 {
  /** Clave del mapa 5→8 (`declaraciones-v3.ts`). */
  readonly clave: "salud" | "antecedentes" | "enfermedades" | "pep" | "carencias";
  readonly titulo: string;
  readonly texto: string;
  /** Respuesta que deja avanzar. */
  readonly habilita: "SI" | "NO";
  /** Aviso que se muestra con la respuesta contraria. */
  readonly aviso: string;
  /** Nota expandible («Saber más»), si la pregunta la tiene. */
  readonly rotuloNota?: string;
  readonly nota?: string;
}

const AVISO_ASESOR =
  "Con esta respuesta tu solicitud pasa a un asesor antes de cualquier pago o firma.";

export const PREGUNTAS_SEGURO_V3: readonly PreguntaSeguroV3[] = [
  {
    clave: "salud",
    titulo: "Estado de salud",
    texto:
      "¿Te encontrás en buen estado de salud y contratás este seguro sin buscar cubrir una " +
      "enfermedad o diagnóstico que ya tengas?",
    habilita: "SI",
    aviso: `${AVISO_ASESOR} Te explicamos al final.`,
  },
  {
    clave: "antecedentes",
    titulo: "Antecedentes de contratación",
    texto: "¿Alguna aseguradora te rechazó, postergó o condicionó una solicitud de seguro similar?",
    habilita: "NO",
    aviso: AVISO_ASESOR,
  },
  {
    clave: "enfermedades",
    titulo: "Enfermedades diagnosticadas",
    texto:
      "¿Tenés diagnosticado cáncer, enfermedad cardiovascular, insuficiencia renal, diabetes, " +
      "esclerosis, enfermedad autoinmune o inmunodeficiente, hepatitis o cirrosis?",
    habilita: "NO",
    aviso: AVISO_ASESOR,
  },
  {
    clave: "pep",
    titulo: "Condición PEP",
    texto: "¿Sos una persona expuesta políticamente o estás vinculada a una?",
    habilita: "NO",
    aviso: "La condición PEP requiere el análisis de un asesor antes de cualquier pago o firma.",
    rotuloNota: "¿Qué significa PEP?",
    nota:
      "PEP es Persona Expuesta Políticamente: quien ocupa u ocupó en los últimos años un cargo " +
      "público relevante —electivo, de gobierno, judicial, militar o en empresas del Estado y " +
      "organismos internacionales—, y también sus familiares cercanos y sus asociados. Es una " +
      "pregunta obligatoria de la normativa de prevención de lavado de activos: responder Sí no " +
      "impide contratar, solo requiere el análisis de un asesor.",
  },
  {
    clave: "carencias",
    titulo: "Carencias e inicio de vigencia",
    texto:
      "¿Entendés y aceptás las carencias y el inicio de vigencia? Son los plazos que tienen que " +
      "pasar antes de poder usar cada cobertura: 180 días para el diagnóstico de cáncer, 30 días " +
      "para la renta hospitalaria y 1 día para el resto, contados desde que arranca tu " +
      "cobertura, 24 horas después de confirmado el pago.",
    habilita: "SI",
    aviso:
      "Sin esta aceptación no podemos avanzar: es la constancia de que conocés las carencias " +
      "antes de contratar. Si algo no te queda claro, un asesor te lo explica.",
    rotuloNota: "Ver el detalle completo",
    nota:
      "Si el diagnóstico o la internación ocurren dentro de esos plazos, no corresponde " +
      "indemnización. Los plazos se cuentan desde el inicio de vigencia —es decir, desde las 24 " +
      "horas posteriores a la confirmación del pago— y no desde hoy. Tampoco se cubren las " +
      "enfermedades preexistentes ni las diagnosticadas antes del inicio de vigencia. Esta " +
      "aceptación queda registrada en tu propuesta y en el FIPF como constancia de que conocías " +
      "las carencias antes de contratar.",
  },
];

export const VERSION_PREGUNTAS_SEGURO = "SEGURO-PREGUNTAS-v1";

// ---------------------------------------------------------------------------
// Aceptación agrupada 2 (DI-8)
// ---------------------------------------------------------------------------

export const ROTULO_ACEPTACION_SEGURO =
  "Marcá acá para aceptar las condiciones de tu plan — vigencia, carencias, entrega digital e " +
  "intermediación, en un solo paso.";

/** Los cinco ítems del expandible, en el orden del canvas. */
export const ITEMS_ACEPTACION_SEGURO: readonly string[] = [
  "Declaro que la cobertura comienza 24 horas después del pago confirmado, una vez completadas " +
    "la contratación y la emisión, y que leí las carencias explicadas arriba (180 días cáncer, " +
    "30 días renta hospitalaria, 1 día demás coberturas).",
  "Declaro que los datos proporcionados son verdaderos.",
  "Acepto recibir la póliza y la factura en mis canales verificados, y disponer de la Propuesta " +
    "y el FIPF firmados para descarga en SeguroLoTengo.",
  "Tomo conocimiento de que Interseguros S.A. es el corredor de esta póliza y de que su " +
    "remuneración será pagada por Alianza Garantía.",
  "Tomo conocimiento de que el diagnóstico confirmado de cáncer impide la renovación; la póliza " +
    "continúa hasta finalizar la vigencia contratada.",
];

/** El literal que se persiste como texto aceptado del paso. */
export const TEXTO_ACEPTACION_SEGURO = ITEMS_ACEPTACION_SEGURO.join(" ");

export const VERSION_ACEPTACION_SEGURO = "SEGURO-ACEPTACION-v1";

// ---------------------------------------------------------------------------
// «Tu plan, en claro»
// ---------------------------------------------------------------------------

export interface CoberturaEnClaro {
  readonly rotulo: string;
  readonly monto: string;
  readonly detalle: string;
}

/**
 * Las cuatro coberturas del plan con su carencia al lado, como pide el bloque
 * `QUÉ CUBRE Y DESDE CUÁNDO`. Montos del catálogo; carencias de las mismas
 * constantes que imprime el certificado (marcadores provisionales, DI-4).
 */
export function coberturasEnClaro(planId: PlanId): readonly CoberturaEnClaro[] {
  const plan = PLANES[planId];
  return [
    {
      rotulo: "Diagnóstico de cáncer",
      monto: formatearGuaranies(plan.indemnizacionCancerGs),
      detalle: `Pago único al confirmarse el diagnóstico cubierto. Carencia de ${CARENCIA_CANCER}.`,
    },
    {
      rotulo: "Fallecimiento",
      monto: formatearGuaranies(plan.muerteCualquierCausaGs),
      detalle: `Por cualquier causa, a tus beneficiarios. Carencia de ${CARENCIA_GENERAL}.`,
    },
    {
      rotulo: "Renta hospitalaria",
      monto: `${formatearGuaranies(plan.rentaHospitalariaPorDiaGs)} por día`,
      detalle: `Hasta 15 días por año de internación. Carencia de ${CARENCIA_RENTA}.`,
    },
    {
      rotulo: "Gastos médicos por accidente",
      monto: `hasta ${formatearGuaranies(plan.gastosMedicosAccidenteGs)}`,
      detalle: `Reembolso contra comprobantes. Carencia de ${CARENCIA_GENERAL}.`,
    },
  ];
}

export const LEYENDA_EDAD_Y_RENOVACION =
  "Edad de ingreso: 18 a 64 años. El diagnóstico confirmado de cáncer impide la renovación; la " +
  "póliza continúa hasta terminar la vigencia contratada.";
