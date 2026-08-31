/**
 * Textos de la Pantalla A · Emisión no automática, transcritos de
 * docs/ESPECIFICACION_PANTALLAS.md → "Pantalla A · Emisión no automática
 * (derivación a revisión manual)".
 *
 * Mismo criterio que `textos-p3.ts` y `textos-p6.ts`: módulo sin ninguna
 * dependencia (ni siquiera `node:*`) porque lo consumen el componente de
 * servidor de la pantalla y el de cliente que trae el caso.
 *
 * Respaldo normativo de la derivación en sí: filas 19 y 21 de `docs/Tabla
 * Cumplimiento SeguroLo Tengo - Tabla.csv` — *"Derivar una respuesta PEP a
 * análisis reforzado, sin rechazo automático"* (Res. SEPRELAD 50/20, art. 7) y
 * *"Proteger especialmente las respuestas médicas y la información PEP"* (Ley
 * 4868/13, arts. 6(a) y 7(b); Res. SEPRELAD 71/19, art. 44). La autorización
 * que esta pantalla invoca es la de P3, fila 11 (Ley 4868/13, arts. 6(c) y
 * 7(r)).
 *
 * **Los datos de contacto son marcadores.** El PDF de referencia los deja como
 * `[datos oficiales]`, así que acá tampoco se inventan un teléfono ni un
 * correo: hay que reemplazarlos por los reales antes de cualquier uso que no
 * sea la demostración.
 */

import { flujoV3Activo } from "./flujo-vigente";

// v3 (F5): los textos del canvas — «no es un rechazo» dicho de frente.
export const TITULO_PANTALLA_A = flujoV3Activo()
  ? "Tu solicitud queda en buenas manos"
  : "Tu solicitud requiere una revisión adicional";

export const BAJADA_PANTALLA_A = flujoV3Activo()
  ? "Por lo que declaraste, tu seguro no puede emitirse automáticamente — y eso no es un " +
    "rechazo. Un asesor de Interseguros y Alianza Garantía va a analizar tu caso y te contacta " +
    "por tus canales verificados. Nada se movió de tu bolsillo: no se generó póliza, no se " +
    "pidió ninguna firma y no se realizó ni autorizó ningún pago."
  :   "Por la información declarada, la póliza no puede emitirse automáticamente. Interseguros y " +
  "Alianza Garantía analizarán el caso y podrán contactarte por los canales que verificaste.";
/** Rótulo del bloque derecho del encabezado. */
export const ROTULO_PRODUCTO_PANTALLA_A = "Seguro de Vida Oncológico";
export const ROTULO_MODO_PANTALLA_A = "Revisión manual";

// ---------------------------------------------------------------------------
// `ESTADO DEL CASO` — cuatro hitos
// ---------------------------------------------------------------------------

export type EstadoHito = "COMPLETADO" | "DERIVACION" | "PENDIENTE";

export interface HitoCaso {
  readonly numero: 1 | 2 | 3 | 4;
  readonly titulo: string;
  readonly estado: EstadoHito;
  readonly detalle: string;
}

export const HITOS_CASO: readonly HitoCaso[] = [
  { numero: 1, titulo: "Datos verificados", estado: "COMPLETADO", detalle: "Completado" },
  { numero: 2, titulo: "Declaraciones recibidas", estado: "COMPLETADO", detalle: "Completado" },
  {
    numero: 3,
    titulo: "Revisión requerida",
    estado: "DERIVACION",
    detalle: "Derivación automática: se detuvo la emisión automática",
  },
  {
    numero: 4,
    titulo: "Análisis y contacto",
    estado: "PENDIENTE",
    detalle: "Pendiente de análisis",
  },
];

// ---------------------------------------------------------------------------
// `NO SE INICIÓ LA EMISIÓN`
// ---------------------------------------------------------------------------

export const TITULO_SIN_EMISION = "No se inició la emisión";

export const PUNTOS_SIN_EMISION: readonly string[] = [
  "No se generó una póliza ni se inició su emisión.",
  "No se solicitó ninguna firma de contratación.",
  "No se realizó ni se autorizó ningún pago.",
];

// ---------------------------------------------------------------------------
// `INFORMACIÓN ENVIADA PARA EL ANÁLISIS`
// ---------------------------------------------------------------------------

export const TITULO_INFORMACION_ENVIADA = "Información enviada para el análisis";

export const PUNTOS_INFORMACION_ENVIADA: readonly string[] = [
  "Identificación y datos de contacto",
  "Declaraciones relevantes",
  "Evidencias y trazabilidad",
];

export const TITULO_AUTORIZACION_OTORGADA = "Autorización ya otorgada";

export const TEXTO_AUTORIZACION_OTORGADA =
  "Conforme al consentimiento general que otorgaste al comenzar, autorizaste el análisis de tu " +
  "caso por parte de Interseguros y Alianza Garantía, y que puedan contactarte.";

// ---------------------------------------------------------------------------
// `¿QUÉ OCURRIRÁ AHORA?`
// ---------------------------------------------------------------------------

export const TITULO_QUE_OCURRIRA = "¿Qué ocurrirá ahora?";

export interface PasoSiguiente {
  readonly numero: 1 | 2 | 3 | 4;
  readonly titulo: string;
  readonly detalle: string;
}

export const PASOS_SIGUIENTES: readonly PasoSiguiente[] = [
  {
    numero: 1,
    titulo: "Remisión segura",
    detalle: "Tu caso viaja a Interseguros y Alianza Garantía con sus evidencias y trazabilidad.",
  },
  {
    numero: 2,
    titulo: "Análisis",
    detalle: "Alianza Garantía analiza el riesgo con la información declarada.",
  },
  {
    numero: 3,
    titulo: "Contacto",
    detalle: "Si hace falta, te contactan por tu WhatsApp o tu correo verificados.",
  },
  {
    numero: 4,
    titulo: "Resultado",
    detalle: "Te informan la resolución del análisis por los mismos canales.",
  },
];

// ---------------------------------------------------------------------------
// Pie
// ---------------------------------------------------------------------------

export interface ContactoInstitucional {
  readonly organizacion: string;
  readonly rol: string;
  /** Marcador: reemplazar por el dato oficial antes de un uso real. */
  readonly telefono: string;
  readonly correo: string;
}

export const CONTACTOS_PANTALLA_A: readonly ContactoInstitucional[] = [
  {
    organizacion: "Alianza Garantía Seguros y Reaseguros S.A.",
    rol: "Análisis del riesgo",
    telefono: "[dato oficial pendiente]",
    correo: "[dato oficial pendiente]",
  },
  {
    organizacion: "Interseguros S.A. — Corredores de Seguros",
    rol: "Asistencia y seguimiento",
    telefono: "[dato oficial pendiente]",
    correo: "[dato oficial pendiente]",
  },
];

export const LEYENDA_NO_ES_RECHAZO =
  "Una derivación a revisión no significa un rechazo definitivo.";

export const LEYENDA_CORRELATIVO_DISTINTO =
  "El número de caso de revisión es distinto del correlativo de una propuesta o de una póliza.";

/**
 * `Regla del sistema` de la especificación. No es un texto decorativo: es lo
 * que la regla inviolable #5 hace imposible de violar en el código, y
 * `src/app/api/__tests__/derivado-manual-sin-salida.test.ts` lo verifica
 * llamando a todos los casos de uso del flujo con un expediente derivado.
 */
export const REGLA_DEL_SISTEMA_PANTALLA_A =
  "Desde este estado el proceso digital no continúa a pago mediante Bancard, ni a la firma " +
  "electrónica del paquete documental, ni a emisión mediante SEBAOT.";

export const ROTULO_BOTON_FINALIZAR = "Finalizar / Volver al inicio";
