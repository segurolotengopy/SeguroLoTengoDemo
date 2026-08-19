/**
 * Literales de P9 · Contratación aceptada, transcritos de
 * docs/ESPECIFICACION_PANTALLAS.md → "P9 · Paso 9 de 9 — Contratación
 * aceptada".
 *
 * Mismo criterio que el resto de los `textos-*`: módulo sin ninguna dependencia
 * (ni siquiera `node:*`) porque lo consumen las dos orillas.
 *
 * ## Respaldo normativo
 *
 * Filas de `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv`, categoría
 * "R5 - ACEPTACIÓN, EMISIÓN Y PÓLIZA" salvo donde se indica:
 *
 * - 43 — Firma confirmada → cobro → envío a Alianza → validación automática →
 *   emisión (Código Civil, arts. 1348 y 1373-1374).
 * - 47 — Vincular póliza, Solicitud, FIPF, pago y firmas mediante correlativos
 *   o hashes (Res. SS SG. 215/15, punto 14; Ley 6822/21, arts. 44-46).
 * - 50 — Iniciar cobertura 24 horas después de confirmarse el pago; **debe
 *   constar expresamente** (Res. SS SG. 215/15, Anexo 1, numeral 6.13.14;
 *   Código Civil, art. 1374). Por eso el inicio de cobertura se informa en la
 *   póliza que emite Alianza y esta pantalla lo dice en vez de calcularlo.
 * - 39 — Alianza firma la póliza mediante firma electrónica cualificada
 *   ("R4"; Res. SS SG. 215/15, art. 1; Ley 6822/21, arts. 38(2) y 43).
 * - 40 — La factura electrónica la emite SIFEN y **no** se firma con Code100
 *   ("R4"; Ley 4868/13, arts. 31-32; Ley 125/91, art. 85).
 *
 * ## No se genera Nota de Cobertura
 *
 * La leyenda no es decorativa: el producto no la contempla (CLAUDE.md → "Qué no
 * hacer"). No hay tipo, ni endpoint, ni método de proveedor que la produzca.
 */

export const TITULO_P9 = "¡Tu solicitud de seguro fue aceptada!";

export const BAJADA_P9 =
  "Alianza Garantía emitirá tu póliza y la recibirás en breves momentos en tu correo y WhatsApp verificados.";

export const ROTULO_PRODUCTO_P9 = "SEGURO DE VIDA ONCOLÓGICO";

// ---------------------------------------------------------------------------
// `ESTADO DE LA CONTRATACIÓN` — cuatro hitos
// ---------------------------------------------------------------------------

export const TITULO_ESTADO_CONTRATACION = "ESTADO DE LA CONTRATACIÓN";

export type EstadoHitoP9 = "COMPLETADO" | "PENDIENTE";

export interface HitoContratacion {
  readonly numero: 1 | 2 | 3 | 4;
  readonly titulo: string;
  readonly detalle: string;
}

export const HITOS_CONTRATACION: readonly HitoContratacion[] = [
  {
    numero: 1,
    titulo: "Firmas Code100",
    detalle: "Solicitud y FIPF completamente firmados.",
  },
  { numero: 2, titulo: "Pago Bancard", detalle: "Pago confirmado e identificado." },
  {
    numero: 3,
    titulo: "Solicitud aceptada",
    detalle: "Validación automática de Alianza Garantía.",
  },
  {
    numero: 4,
    titulo: "Póliza en preparación",
    detalle: "Emisión y envío en breves momentos, a cargo de Alianza Garantía.",
  },
];

// ---------------------------------------------------------------------------
// `RESUMEN DE LA CONTRATACIÓN`
// ---------------------------------------------------------------------------

export const TITULO_RESUMEN_CONTRATACION = "RESUMEN DE LA CONTRATACIÓN";

export const ROTULO_NUMERO_PROPUESTA_P9 = "Número de propuesta";
export const ROTULO_ESTADO_SOLICITUD_P9 = "Estado de la solicitud";
export const ROTULO_REFERENCIA_BANCARD_P9 = "Referencia Bancard";
export const ROTULO_ASEGURADO_P9 = "Asegurado";
export const ROTULO_DOCUMENTO_P9 = "Documento";
export const ROTULO_MEDIO_DE_PAGO_P9 = "Medio de pago";
export const ROTULO_ESTADO_POLIZA_P9 = "Estado de la póliza";

export const VALOR_ESTADO_SOLICITUD_ACEPTADA = "ACEPTADA";

export const ROTULO_ESTADO_POLIZA: Readonly<Record<string, string>> = {
  EN_PROCESO_DE_EMISION: "EN PROCESO DE EMISIÓN",
  EMITIDA: "EMITIDA",
  RECHAZADA: "RECHAZADA",
};

export const TITULO_IMPORTANTE_P9 = "IMPORTANTE";

export const AVISOS_IMPORTANTE_P9: readonly string[] = [
  "La póliza será emitida por Alianza Garantía y entregada en breves momentos.",
  "La recibirás en el correo y el WhatsApp que verificaste.",
  "El inicio de cobertura será informado en la póliza electrónica emitida por Alianza Garantía.",
];

// ---------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------

export const TITULO_DOCUMENTOS_QUE_RECIBIRAS = "DOCUMENTOS QUE RECIBIRÁS EN BREVES MOMENTOS";

export const BADGE_EN_EMISION = "EN EMISIÓN";
export const BADGE_EMITIDA = "EMITIDA";

export interface DocumentoPorRecibir {
  readonly nombre: string;
  readonly detalle: string;
}

export const DOCUMENTOS_POR_RECIBIR: readonly DocumentoPorRecibir[] = [
  {
    nombre: "Póliza electrónica",
    detalle: "La emite y la envía Alianza Garantía por correo y WhatsApp.",
  },
  {
    nombre: "Factura electrónica",
    detalle: "La emite Alianza Garantía por SIFEN y la envía a los mismos canales.",
  },
];

export const TITULO_DOCUMENTOS_PARA_DESCARGAR = "DOCUMENTOS DISPONIBLES PARA DESCARGAR";

export const NOMBRE_SOLICITUD_P9 = "Solicitud de Seguro de Vida Oncológico";
export const NOMBRE_FIPF_P9 = "Formulario de Identificación de Persona Física";

export const DETALLE_FIRMANTES_P9 =
  "Firmado por cliente, Interseguros y Alianza Garantía.";

export const BOTON_DESCARGAR_P9 = "DESCARGAR";

/** Leyenda obligatoria: el producto no contempla Nota de Cobertura. */
export const LEYENDA_SIN_NOTA_DE_COBERTURA = "No se genera Nota de Cobertura.";

// ---------------------------------------------------------------------------
// `¿QUÉ OCURRIRÁ AHORA?`
// ---------------------------------------------------------------------------

export const TITULO_QUE_OCURRIRA_P9 = "¿QUÉ OCURRIRÁ AHORA?";

export const PASOS_QUE_OCURRIRA_P9: readonly string[] = [
  "Emitir la póliza (Alianza mediante SEBAOT).",
  "Firmar la póliza (Alianza mediante Code100).",
  "Enviar al correo verificado.",
  "Enviar al WhatsApp verificado.",
];

// ---------------------------------------------------------------------------
// Pie
// ---------------------------------------------------------------------------

/**
 * Contactos institucionales. **Son marcadores**, igual que en la Pantalla A: el
 * PDF de referencia los deja como `[datos oficiales]`, así que acá tampoco se
 * inventa un teléfono ni un correo. Reemplazarlos por los reales antes de
 * cualquier uso que no sea la demostración.
 */
export interface ContactoP9 {
  readonly actor: string;
  readonly rol: string;
  readonly datos: string;
}

export const CONTACTOS_P9: readonly ContactoP9[] = [
  {
    actor: "Alianza Garantía Seguros y Reaseguros S.A.",
    rol: "Emisión, cobertura y reclamos",
    datos: "[datos oficiales]",
  },
  {
    actor: "Interseguros S.A. — Corredores de Seguros",
    rol: "Asistencia y seguimiento",
    datos: "[datos oficiales]",
  },
];

export const TITULO_COMUNICACIONES_COMERCIALES = "COMUNICACIONES COMERCIALES · OPCIONAL";

/**
 * Checkbox **desmarcado por defecto**, y eso es lo importante: un consentimiento
 * de marketing premarcado no es consentimiento (Ley 4868/13, art. 7(r);
 * Ley 1682/01 sobre datos personales). Es opcional y revocable, y no condiciona
 * nada del contrato ya celebrado.
 */
export const TEXTO_COMUNICACIONES_COMERCIALES =
  "Quiero recibir por WhatsApp y correo ofertas de otros seguros comercializados por Interseguros. " +
  "Puedo revocar esta autorización en cualquier momento.";

export const VERSION_COMUNICACIONES_COMERCIALES = "2026-01-P9-v1";

export const ROTULO_BOTON_FINALIZAR_P9 = "FINALIZAR / Volver al inicio";

/**
 * CHG-46 · leyenda de cierre, debajo del botón FINALIZAR.
 *
 * Lo último que lee la persona no debería ser un botón que la echa: acá
 * termina el trámite digital, pero no la relación con el corredor. La pidió
 * Rodrigo al cerrar el repaso de la pantalla (reunión 00:43:59).
 */
export const LEYENDA_CIERRE_P9 =
  "Interseguros continuará brindándote asesoramiento y asistencia durante todo el proceso.";
