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
/**
 * Los pasos del flujo, **en orden**, y todo lo que cuelga de ese orden.
 *
 * ## Por qué una lista
 *
 * Antes el número de paso estaba escrito en cuatro lugares a la vez: el slug
 * de la carpeta (`p2-plan`), el `pasoActual` que cada pantalla le pasaba al
 * stepper, esta tabla de estado → pantalla, y el título de cada `metadata`.
 * Reordenar el wizard significaba encontrar y corregir los cuatro sin
 * contradecirse, y por eso el intercambio que pidió la reunión —el plan
 * primero, el WhatsApp después— era caro para lo poco que cambia.
 *
 * Con la lista, el orden vive en un solo lugar: mover un elemento del arreglo
 * reordena el wizard, renumera el stepper y reapunta las redirecciones. La
 * inversión de firma y pago que viene después (D-08) es exactamente eso, mover
 * un elemento.
 *
 * ## Por qué los slugs no llevan número
 *
 * Porque el número es una propiedad de la *posición*, no de la pantalla, y
 * meterlo en la URL congela la posición: `/p7-pago` obligaba a renombrar la
 * carpeta —y romper todo enlace ya enviado— cada vez que el orden cambiaba. El
 * slug dice qué es la pantalla; el orden lo dice esta lista.
 */
export interface PasoDelFlujo {
  /**
   * Identificador versionado de la pantalla (D-14): `Pv2-1`, `Pv2-2`, …
   *
   * Lleva la versión del rediseño adentro a propósito. Los documentos, las
   * evidencias y los tests hablan de pantallas concretas, y "la pantalla 3"
   * significa cosas distintas antes y después de este plan; `Pv2-3` no.
   */
  readonly id: string;
  /** Ruta, sin número: `/plan`, `/whatsapp`, … */
  readonly slug: string;
  /** Nombre corto, para títulos y para el indicador de paso. */
  readonly titulo: string;
  /**
   * Estado al que llega el expediente cuando la persona **completa** el paso.
   * De acá se deriva a qué pantalla mandar a alguien según dónde quedó.
   */
  readonly estadoAlCompletar: EstadoExpediente;
}

export const PASOS_FLUJO: readonly PasoDelFlujo[] = [
  {
    id: "Pv2-1",
    slug: "/plan",
    titulo: "Elegí tu plan",
    estadoAlCompletar: "PLAN_SELECCIONADO",
  },
  {
    id: "Pv2-2",
    slug: "/whatsapp",
    titulo: "Verificá tu WhatsApp",
    estadoAlCompletar: "CANAL_WA_VERIFICADO",
  },
  {
    id: "Pv2-3",
    slug: "/preparacion",
    titulo: "Prepará lo necesario",
    estadoAlCompletar: "AUTORIZADO",
  },
  {
    id: "Pv2-4",
    slug: "/identidad",
    titulo: "Datos e identificación",
    estadoAlCompletar: "IDENTIDAD_VERIFICADA",
  },
  {
    id: "Pv2-5",
    slug: "/declaraciones",
    titulo: "Datos y declaraciones",
    estadoAlCompletar: "DECLARACIONES_OK",
  },
  // D-08 · se firma antes de pagar (Matriz Legal V4 §7). Invertir el orden fue
  // mover estos dos elementos de lugar, que era exactamente lo que la lista
  // prometía: el número de paso, el stepper y las redirecciones se derivan de
  // acá y no hubo que tocarlos.
  {
    id: "Pv2-6",
    slug: "/firma",
    titulo: "Revisá, aceptá y firmá",
    estadoAlCompletar: "FIRMADO",
  },
  {
    id: "Pv2-7",
    slug: "/pago",
    titulo: "Realizá el pago",
    estadoAlCompletar: "PAGO_CONFIRMADO",
  },
  {
    id: "Pv2-8",
    slug: "/confirmacion",
    titulo: "Contratación confirmada",
    estadoAlCompletar: "EMITIDO",
  },
];

export const TOTAL_PASOS = PASOS_FLUJO.length;

/**
 * Número de paso (1-based) de una ruta, o `null` si no es un paso del flujo.
 *
 * Las pantallas lo piden con su propio slug en vez de escribir su número: así
 * ninguna pantalla puede quedar afirmando que es el paso 7 cuando la lista
 * dice otra cosa.
 */
export function numeroDePaso(slug: string): number | null {
  const indice = PASOS_FLUJO.findIndex((paso) => paso.slug === slug);
  return indice === -1 ? null : indice + 1;
}

/**
 * Ruta del paso que sigue a una pantalla, por su slug.
 *
 * Existe porque las pantallas tenían su destino escrito a mano y el
 * reordenamiento los dejó apuntando al lugar equivocado: el catálogo seguía
 * mandando a la preparación, que ahora va dos pasos más adelante. Con esto, el
 * "siguiente" de cada pantalla sale del mismo arreglo que define el orden.
 */
export function rutaSiguienteDe(slug: string): string | null {
  const indice = PASOS_FLUJO.findIndex((paso) => paso.slug === slug);
  if (indice === -1) return null;
  return PASOS_FLUJO[indice + 1]?.slug ?? null;
}

/** Ruta del paso siguiente al que deja este estado, o `null` si no hay. */
export function rutaDelPasoSiguiente(estado: EstadoExpediente): string | null {
  const indice = PASOS_FLUJO.findIndex((paso) => paso.estadoAlCompletar === estado);
  if (indice === -1) return null;
  return PASOS_FLUJO[indice + 1]?.slug ?? null;
}

/**
 * Rutas viejas y su destino, para las redirecciones permanentes.
 *
 * No se responde 404: hay enlaces con el formato viejo en mensajes de WhatsApp
 * y correos ya enviados durante las pruebas, y un enlace roto en un canal de
 * contratación termina en una llamada de alguien que cree que perdió su
 * trámite.
 */
export const REDIRECCIONES_RUTAS_VIEJAS: Readonly<Record<string, string>> = {
  "/p1-whatsapp": "/whatsapp",
  "/p2-plan": "/plan",
  "/p3-preparacion": "/preparacion",
  // El paso de correo dejó de existir (D-06): su contenido vive ahora dentro
  // de la pantalla de identidad, que es a dónde corresponde llevar a quien
  // llegue con el enlace viejo.
  "/p4-correo": "/identidad",
  "/p5-identidad": "/identidad",
  "/p6-declaraciones": "/declaraciones",
  "/p7-pago": "/pago",
  "/p8-firma": "/firma",
  "/p9-confirmacion": "/confirmacion",
};

/**
 * Pantalla donde la persona puede **continuar** con ese estado.
 *
 * Se deriva de `PASOS_FLUJO` para los estados del camino feliz: el expediente
 * que ya completó un paso tiene que ir al siguiente. Los terminales y los
 * legados se declaran aparte, porque no son "el paso siguiente" de nada.
 *
 * Para los estados terminales no es "donde continuar" sino "donde entender qué
 * pasó y qué sigue", que es lo mismo desde el punto de vista de no dejar a
 * nadie sin salida.
 */
export const PANTALLA_POR_ESTADO: Readonly<Record<EstadoExpediente, string>> = {
  // Camino feliz, derivado del orden de la lista.
  INICIADO: PASOS_FLUJO[0].slug,
  PLAN_SELECCIONADO: rutaDelPasoSiguiente("PLAN_SELECCIONADO") ?? PASOS_FLUJO[0].slug,
  CANAL_WA_VERIFICADO: rutaDelPasoSiguiente("CANAL_WA_VERIFICADO") ?? PASOS_FLUJO[0].slug,
  AUTORIZADO: rutaDelPasoSiguiente("AUTORIZADO") ?? PASOS_FLUJO[0].slug,
  IDENTIDAD_VERIFICADA: rutaDelPasoSiguiente("IDENTIDAD_VERIFICADA") ?? PASOS_FLUJO[0].slug,
  DECLARACIONES_OK: rutaDelPasoSiguiente("DECLARACIONES_OK") ?? PASOS_FLUJO[0].slug,
  PAGO_CONFIRMADO: rutaDelPasoSiguiente("PAGO_CONFIRMADO") ?? PASOS_FLUJO[0].slug,
  FIRMADO: rutaDelPasoSiguiente("FIRMADO") ?? PASOS_FLUJO[0].slug,

  // El paquete documental se cierra al entrar a la pantalla de firma, y la
  // firma del cliente deja el expediente esperando las institucionales: los
  // dos estados intermedios comparten pantalla con el paso que los produce.
  PAQUETE_GENERADO: "/firma",
  FIRMADO_CLIENTE: "/firma",
  // Última pantalla: no hay "siguiente" que derivar.
  EMITIDO: "/confirmacion",

  // Legado (D-06): ya nadie entra a este estado, pero los expedientes que
  // quedaron ahí siguen teniendo a dónde ir.
  CANAL_EMAIL_VERIFICADO: "/identidad",

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
