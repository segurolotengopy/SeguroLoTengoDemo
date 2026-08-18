/**
 * A qué pantalla corresponde cada estado del expediente.
 *
 * ## Por qué existe
 *
 * Nace de una persona trabada en su celular con este mensaje:
 *
 *     "Este proceso ya no está en el paso de verificación de WhatsApp."
 *
 * Cierto e inútil. El servidor **sabía** exactamente dónde estaba ese
 * expediente y a qué pantalla correspondía, y en vez de llevarla le describió
 * el problema y la dejó ahí. En un producto B2C de mínima fricción, quien se
 * traba no tiene a quién preguntarle: abandona.
 *
 * La regla que sale de eso, y que vale para todo el flujo: **un mensaje de
 * error tiene que decir qué hacer, no qué pasó**, y ofrecer el camino cuando
 * el sistema lo conoce. Acá está el camino.
 *
 * ## Por qué en el dominio
 *
 * Porque la correspondencia estado → pantalla es la máquina de estados vista
 * desde la interfaz, no una decisión de presentación. Si mañana se agrega un
 * estado, `EstadoExpediente` obliga a decidir su pantalla — el `Record` es
 * exhaustivo y TypeScript no deja olvidarse de ninguno.
 */
import type { EstadoExpediente } from "./tipos";

export const RUTA_ASISTENCIA_IDENTIDAD = "/asistencia-identidad";
export const RUTA_REVISION_MANUAL = "/revision-manual";
export const RUTA_SOLICITUD_VENCIDA = "/solicitud-vencida";

/**
 * Pantalla donde la persona puede **continuar** con ese estado.
 *
 * Para los estados terminales no es "donde continuar" sino "donde entender qué
 * pasó y qué sigue", que es lo mismo desde el punto de vista de no dejar a
 * nadie sin salida.
 */
export const PANTALLA_POR_ESTADO: Readonly<Record<EstadoExpediente, string>> = {
  INICIADO: "/p1-whatsapp",
  CANAL_WA_VERIFICADO: "/p2-plan",
  PLAN_SELECCIONADO: "/p3-preparacion",
  AUTORIZADO: "/p4-correo",
  CANAL_EMAIL_VERIFICADO: "/p5-identidad",
  IDENTIDAD_VERIFICADA: "/p6-declaraciones",
  DECLARACIONES_OK: "/p7-pago",
  // El paquete se cierra al entrar a P8, así que los dos estados del pago
  // confirmado apuntan a la misma pantalla.
  PAGO_CONFIRMADO: "/p8-firma",
  PAQUETE_GENERADO: "/p8-firma",
  FIRMADO: "/p9-confirmacion",
  EMITIDO: "/p9-confirmacion",

  // Terminales: no se continúa, pero tampoco se deja a nadie en el aire.
  ASISTENCIA_IDENTIDAD: RUTA_ASISTENCIA_IDENTIDAD,
  DERIVADO_MANUAL: RUTA_REVISION_MANUAL,
  VENCIDO: RUTA_SOLICITUD_VENCIDA,
  DEVOLUCION_EN_TRAMITE: RUTA_SOLICITUD_VENCIDA,
  DEVUELTO: RUTA_SOLICITUD_VENCIDA,
};

/**
 * Estados desde los que **no se puede volver al flujo digital**.
 *
 * La pantalla los trata distinto: no ofrece "continuá desde donde quedaste"
 * —sería mentir— sino "mirá qué pasó con tu trámite".
 */
const TERMINALES: ReadonlySet<EstadoExpediente> = new Set<EstadoExpediente>([
  "ASISTENCIA_IDENTIDAD",
  "DERIVADO_MANUAL",
  "VENCIDO",
  "DEVOLUCION_EN_TRAMITE",
  "DEVUELTO",
]);

export interface DestinoDelExpediente {
  readonly ruta: string;
  /** Texto del botón. Dice la acción, no el estado. */
  readonly rotulo: string;
  /** `true` si el flujo digital se cerró para ese expediente. */
  readonly terminal: boolean;
}

/**
 * A dónde mandar a alguien que llegó a la pantalla equivocada.
 *
 * Devuelve también el texto del botón porque el rótulo depende de si se puede
 * continuar o no, y esa decisión es la misma que la de la ruta: separarlas
 * invitaría a que una pantalla ofreciera "continuar" hacia un estado terminal.
 */
export function destinoDelExpediente(estado: EstadoExpediente): DestinoDelExpediente {
  const terminal = TERMINALES.has(estado);
  return {
    ruta: PANTALLA_POR_ESTADO[estado],
    rotulo: terminal ? "Ver el estado de tu trámite" : "Continuá desde donde quedaste",
    terminal,
  };
}
