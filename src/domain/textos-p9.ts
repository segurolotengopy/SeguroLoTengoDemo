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
 *   o hashes (Res. SS SG. 215/17, punto 14; Ley 6822/21, arts. 44-46).
 * - 50 — Iniciar cobertura 24 horas después de confirmarse el pago; **debe
 *   constar expresamente** (Res. SS SG. 215/17, Anexo 1, numeral 6.13.14;
 *   Código Civil, art. 1374). Desde D-12 esa fecha **consta acá y en el
 *   Certificado de Cobertura Provisional**, calculada al acreditarse el cobro;
 *   antes la pantalla remitía a la póliza porque el portal todavía no la
 *   sabía.
 * - 39 — Alianza firma la póliza mediante firma electrónica cualificada
 *   ("R4"; Res. SS SG. 215/17, art. 1; Ley 6822/21, arts. 38(2) y 43).
 * - 40 — La factura electrónica la emite SIFEN y **no** se firma con Code100
 *   ("R4"; Ley 4868/13, arts. 31-32; Ley 125/91, art. 85).
 *
 * ## No se genera Nota de Cobertura
 *
 * La leyenda no es decorativa: el producto no la contempla (CLAUDE.md → "Qué no
 * hacer"). No hay tipo, ni endpoint, ni método de proveedor que la produzca.
 */

import { flujoV3Activo } from "./flujo-vigente";

// v3 (F5): el título del canvas. El v2 conserva el suyo hasta el retiro.
export const TITULO_P9 = flujoV3Activo()
  ? "¡Listo! Tu familia ya está protegida"
  : "¡Tu solicitud de seguro fue aceptada!";

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

/**
 * Los cuatro hitos del wireframe p.8 (CHG-40), en el orden en que ocurren
 * desde D-08: **primero se firma y después se cobra**.
 *
 * El tercero es el que cambió con D-12: era `Solicitud aceptada`, un hito que
 * describía una validación interna de Alianza; ahora nombra el documento que
 * la persona efectivamente recibe y puede descargar. La aceptación de la
 * solicitud no desapareció —es lo que habilita el cuarto hito— pero dejó de
 * ser lo que este bloque destaca: entre "un sistema validó tu caso" y "tenés
 * tu certificado de cobertura", lo segundo es lo que la persona vino a buscar.
 */
export const HITOS_CONTRATACION: readonly HitoContratacion[] = [
  {
    numero: 1,
    titulo: "Firma electrónica confirmada",
    detalle: "Solicitud y FIPF firmados por vos, Interseguros y Alianza Garantía.",
  },
  { numero: 2, titulo: "Pago confirmado", detalle: "Cobro acreditado e identificado por Bancard." },
  {
    numero: 3,
    titulo: "Certificado de Cobertura Provisional",
    detalle: "Emitido y firmado por Alianza Garantía.",
  },
  {
    numero: 4,
    titulo: "Emisión de la póliza y la factura",
    detalle: "En proceso en el sistema de Alianza Garantía.",
  },
];

// ---------------------------------------------------------------------------
// Banda de pago confirmado y bloque de inicio de cobertura (CHG-40/41)
// ---------------------------------------------------------------------------

export const TITULO_PAGO_CONFIRMADO_P9 = "Pago confirmado por Bancard";

export const ROTULO_PREMIO_PAGADO_P9 = "Premio total pagado";
export const ROTULO_OPERACION_P9 = "Operación N.º";

export const TITULO_INICIO_COBERTURA_P9 = "Inicio de la cobertura";

/**
 * CHG-41 · la frase del wireframe decía *"48 horas después de la confirmación
 * del pago"*. **Son 24**, y no es un ajuste de redacción: es lo que la persona
 * firmó en la declaración 4 de las declaraciones y lo que dice el certificado.
 * Un número distinto en la pantalla y en el documento sería una contradicción
 * entre dos cosas que la misma persona tiene a la vista.
 *
 * La fecha concreta no se calcula acá: sale del certificado, que la fijó al
 * acreditarse el cobro (`certificado-cobertura.ts`).
 */
export const DETALLE_INICIO_COBERTURA_P9 =
  "24 horas exactas después de la confirmación del pago.";

export const ROTULO_FIN_VIGENCIA_P9 = "Vigencia hasta";

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

/**
 * El tercer aviso decía *"el inicio de cobertura será informado en la póliza
 * electrónica"*, y era verdad mientras el portal no supiera la fecha. Con el
 * certificado (D-12) sí la sabe, la muestra y la imprime, así que remitir a un
 * documento que todavía no llegó habría sido esconder un dato que ya está.
 */
export const AVISOS_IMPORTANTE_P9: readonly string[] = [
  "La póliza será emitida por Alianza Garantía y entregada en breves momentos.",
  "La recibirás en el correo y el WhatsApp que verificaste.",
  "El Certificado de Cobertura Provisional ya está disponible para descargar: es tu respaldo hasta que llegue la póliza.",
];

// ---------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------

export const TITULO_DOCUMENTOS_QUE_RECIBIRAS = "Y ESTOS TE LLEGAN EN BREVE";

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

/**
 * El canvas agrupa todo bajo «Tus documentos» y no separa lo descargable de
 * lo que llega después: para quien mira son sus documentos, y el estado de
 * cada uno lo dice la tarjeta (observación de Andres, 01-sep).
 */
export const TITULO_DOCUMENTOS_PARA_DESCARGAR = "TUS DOCUMENTOS";

/** D-11 · un solo documento firmado para descargar: Solicitud + FIPF. */
export const NOMBRE_DOCUMENTO_P9 = "Solicitud de Seguro de Vida Oncológico y FIPF (firmado)";

export const DETALLE_FIRMANTES_P9 =
  "Firmado por cliente, Interseguros y Alianza Garantía.";

/** D-12 · el certificado, segundo descargable. */
export const NOMBRE_CERTIFICADO_P9 = "Certificado de Cobertura Provisional";

export const DETALLE_CERTIFICADO_P9 =
  "Firmado por Alianza Garantía. Es tu respaldo desde el inicio de la cobertura y hasta que llegue la póliza.";

/** D-05 · el comprobante del pago, tercer descargable. */
export const NOMBRE_COMPROBANTE_P9 = "Comprobante de pago del premio";

export const DETALLE_COMPROBANTE_P9 =
  "Constancia del cobro acreditado por Bancard. No es la factura: la emite Alianza Garantía por SIFEN.";

export const BOTON_DESCARGAR_P9 = "DESCARGAR";

// ---------------------------------------------------------------------------
// Entrega de documentos (wireframe p.8)
// ---------------------------------------------------------------------------

export const TITULO_ENTREGA_P9 = "RECIBIRÁS LOS DOCUMENTOS EN";

export const BAJADA_ENTREGA_P9 =
  "Alianza Garantía revisará la solicitud y enviará los documentos directamente a tus canales verificados.";

export const ROTULO_CANAL_CORREO_P9 = "Correo";
export const ROTULO_CANAL_WHATSAPP_P9 = "WhatsApp";

/**
 * CHG-44 · el estado de la entrega, canal por canal.
 *
 * `ENVIADO` y `ACUSADO` se dicen distinto a propósito: el proveedor acepta un
 * mensaje mucho antes de que llegue, y CMP-05 pide registrar el acuse, no el
 * envío. Llamar "entregado" a lo que solo fue aceptado le mentiría a la
 * persona sobre algo que puede comprobar mirando su teléfono.
 */
export const ROTULO_ESTADO_ENTREGA: Readonly<Record<string, string>> = {
  PENDIENTE: "En cola de envío",
  ENVIADO: "Enviado, esperando confirmación",
  ACUSADO: "Entregado",
  FALLIDO: "No se pudo entregar",
};

/**
 * Qué hacer cuando la entrega no llegó. La descarga sigue disponible, así que
 * el mensaje no es una disculpa sino una salida: dice qué hacer, no solo qué
 * pasó.
 */
export const LEYENDA_ENTREGA_FALLIDA_P9 =
  "No pudimos entregarte los documentos por ese canal. Descargalos de esta pantalla y escribinos si necesitás que te los reenviemos.";

/** Leyenda obligatoria: el producto no contempla Nota de Cobertura. */
export const LEYENDA_SIN_NOTA_DE_COBERTURA = "No se genera Nota de Cobertura.";

// ---------------------------------------------------------------------------
// `¿QUÉ OCURRIRÁ AHORA?`
// ---------------------------------------------------------------------------

export const TITULO_QUE_OCURRIRA_P9 = "¿QUÉ OCURRIRÁ AHORA?";

export const PASOS_QUE_OCURRIRA_P9: readonly string[] = [
  "Emitir la póliza (Alianza mediante SEBAOT).",
  "Firmar la póliza (Alianza, con firma electrónica cualificada).",
  "Enviar al correo verificado.",
  "Enviar al WhatsApp verificado.",
];

// ---------------------------------------------------------------------------
// Pie
// ---------------------------------------------------------------------------

/**
 * CHG-45 · el bloque `¿Necesitás ayuda?` del wireframe p.8.
 *
 * Los datos ya no viven acá. Salían de este módulo como `[datos oficiales]`
 * —un marcador que en la pantalla se veía como un marcador— y ahora salen de
 * `src/domain/entidades.ts`, que es la fuente única de razón social,
 * domicilio, teléfono, correo y sitio de las dos entidades. Lo que la matriz
 * todavía no cerró (D-19) sigue viajando como `null` y **la pantalla lo
 * omite**: mostrar un hueco rotulado es peor que no mostrar la línea.
 */
export const TITULO_AYUDA_P9 = "¿NECESITÁS AYUDA?";

export const BAJADA_AYUDA_P9 =
  "Escribinos por cualquier duda sobre tu contratación, tu cobertura o tus documentos.";

/**
 * D-17 · botón de WhatsApp directo con Interseguros, **solo en esta pantalla**
 * salvo que se lo extienda por flag. Sin número configurado no se dibuja.
 */
export const BOTON_WHATSAPP_P9 = "ESCRIBIR POR WHATSAPP";

/** Mensaje con el que se abre el chat: la persona no debería tener que explicar quién es. */
export function mensajeWhatsappP9(numeroPropuesta: string): string {
  return `Hola, necesito ayuda con mi contratación ${numeroPropuesta}.`;
}

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
