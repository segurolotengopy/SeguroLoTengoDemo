/**
 * Literales del Paso 1 · Selección del plan, en el formato de la maqueta
 * (`docs/antecedentes/PantallasDemo2.pdf`, p.1; reformulación en
 * `docs/plan/REFORMULACION_PANTALLAS_MAQUETA.md`).
 *
 * Mismo criterio que el resto de los `textos-*`: módulo sin dependencias,
 * fuente única para el lint de copys y para las dos orillas.
 *
 * Los importes y coberturas NO viven acá: salen de `catalogo.ts` (D-04). Lo
 * que vive acá es lo que la maqueta dice, palabra por palabra, con las
 * correcciones que la reunión y las decisiones le hicieron encima — cada una
 * anotada donde ocurre.
 */

export const SUBTITULO_PLAN = "Elegí el plan que mejor se adapta a vos";

export const ROTULO_PRODUCTO_INSCRITO = "Producto inscrito:";

// ---------------------------------------------------------------------------
// Video informativo (la maqueta lo trae en esta pantalla)
// ---------------------------------------------------------------------------

export const TITULO_VIDEO_PLAN = "VIDEO INFORMATIVO";
export const BAJADA_VIDEO_PLAN = "Conocé el producto en 60 segundos";

// ---------------------------------------------------------------------------
// Tarjetas de plan
// ---------------------------------------------------------------------------

export const LEYENDA_PREMIO_TARJETA = "Premio total anual · IVA incluido";

/** Filas de cobertura de la tarjeta, en el orden y con los rótulos de la maqueta. */
export const ROTULO_COBERTURA_CANCER = "Diagnóstico de cáncer:";
export const ROTULO_COBERTURA_FALLECIMIENTO = "Fallecimiento:";
export const ROTULO_COBERTURA_RENTA = "Renta hospitalaria:";
export const ROTULO_COBERTURA_ACCIDENTE = "Gastos médicos por accidente:";

export const ENLACE_INFO_COBERTURAS = "+ Info sobre coberturas, exclusiones y condiciones.";

export const RADIO_ELEGIR_PLAN = "Elegir esta opción";
export const RADIO_PLAN_SELECCIONADO = "Plan seleccionado";
export const CINTA_PLAN_SELECCIONADO = "★ PLAN SELECCIONADO";

// ---------------------------------------------------------------------------
// Franja `Información relevante`
// ---------------------------------------------------------------------------

export const TITULO_INFORMACION_RELEVANTE = "Información relevante";

export interface ItemInformacionRelevante {
  readonly rotulo: string;
  readonly detalle: string;
}

export const INFORMACION_RELEVANTE: readonly ItemInformacionRelevante[] = [
  { rotulo: "Edad de ingreso", detalle: "18 a 64 años." },
  {
    rotulo: "Carencias",
    detalle: "cáncer 180 días · renta hospitalaria 30 días · demás coberturas 1 día.",
  },
  {
    rotulo: "Inicio de cobertura",
    detalle: "La cobertura comienza 24 horas después de confirmarse el pago.",
  },
];

// ---------------------------------------------------------------------------
// Nota legal y botón
// ---------------------------------------------------------------------------

/**
 * Literal de la maqueta. Impersonal a propósito: no le pide nada a la
 * persona, describe el alcance jurídico del paso.
 */
export const NOTA_LEGAL_PLAN =
  "El continuar con la selección del plan no implica la contratación del seguro, la firma de " +
  "documentos, el inicio de la cobertura ni la obligación de pago de prima. No obstante, al " +
  "continuar con la siguiente pantalla se entiende que el usuario ha leído y comprendido toda " +
  "la información presentada.";

export const BOTON_CONTINUAR_PLAN = "CONTINUAR CON EL PLAN SELECCIONADO →";
