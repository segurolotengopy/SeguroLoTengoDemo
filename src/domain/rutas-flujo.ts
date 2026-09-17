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
 *
 * ## Una sola versión del flujo
 *
 * Hasta el 16-sep-2026 este módulo elegía a import-time entre tres listas —la
 * de 8 pasos (v2), la de 3 páginas largas (v3) y la de doce pantallas (v4)—
 * según los flags `FLUJO_V3` y `FLUJO_V4`. Con D-43 (*«esta es la v4, el
 * resto no va»*) v4 pasó a ser **el** flujo y las otras dos se borraron del
 * árbol; lo único que queda de ellas son sus rutas, en
 * `REDIRECCIONES_RUTAS_VIEJAS`, para que ningún enlace ya enviado se rompa.
 */
import type { EstadoExpediente } from "./tipos";

/**
 * A dónde vuelve quien cierra el trámite (botón *Finalizar*).
 *
 * La raíz es la portada con el catálogo (arte `01`), que es la pantalla desde
 * la que se empieza un trámite nuevo. Mandar a `/plan` reenviaba a quien
 * acababa de terminar a un paso intermedio sin expediente detrás.
 */
export const RUTA_CIERRE_DE_TRAMITE = "/";

export const RUTA_ASISTENCIA_IDENTIDAD = "/asistencia-identidad";
export const RUTA_REVISION_MANUAL = "/revision-manual";
export const RUTA_SOLICITUD_VENCIDA = "/solicitud-vencida";

/**
 * Los pasos del flujo, **en orden**, y todo lo que cuelga de ese orden.
 *
 * ## Por qué una lista
 *
 * Antes el número de paso estaba escrito en cuatro lugares a la vez: el slug
 * de la carpeta (`p2-plan`), el `pasoActual` que cada pantalla le pasaba al
 * stepper, esta tabla de estado → pantalla, y el título de cada `metadata`.
 * Reordenar el wizard significaba encontrar y corregir los cuatro sin
 * contradecirse. Con la lista, el orden vive en un solo lugar: mover un
 * elemento del arreglo reordena el wizard y reapunta las redirecciones.
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
   * Identificador versionado de la pantalla (D-14): `Pv4-1`, `Pv4-2`, …
   *
   * Lleva la versión del rediseño adentro a propósito. Los documentos, las
   * evidencias y los tests hablan de pantallas concretas, y "la pantalla 3"
   * significa cosas distintas antes y después de cada rediseño; `Pv4-3` no.
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
  /**
   * Etapa del stepper de 5 macroetapas del handoff v4 (D-36): 1 · Plan,
   * 2 · Verificación, 3 · Actividad e ingresos, 4 · Declaraciones y firma,
   * 5 · Pago y confirmación (`docs/recepcion/2026-09-14-interseguros/02-pantallas-v4/ANALISIS.md`
   * §4).
   *
   * Se repite acá solo para que la interfaz sea exhaustiva: el stepper v4 la
   * lee de `v4/etapas.ts`, por código de pantalla. Las dos tablas tienen que
   * coincidir.
   */
  readonly etapa: 1 | 2 | 3 | 4 | 5;
}

/** Total de macroetapas del stepper v4 (D-36). No se deriva de `PASOS_FLUJO`
 * porque varias pantallas comparten etapa (ver `PasoDelFlujo.etapa`): el largo
 * del stepper es 5, no `PASOS_FLUJO.length`. */
export const TOTAL_ETAPAS = 5;

/**
 * El flujo v4 (D-43), en **once pantallas del contador y cinco etapas**.
 *
 * Esta lista existe para la maquinaria de enrutado —a dónde mandar a quien
 * vuelve, cuál es la pantalla siguiente—; **el stepper no se deriva de acá**,
 * porque v4 cuenta etapas y no pantallas. Eso vive en `v4/etapas.ts`, que es
 * la fuente de la numeración `N de 5`. La portada (`/`, arte `01`) queda
 * fuera del contador: no tiene stepper y no produce ningún estado.
 *
 * El `estadoAlCompletar` de varias pantallas se repite: 03D, 03E y 04A llenan
 * el expediente sin moverlo de `IDENTIDAD_VERIFICADA`, y recién 04D lo lleva a
 * `DECLARACIONES_OK`. Es correcto y es lo que v4 hace: son pantallas de un
 * mismo tramo.
 */
export const PASOS_FLUJO: readonly PasoDelFlujo[] = [
  { id: "Pv4-1", slug: "/plan", titulo: "Elegí tu plan", estadoAlCompletar: "PLAN_SELECCIONADO", etapa: 1 },
  { id: "Pv4-2", slug: "/whatsapp", titulo: "Verificá tu WhatsApp", estadoAlCompletar: "CANAL_WA_VERIFICADO", etapa: 2 },
  { id: "Pv4-3", slug: "/preparacion", titulo: "Prepará lo necesario", estadoAlCompletar: "AUTORIZADO", etapa: 2 },
  { id: "Pv4-4", slug: "/identidad", titulo: "Verificá tu identidad", estadoAlCompletar: "IDENTIDAD_VERIFICADA", etapa: 2 },
  { id: "Pv4-5", slug: "/datos", titulo: "Completá tus datos", estadoAlCompletar: "IDENTIDAD_VERIFICADA", etapa: 2 },
  { id: "Pv4-6", slug: "/actividad", titulo: "Actividad e ingresos", estadoAlCompletar: "IDENTIDAD_VERIFICADA", etapa: 3 },
  { id: "Pv4-7", slug: "/declaraciones", titulo: "Datos y declaraciones", estadoAlCompletar: "IDENTIDAD_VERIFICADA", etapa: 4 },
  { id: "Pv4-8", slug: "/consentimientos", titulo: "Consentimientos", estadoAlCompletar: "DECLARACIONES_OK", etapa: 4 },
  // D-08 enmendada · el paso se completa con FIRMADO_CLIENTE: la firma
  // cualificada de Interseguros llega después del pago (D-38).
  { id: "Pv4-9", slug: "/firma", titulo: "Revisá, aceptá y firmá", estadoAlCompletar: "FIRMADO_CLIENTE", etapa: 4 },
  { id: "Pv4-10", slug: "/pago", titulo: "Realizá el pago", estadoAlCompletar: "PAGO_CONFIRMADO", etapa: 5 },
  { id: "Pv4-11", slug: "/confirmacion", titulo: "Contratación confirmada", estadoAlCompletar: "EMITIDO", etapa: 5 },
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
 * Macroetapa (1 a 5) de una pantalla del flujo, por su slug, o `null` si no
 * es un paso del flujo. Es lo que dibujaba `StepperPasos` (D-36), y lo que hoy cruza el test de `PASOS_FLUJO` contra `PANTALLAS_V4`: la maqueta
 * v4 muestra "N de 5", no "Paso N de {TOTAL_PASOS}".
 */
export function etapaDePaso(slug: string): number | null {
  const paso = PASOS_FLUJO.find((p) => p.slug === slug);
  return paso ? paso.etapa : null;
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

/**
 * El paso anterior a una pantalla, por su slug — ruta y título.
 *
 * El simétrico de `rutaSiguienteDe`, y existe por el mismo motivo, esta vez
 * comprobado en la pantalla de firma: su enlace de volver decía "Volver a
 * facturación y garantía de pago" y apuntaba a `/pago`, que era correcto
 * cuando se pagaba antes de firmar. Con D-08 el pago pasó a ser el paso
 * **siguiente**, así que ese enlace mandaba a la persona hacia adelante, a un
 * paso que todavía no puede completar. Escrito a mano vuelve a pasar; derivado
 * de `PASOS_FLUJO`, no.
 */
export function pasoAnteriorDe(slug: string): PasoDelFlujo | null {
  const indice = PASOS_FLUJO.findIndex((paso) => paso.slug === slug);
  if (indice <= 0) return null;
  return PASOS_FLUJO[indice - 1] ?? null;
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
 *
 * Son **dos generaciones** de rutas: las numeradas del wizard original
 * (`/p1-…`) y las tres páginas largas del flujo v3 (`/inscripcion`, `/seguro`,
 * `/pago-y-firma`), que también viven en enlaces ya enviados. Cada una va a
 * la pantalla v4 que absorbió su contenido; cuando una página larga cubría
 * varios pasos, va al primero de ellos, y desde ahí el reencaminado por
 * estado lleva a la persona a donde quedó.
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
  // v3 · la inscripción era identidad + WhatsApp + autorización; en v4 el
  // trámite empieza por el plan.
  "/inscripcion": "/plan",
  "/seguro": "/plan",
  "/pago-y-firma": "/firma",
};

/**
 * Pantalla donde la persona puede **continuar** con ese estado.
 *
 * Quien tiene la identidad verificada va a **`/datos`**, que es donde v4 pide
 * los datos personales. Las cuatro pantallas de ese tramo comparten estado y
 * cada una reenvía a la siguiente cuando lo suyo ya está completo.
 *
 * Para los estados terminales no es "donde continuar" sino "donde entender qué
 * pasó y qué sigue", que es lo mismo desde el punto de vista de no dejar a
 * nadie sin salida.
 */
export const PANTALLA_POR_ESTADO: Readonly<Record<EstadoExpediente, string>> = {
  INICIADO: "/plan",
  PLAN_SELECCIONADO: "/whatsapp",
  CANAL_WA_VERIFICADO: "/preparacion",
  AUTORIZADO: "/identidad",
  // Legado (D-06): ya nadie entra a este estado, pero los expedientes que
  // quedaron ahí siguen teniendo a dónde ir.
  CANAL_EMAIL_VERIFICADO: "/identidad",
  IDENTIDAD_VERIFICADA: "/datos",
  DECLARACIONES_OK: "/firma",
  // El paquete documental se cierra al entrar a la pantalla de firma: el
  // estado intermedio comparte pantalla con el paso que lo produce.
  PAQUETE_GENERADO: "/firma",
  // D-08 enmendada · con la firma del cliente el paso siguiente es el pago;
  // FIRMADO es, desde el 04-sep-2026, un momento posterior al cobro (la
  // institucional diferida ya aplicada), igual que PAGO_CONFIRMADO.
  FIRMADO_CLIENTE: "/pago",
  FIRMADO: "/confirmacion",
  PAGO_CONFIRMADO: "/confirmacion",
  EMITIDO: "/confirmacion",

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
 * `true` si un expediente en ese estado **pertenece** a esa pantalla.
 *
 * ## Por qué existe
 *
 * Nace del mismo callejón que `PANTALLA_POR_ESTADO`, pero del otro lado. Quien
 * vuelve atrás —a `/identidad`, pongamos, con la identidad ya verificada—
 * encontraba la pantalla dibujada entera, con sus botones de captura, y el
 * rechazo aparecía recién al mandar la fotografía:
 *
 *     "Este proceso ya no está en el paso de verificación de identidad."
 *
 * Cierto, inútil y caro: la persona ya sacó las fotos. El arreglo es preguntar
 * **antes de dibujar**.
 *
 * ## Por qué se pregunta por la pantalla y no por la transición
 *
 * El primer intento fue derivarlo del grafo: "¿es legal la transición al estado
 * que este paso produce?". Se ve razonable y es incorrecto en `/firma`, porque
 * a `FIRMADO` solo se llega desde `FIRMADO_CLIENTE` — así que un expediente en
 * `DECLARACIONES_OK`, que es justamente el que entra a firmar, quedaba
 * expulsado de su propia pantalla. Un paso no es una transición: es el tramo
 * que va desde que la persona llega hasta que sale, y por el medio pasa por
 * estados intermedios que son suyos (`PAQUETE_GENERADO`, `FIRMADO_CLIENTE`).
 *
 * `PANTALLA_POR_ESTADO` ya contesta exactamente eso, es exhaustiva por tipo, y
 * es la misma tabla de la que sale el botón de vuelta. Preguntarle a ella
 * mantiene una sola fuente: si mañana un estado cambia de pantalla, cambia en
 * un lugar y las dos direcciones se enteran.
 *
 * `/plan` **no** usa esto y conserva `puedeElegirPlan`: ahí `PLAN_SELECCIONADO`
 * apunta a `/whatsapp` —porque es donde hay que seguir— pero volver a elegir
 * plan sigue siendo legal, que es el enlace `Cambiar plan`. Las dos preguntas
 * coinciden en las demás pantallas y difieren en esa; conviene no forzarlas.
 */
export function perteneceAEstePaso(slug: string, estado: EstadoExpediente): boolean {
  return PANTALLA_POR_ESTADO[estado] === slug;
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
