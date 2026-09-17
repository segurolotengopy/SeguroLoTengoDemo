/**
 * Las pantallas del flujo v4 y las cinco etapas que ve la persona.
 *
 * ## Por qué pantallas y etapas son dos listas
 *
 * En v2 el stepper contaba pantallas: ocho pantallas, «Paso N de 8». En v4 hay
 * **doce pantallas de flujo y cinco etapas**, y el arte dibuja siempre cinco
 * puntos con «N de 5». Son dos cosas distintas y por eso son dos listas: la
 * persona ve etapas, el enrutador mueve pantallas.
 *
 * La regla que fija la numeración la dejó el análisis del handoff
 * (`ANALISIS.md` §4, D-36): **manda el arte**, porque es lo que la persona ve,
 * y `main_stage` de `screens.json` no coincide con él. Y una pantalla
 * **terminal muestra la etapa en la que el flujo se detuvo**, no la siguiente:
 * por eso 03E2 dice `3 de 5` aunque el arte dibuje `4 de 5`.
 *
 * ## Por qué no hay estados nuevos
 *
 * Porque v4 no cambia la máquina de estados: cambia en cuántas pantallas se
 * reparte el mismo camino. `IDENTIDAD_VERIFICADA → DECLARACIONES_OK` sigue
 * siendo una sola transición; lo que pasa en el medio —datos personales,
 * actividad e ingresos, declaraciones, consentimientos— son cuatro pantallas
 * que llenan el expediente sin moverlo de estado. Agregar estados para cada
 * una habría obligado a tocar todos los `Record<EstadoExpediente, …>`
 * exhaustivos del dominio para no ganar nada: ninguno de esos momentos tiene
 * consecuencia legal propia.
 *
 * Por eso un estado puede pertenecer a **varias** pantallas, y de ahí sale
 * `pantallasDelEstadoV4`.
 */
import type { EstadoExpediente } from "../tipos";

/** Código de pantalla del handoff. Es la mitad de la terna de trazabilidad. */
export type CodigoPantallaV4 =
  | "01"
  | "02"
  | "03A"
  | "03B"
  | "03C"
  | "03D"
  | "03E"
  | "03E2"
  | "04A"
  | "04A1"
  | "04D"
  | "04E"
  | "05A"
  | "05B";

export type NumeroEtapaV4 = 1 | 2 | 3 | 4 | 5;

export interface EtapaV4 {
  readonly numero: NumeroEtapaV4;
  /** Nombre corto de la etapa. No se imprime en el stepper —el arte solo
   *  muestra «N de 5»— pero sí en la consola y en los títulos de página. */
  readonly titulo: string;
}

export const ETAPAS_V4: readonly EtapaV4[] = [
  { numero: 1, titulo: "Plan" },
  { numero: 2, titulo: "Verificación" },
  { numero: 3, titulo: "Actividad e ingresos" },
  { numero: 4, titulo: "Declaraciones y firma" },
  { numero: 5, titulo: "Pago y confirmación" },
];

export const TOTAL_ETAPAS_V4 = ETAPAS_V4.length;

export interface PantallaV4 {
  readonly codigo: CodigoPantallaV4;
  /** Ruta de la pantalla. Los detalles y modales no tienen ruta propia. */
  readonly ruta: string;
  readonly titulo: string;
  /** `null` en las pantallas que van sin stepper (la portada). */
  readonly etapa: NumeroEtapaV4 | null;
  /** Estados del expediente que pueden estar mirando esta pantalla. */
  readonly estados: readonly EstadoExpediente[];
  /** `true` si el flujo digital no continúa desde acá. */
  readonly terminal?: boolean;
}

/**
 * Las pantallas, **en orden de recorrido**.
 *
 * Los «detalle» del handoff —01A a 01E, 02A a 02C, 03E1— no están acá porque
 * no son pantallas: son modales que viven dentro de la suya y no tienen ruta,
 * estado ni etapa propios.
 */
export const PANTALLAS_V4: readonly PantallaV4[] = [
  {
    codigo: "01",
    ruta: "/",
    titulo: "Portada y catálogo de productos",
    etapa: null,
    estados: ["INICIADO"],
  },
  {
    codigo: "02",
    ruta: "/plan",
    titulo: "Elegí tu plan",
    etapa: 1,
    estados: ["INICIADO"],
  },
  {
    codigo: "03A",
    ruta: "/whatsapp",
    titulo: "Verificá tu número de WhatsApp",
    etapa: 2,
    estados: ["PLAN_SELECCIONADO"],
  },
  {
    codigo: "03B",
    ruta: "/preparacion",
    titulo: "Prepará lo necesario",
    etapa: 2,
    estados: ["CANAL_WA_VERIFICADO"],
  },
  {
    codigo: "03C",
    ruta: "/identidad",
    titulo: "Verificá tu identidad",
    etapa: 2,
    // `CANAL_EMAIL_VERIFICADO` es legado (D-06): los expedientes históricos
    // detenidos ahí retoman por la pantalla que hoy contiene el correo.
    estados: ["AUTORIZADO", "CANAL_EMAIL_VERIFICADO"],
  },
  {
    codigo: "03D",
    ruta: "/datos",
    titulo: "Completá tus datos",
    etapa: 2,
    estados: ["IDENTIDAD_VERIFICADA"],
  },
  {
    codigo: "03E",
    ruta: "/actividad",
    titulo: "Actividad e ingresos",
    etapa: 3,
    estados: ["IDENTIDAD_VERIFICADA"],
  },
  {
    codigo: "04A",
    ruta: "/declaraciones",
    titulo: "Datos y declaraciones",
    etapa: 4,
    estados: ["IDENTIDAD_VERIFICADA"],
  },
  {
    codigo: "04D",
    ruta: "/consentimientos",
    titulo: "Consentimientos",
    etapa: 4,
    estados: ["IDENTIDAD_VERIFICADA"],
  },
  {
    codigo: "04E",
    ruta: "/firma",
    titulo: "Revisá, aceptá y firmá",
    etapa: 4,
    estados: ["DECLARACIONES_OK", "PAQUETE_GENERADO", "FIRMADO_CLIENTE"],
  },
  {
    codigo: "05A",
    ruta: "/pago",
    titulo: "Realizá el pago",
    etapa: 5,
    estados: ["FIRMADO"],
  },
  {
    codigo: "05B",
    ruta: "/confirmacion",
    titulo: "Contratación confirmada",
    etapa: 5,
    estados: ["PAGO_CONFIRMADO", "EMITIDO"],
  },
];

/**
 * Las terminales, que no están en el recorrido.
 *
 * `03E2` y `04A1` comparten ruta —`/revision-manual`— y se distinguen por el
 * motivo, que es lo único que cambia entre sus artes: el título de la tarjeta,
 * el primer párrafo y la segunda fila del estado de la solicitud. Sus etapas
 * **sí** son distintas: la revisión PEP se dispara al terminar 03E (etapa 3) y
 * la evaluación médica dentro de 04A (etapa 4).
 */
export const PANTALLAS_TERMINALES_V4: readonly PantallaV4[] = [
  {
    codigo: "03E2",
    ruta: "/revision-manual",
    titulo: "Tu solicitud requiere revisión",
    etapa: 3,
    estados: ["DERIVADO_MANUAL"],
    terminal: true,
  },
  {
    codigo: "04A1",
    ruta: "/revision-manual",
    titulo: "Tu solicitud requiere revisión",
    etapa: 4,
    estados: ["DERIVADO_MANUAL"],
    terminal: true,
  },
];

/** Motivo por el que un expediente llegó a `/revision-manual`. */
export type MotivoRevisionManualV4 = "PEP" | "SALUD";

/** Qué arte corresponde a cada motivo, con su etapa. */
export function pantallaDeRevisionManual(motivo: MotivoRevisionManualV4): PantallaV4 {
  const codigo: CodigoPantallaV4 = motivo === "PEP" ? "03E2" : "04A1";
  const pantalla = PANTALLAS_TERMINALES_V4.find((p) => p.codigo === codigo);
  if (!pantalla) throw new Error(`Falta la pantalla terminal ${codigo}`);
  return pantalla;
}

/** La pantalla de una ruta, o `null` si esa ruta no es del flujo v4. */
export function pantallaPorRutaV4(ruta: string): PantallaV4 | null {
  return PANTALLAS_V4.find((pantalla) => pantalla.ruta === ruta) ?? null;
}

/** La pantalla de un código, o `null`. */
export function pantallaPorCodigoV4(codigo: CodigoPantallaV4): PantallaV4 | null {
  return (
    PANTALLAS_V4.find((pantalla) => pantalla.codigo === codigo) ??
    PANTALLAS_TERMINALES_V4.find((pantalla) => pantalla.codigo === codigo) ??
    null
  );
}

/** Las pantallas a las que puede pertenecer un estado, en orden de recorrido. */
export function pantallasDelEstadoV4(estado: EstadoExpediente): readonly PantallaV4[] {
  return PANTALLAS_V4.filter((pantalla) => pantalla.estados.includes(estado));
}

/**
 * `true` si un expediente en ese estado **puede** estar en esa pantalla.
 *
 * Es la versión v4 de `perteneceAEstePaso`, y difiere en una cosa: acá un
 * estado pertenece a varias pantallas. Quien está en `IDENTIDAD_VERIFICADA`
 * puede legítimamente estar completando datos, actividad, declaraciones o
 * consentimientos, y expulsarlo de tres de las cuatro sería el mismo callejón
 * sin salida que `rutas-flujo.ts` documenta en su encabezado.
 */
export function perteneceAEstaPantallaV4(ruta: string, estado: EstadoExpediente): boolean {
  const pantalla = pantallaPorRutaV4(ruta);
  return pantalla ? pantalla.estados.includes(estado) : false;
}

/** La primera pantalla de un estado: a dónde mandar a quien vuelve. */
export function pantallaDeEntradaV4(estado: EstadoExpediente): PantallaV4 | null {
  return pantallasDelEstadoV4(estado)[0] ?? null;
}

/** La ruta siguiente en el recorrido, por ruta actual. */
export function rutaSiguienteV4(ruta: string): string | null {
  const indice = PANTALLAS_V4.findIndex((pantalla) => pantalla.ruta === ruta);
  if (indice === -1) return null;
  return PANTALLAS_V4[indice + 1]?.ruta ?? null;
}

/** La pantalla anterior en el recorrido, por ruta actual. */
export function pantallaAnteriorV4(ruta: string): PantallaV4 | null {
  const indice = PANTALLAS_V4.findIndex((pantalla) => pantalla.ruta === ruta);
  if (indice <= 0) return null;
  return PANTALLAS_V4[indice - 1] ?? null;
}
