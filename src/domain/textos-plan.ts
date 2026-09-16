/**
 * Literales del Paso 1 · Selección del plan.
 *
 * **Reescrito el 15-sep-2026 sobre el handoff de pantallas v4** (D-28): la
 * fuente pasa a ser `PANTALLA_02_SELECCION_PLAN_APROBADA_FINAL.png` más el
 * manual funcional, no ya `docs/antecedentes/PantallasDemo2.pdf`. Este
 * archivo reemplaza los literales anteriores de la maqueta v2/v3.
 *
 * Mismo criterio que el resto de los `textos-*`: módulo sin dependencias,
 * fuente única para el lint de copys y para las dos orillas.
 *
 * Los importes y coberturas NO viven acá: salen de `catalogo.ts` (D-04, con
 * los valores VIVE del manual v4). Lo que vive acá es lo que el arte dice,
 * palabra por palabra, adaptado a voseo (D-35) donde corresponde.
 */

/**
 * Textos v4 de la pantalla 02 (Selección de plan), transcritos de
 * `PANTALLA_02_SELECCION_PLAN_APROBADA_FINAL.png` y adaptados a voseo (D-35),
 * ver `docs/recepcion/2026-09-14-interseguros/02-pantallas-v4/textos/01-02_portada_y_plan.md`.
 * El arte usa "usted"; la adaptación a voseo del proyecto está anotada en la
 * tabla de esa transcripción.
 */
export const SUBTITULO_PLAN = "Elegí el plan que mejor se adapte a vos.";

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

/** Filas de cobertura de la tarjeta, en el orden y con los rótulos del arte v4. */
export const ROTULO_COBERTURA_CANCER = "Diagnóstico de cáncer";
export const ROTULO_COBERTURA_FALLECIMIENTO = "Fallecimiento";
export const ROTULO_COBERTURA_RENTA = "Renta Hospitalaria por Accidente";
export const ROTULO_COBERTURA_ACCIDENTE = "Gastos Médicos por Accidente";

export const ENLACE_INFO_COBERTURAS = "Ver coberturas, exclusiones y condiciones";

export const RADIO_ELEGIR_PLAN = "Elegir esta opción";
export const RADIO_PLAN_SELECCIONADO = "Plan seleccionado";
export const CINTA_PLAN_SELECCIONADO = "★ PLAN SELECCIONADO";
export const ETIQUETA_PLAN_RECOMENDADO = "PLAN RECOMENDADO";

// ---------------------------------------------------------------------------
// Franja `Información relevante`
// ---------------------------------------------------------------------------

export const TITULO_INFORMACION_RELEVANTE = "Información relevante";

export interface ItemInformacionRelevante {
  readonly rotulo: string;
  readonly detalle: string;
}

/**
 * Carencias corregidas por el manual funcional v4 (p. 5, "Producto, planes y
 * condiciones congeladas"), que prevalece sobre el arte y sobre el valor
 * anterior de este archivo (180 días de cáncer / 30 de renta): cáncer 90
 * días; renta hospitalaria por accidente 1 día; gastos médicos por accidente
 * 1 día; fallecimiento sin carencia.
 *
 * El texto de "Inicio de cobertura" **no** se corrige a "al acreditarse el
 * pago" pese a que así lo dice el arte (02, 02A): es el conflicto abierto
 * C-3 (`ANALISIS.md` §6) contra CHG-41, que fija el inicio en 24 horas
 * exactas después del cobro acreditado. Hasta que Andres lo resuelva, rige
 * el texto vigente del repositorio.
 */
export const INFORMACION_RELEVANTE: readonly ItemInformacionRelevante[] = [
  { rotulo: "Edad de ingreso", detalle: "18 a 64 años." },
  {
    rotulo: "Carencias",
    detalle:
      "Cáncer: 90 días · Renta hospitalaria por accidente: 1 día · Gastos médicos por accidente: 1 día · Fallecimiento: sin carencia.",
  },
  {
    // C-3 (sin resolver): el texto vigente del repo, no "al acreditarse el pago".
    rotulo: "Inicio de cobertura",
    detalle: "La cobertura comienza 24 horas después de confirmarse el pago.",
  },
];

// ---------------------------------------------------------------------------
// Aclaración legal y botón
// ---------------------------------------------------------------------------

/**
 * Literal del arte v4 (registro NEUTRO, 1.ª persona: los consentimientos y
 * declaraciones en primera persona no se adaptan a voseo, D-35).
 */
export const ROTULO_ACLARACION_PLAN = "ACLARACIÓN:";

export const NOTA_LEGAL_PLAN =
  "Continuar con el plan seleccionado no implica, bajo ninguna circunstancia, la contratación " +
  "del seguro, la firma de documentos, la emisión de la póliza o de la factura, el inicio de la " +
  "cobertura ni la obligación de pagar la prima. Sin embargo, al presionar el botón «CONTINUAR» " +
  "para avanzar a la siguiente pantalla, confirmo que he leído y comprendido toda la información " +
  "presentada en la sección «Coberturas, exclusiones y condiciones».";

export const BOTON_CONTINUAR_PLAN = "CONTINUAR";

export const ENLACE_INFORMACION_LEGAL = "Información legal";

// ---------------------------------------------------------------------------
// Trámite que ya pasó este paso
// ---------------------------------------------------------------------------

/**
 * Lo que ve quien vuelve a `/plan` con un expediente que ya avanzó.
 *
 * No es un error: el trámite existe y está más adelante. Por eso el texto no
 * dice *"no se puede"* sino qué pasó y qué hacer — el botón lo pone
 * `destinoDelExpediente` (`rutas-flujo.ts`), que es quien sabe si se continúa
 * o si el trámite se cerró.
 */
export const TITULO_TRAMITE_EN_OTRO_PASO = "Ya tenés un trámite empezado";

export const DETALLE_TRAMITE_EN_OTRO_PASO =
  "Este trámite ya pasó la selección de plan, así que el plan elegido no se puede cambiar " +
  "desde acá. Podés retomarlo donde quedaste.";

/** Los estados terminales no se retoman: se consultan. */
export const DETALLE_TRAMITE_CERRADO =
  "Este trámite ya no está en curso, así que no vuelve a la selección de plan. En la pantalla " +
  "de tu trámite está el detalle de qué pasó y qué sigue.";

/**
 * Solo con `DEMO_MODE=true`. Quien está demostrando el producto necesita
 * empezar de cero muchas veces al día, y el camino sancionado para eso es el
 * botón `Reiniciar expediente` del panel — que olvida el expediente de este
 * navegador sin tocar el que quedó en la base (regla inviolable #10).
 */
export const AYUDA_DEMO_TRAMITE_EN_OTRO_PASO =
  "Demostración: para empezar un trámite nuevo, reiniciá el expediente desde el panel de demo.";
