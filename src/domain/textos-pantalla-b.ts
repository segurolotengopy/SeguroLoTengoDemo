/**
 * Textos de la Pantalla B · QR pagado, firma no completada, transcritos de
 * docs/ESPECIFICACION_PANTALLAS.md → "Pantalla B · QR pagado, firma no
 * completada".
 *
 * Mismo criterio que `textos-pantalla-a.ts`: módulo sin ninguna dependencia
 * (ni siquiera `node:*`) porque lo consumen el componente de servidor de la
 * pantalla y el de cliente que trae el caso.
 *
 * ## Respaldo normativo
 *
 * Filas de `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv`:
 *
 * - 28 — *"En QR, permitir pago anterior a la firma e informar la condición y
 *   devolución"* (Ley 4868/13, arts. 7(m, p, q) y 30(c)).
 * - 29 — *"Enviar recordatorios de firma a 1, 5 y 12 horas"*. La propia matriz
 *   aclara que **no existe un artículo que determine esos horarios**: son un
 *   control interno, no una obligación legal.
 * - 30 — *"Devolver el premio si el cliente no firma dentro del plazo
 *   comunicado"* (Ley 4868/13, arts. 7(f), 17 y 30(b); Res. SS SG. 215/15,
 *   Anexo 1, numerales 8.4, 8.5 y 8.9). Es la fila que manda en esta pantalla.
 * - 65 — *"Explicar cancelación y metodología de devolución"* (Ley 4868/13,
 *   arts. 7(m, p, q) y 30(c); Res. SS SG. 215/15, Anexo 1, numerales 8.4, 8.5
 *   y 8.9).
 * - 41 — la vigencia de 24 horas del enlace de firma, que es el plazo cuyo
 *   vencimiento trae a la persona hasta acá.
 *
 * ## Divergencia declarada de la especificación
 *
 * El documento escribe la pantalla para **un solo caso**: el QR pagado. Pero
 * P7 ofrece tres medios y dos de ellos mueven el dinero antes de la firma (QR
 * y débito) mientras que el tercero solo lo reserva (crédito) — ver
 * `MedioDePago` en `src/domain/tipos.ts`. Con crédito no hay premio que
 * devolver: hay una reserva que liberar, y decirle a la persona que se inició
 * un procedimiento de devolución sería describirle algo que no está pasando con
 * su plata (misma fila 25 que motivó la divergencia de P7).
 *
 * Por eso los literales están agrupados en dos variantes. Los del QR y el
 * débito son los del documento palabra por palabra; los del crédito se
 * escribieron para esta pantalla siguiendo el mismo registro.
 */

export const TITULO_PANTALLA_B = "Tu solicitud venció porque no completaste la firma";

export const BAJADA_PANTALLA_B =
  "Se inició el procedimiento de devolución del premio pagado mediante QR Bancard. Te informamos " +
  "por WhatsApp y correo verificados.";

/** Variante de crédito: no hay premio que devolver, hay reserva que liberar. */
export const BAJADA_PANTALLA_B_CREDITO =
  "No se completó ningún cobro: la reserva sobre tu tarjeta se libera y el importe vuelve a estar " +
  "disponible. Te informamos por WhatsApp y correo verificados.";

/** Rótulo del bloque derecho del encabezado. */
export const ROTULO_PRODUCTO_PANTALLA_B = "Seguro de Vida Oncológico";
export const ROTULO_MODO_PANTALLA_B = "Solicitud vencida";

// ---------------------------------------------------------------------------
// `SEGUIMIENTO DE FIRMA` — cuatro hitos
// ---------------------------------------------------------------------------

export const TITULO_SEGUIMIENTO_FIRMA = "SEGUIMIENTO DE FIRMA";

export interface HitoSeguimiento {
  /** Horas desde el pago confirmado. */
  readonly horas: 1 | 5 | 12 | 24;
  readonly rotulo: string;
  readonly detalle: string;
  /** El último hito no es un recordatorio: es el vencimiento. */
  readonly esVencimiento: boolean;
}

/**
 * Los cuatro hitos del seguimiento. Los tres primeros son **manuales**: los
 * hace Interseguros, no el sistema (bloque `ACTORES Y REGISTRO`). La pantalla
 * los muestra como parte del relato de lo que pasó, no como algo que esta
 * aplicación haya ejecutado.
 */
export const HITOS_SEGUIMIENTO: readonly HitoSeguimiento[] = [
  {
    horas: 1,
    rotulo: "1 HORA",
    detalle: "Alerta manual, recordatorio por WhatsApp.",
    esVencimiento: false,
  },
  { horas: 5, rotulo: "5 HORAS", detalle: "Segundo recordatorio.", esVencimiento: false },
  { horas: 12, rotulo: "12 HORAS", detalle: "Último recordatorio.", esVencimiento: false },
  {
    horas: 24,
    rotulo: "24 HORAS",
    detalle: "Solicitud vencida, notificación y devolución.",
    esVencimiento: true,
  },
];

// ---------------------------------------------------------------------------
// `RESUMEN DEL CASO`
// ---------------------------------------------------------------------------

export const TITULO_RESUMEN_CASO = "RESUMEN DEL CASO";

export const ROTULO_PROPUESTA_B = "Propuesta";
export const ROTULO_PAGO_BANCARD_B = "Pago Bancard";
export const ROTULO_PREMIO_B = "Premio";
export const ROTULO_ASEGURADO_B = "Asegurado";
export const ROTULO_DOCUMENTO_B = "Documento";
export const ROTULO_WHATSAPP_B = "WhatsApp verificado";
export const ROTULO_CORREO_B = "Correo verificado";

export const AVISO_SIN_POLIZA_NI_COBERTURA = "No existe póliza emitida ni cobertura iniciada.";

// ---------------------------------------------------------------------------
// `PROCEDIMIENTO DE DEVOLUCIÓN` — cuatro pasos
// ---------------------------------------------------------------------------

export const TITULO_PROCEDIMIENTO_DEVOLUCION = "PROCEDIMIENTO DE DEVOLUCIÓN";

export interface PasoDevolucion {
  readonly numero: 1 | 2 | 3 | 4;
  readonly titulo: string;
  readonly detalle: string;
}

export const PASOS_DEVOLUCION: readonly PasoDevolucion[] = [
  {
    numero: 1,
    titulo: "Notificación doble",
    detalle: "SeguroLoTengo te informa por WhatsApp y correo verificados.",
  },
  {
    numero: 2,
    titulo: "Presentación en Alianza",
    detalle: "Acudí a las oficinas de Alianza Garantía con tu cédula.",
  },
  {
    numero: 3,
    titulo: "Formulario firmado",
    detalle: "Firmá la solicitud presencial de devolución del premio.",
  },
  {
    numero: 4,
    titulo: "Devolución al origen",
    detalle: "Alianza devuelve únicamente al medio o cuenta de origen.",
  },
];

export const AVISO_DEVOLUCION_SOLO_AL_ORIGEN =
  "No se devuelve en efectivo, a terceros ni a otra cuenta.";

/** Variante de crédito: la liberación de la reserva no tiene trámite presencial. */
export const TITULO_LIBERACION_RESERVA = "LIBERACIÓN DE LA RESERVA";

export const PASOS_LIBERACION_RESERVA: readonly PasoDevolucion[] = [
  {
    numero: 1,
    titulo: "Notificación doble",
    detalle: "SeguroLoTengo te informa por WhatsApp y correo verificados.",
  },
  {
    numero: 2,
    titulo: "Liberación en Bancard",
    detalle: "Se cancela la preautorización: el importe nunca salió de tu cuenta.",
  },
  {
    numero: 3,
    titulo: "Disponibilidad",
    detalle: "El límite vuelve a estar disponible en el plazo que fije tu banco emisor.",
  },
  {
    numero: 4,
    titulo: "Sin trámite presencial",
    detalle: "No hay formulario que firmar ni que acudir a las oficinas: no hubo cobro.",
  },
];

export const AVISO_LIBERACION_SIN_COBRO =
  "No se realizó ningún cobro, así que no hay premio que devolver.";

// ---------------------------------------------------------------------------
// `ACTORES Y REGISTRO`
// ---------------------------------------------------------------------------

export const TITULO_ACTORES_Y_REGISTRO = "ACTORES Y REGISTRO";

export interface ActorPantallaB {
  readonly actor: string;
  readonly rol: string;
}

export const ACTORES_PANTALLA_B: readonly ActorPantallaB[] = [
  {
    actor: "SeguroLoTengo",
    rol: "Controla el plazo, registra el estado y genera las comunicaciones.",
  },
  {
    actor: "Interseguros",
    rol: "Verifica manualmente la firma y realiza los recordatorios de 1, 5 y 12 horas.",
  },
  {
    actor: "Alianza Garantía",
    rol: "Recibe el caso, obtiene el formulario firmado y ejecuta la devolución al origen.",
  },
  {
    actor: "Bancard",
    rol: "Identifica el pago y procesa la devolución conforme al procedimiento habilitado.",
  },
];

// ---------------------------------------------------------------------------
// `EVIDENCIA CONSERVADA`
// ---------------------------------------------------------------------------

export const TITULO_EVIDENCIA_CONSERVADA = "EVIDENCIA CONSERVADA";

export const EVIDENCIA_CONSERVADA_PANTALLA_B: readonly string[] = [
  "Pago y referencia Bancard",
  "Fecha y hora",
  "Avisos a WhatsApp y correo",
  "Alertas de seguimiento",
  "Vencimiento",
  "Formulario de devolución",
  "Aprobación",
  "Devolución y cuenta de origen",
];

// ---------------------------------------------------------------------------
// Pie
// ---------------------------------------------------------------------------

export const ROTULO_ESTADO_FINAL_B = "Estado final del expediente";

/**
 * Cómo se lee cada estado del expediente en el pie de la pantalla. La
 * especificación lo escribe como `VENCIDO · DEVOLUCIÓN EN TRÁMITE / DEVUELTO`:
 * los tres momentos de la misma rama, de los cuales la pantalla muestra el que
 * corresponde.
 */
export const ROTULO_ESTADO_PANTALLA_B: Readonly<Record<string, string>> = {
  VENCIDO: "VENCIDO",
  DEVOLUCION_EN_TRAMITE: "VENCIDO · DEVOLUCIÓN EN TRÁMITE",
  DEVUELTO: "VENCIDO · DEVUELTO",
};

export const ROTULO_BOTON_FINALIZAR_B = "FINALIZAR / Volver al inicio";
