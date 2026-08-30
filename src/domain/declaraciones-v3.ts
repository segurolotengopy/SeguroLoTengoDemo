/**
 * El mapa 5→8 del paso 2 del flujo v3 (DI-3, Bloque E de
 * docs/plan/DECISIONES.md; tabla en docs/ESPECIFICACION_PANTALLAS.md →
 * "El mapa 5→8").
 *
 * La pantalla pregunta **cinco** cosas; la Solicitud y el FIPF siguen
 * imprimiendo las **ocho** declaraciones de siempre. Este módulo es la única
 * pieza que traduce: expande las cinco respuestas —más lo que la persona
 * aceptó en la casilla agrupada 2— en las ocho claves que
 * `interpretarDeclaracionesP6` y el motor de elegibilidad exigen. Ni el
 * motor, ni el PDF, ni la pantalla v2 se enteran del cambio.
 *
 * | Clave v2 (#) | Fuente v3 |
 * | :----------- | :-------- |
 * | 1 estadoDeSalud | pregunta `salud` |
 * | 2 antecedentesDeContratacion | pregunta `antecedentes` |
 * | 3 enfermedadesDiagnosticadas | pregunta `enfermedades` |
 * | 4 vigenciaYCarencias | pregunta `carencias` |
 * | 5 veracidad | ítem 2 de la aceptación agrupada 2 |
 * | 6 entregaDigital | ítem 3 de la aceptación agrupada 2 |
 * | 7 corredorDeLaPoliza | ítem 4 de la aceptación agrupada 2 |
 * | 8 condicionPep | pregunta `pep` |
 *
 * Las claves 5/6/7 salen como `"SI"` porque **este mapa solo se llama con la
 * casilla agrupada marcada** — el caso de uso lo garantiza antes
 * (`ACEPTACION_REQUERIDA`). La pregunta de carencias en `"NO"` tampoco llega
 * acá: **bloquea sin derivar** (la clave 4 no bloquea en el motor, así que
 * dejarla pasar convertiría un alto de UI en un expediente derivado) y el
 * caso de uso la corta con `CARENCIAS_NO_ACEPTADAS`.
 */

export const CLAVES_RESPUESTAS_V3 = [
  "salud",
  "antecedentes",
  "enfermedades",
  "pep",
  "carencias",
] as const;

export type ClaveRespuestaV3 = (typeof CLAVES_RESPUESTAS_V3)[number];

export type RespuestasSeguroV3 = Readonly<Record<ClaveRespuestaV3, "SI" | "NO">>;

export type ResultadoInterpretacionV3 =
  | { readonly ok: true; readonly respuestas: RespuestasSeguroV3 }
  | { readonly ok: false; readonly sinResponder: readonly ClaveRespuestaV3[] };

/** Valida la forma del bloque crudo que llega por HTTP: las 5, `SI`/`NO`. */
export function interpretarRespuestasV3(bruto: Readonly<Record<string, unknown>>): ResultadoInterpretacionV3 {
  const sinResponder: ClaveRespuestaV3[] = [];
  const respuestas: Partial<Record<ClaveRespuestaV3, "SI" | "NO">> = {};
  for (const clave of CLAVES_RESPUESTAS_V3) {
    const valor = bruto[clave];
    if (valor === "SI" || valor === "NO") {
      respuestas[clave] = valor;
    } else {
      sinResponder.push(clave);
    }
  }
  if (sinResponder.length > 0) {
    return { ok: false, sinResponder };
  }
  return { ok: true, respuestas: respuestas as RespuestasSeguroV3 };
}

/**
 * Expande las 5 respuestas en las 8 claves numéricas de P6.
 *
 * Precondiciones que garantiza el caso de uso (y verifican los tests):
 * la aceptación agrupada está marcada y `carencias === "SI"`.
 */
export function expandirRespuestasV3(respuestas: RespuestasSeguroV3): Record<string, "SI" | "NO"> {
  return {
    "1": respuestas.salud,
    "2": respuestas.antecedentes,
    "3": respuestas.enfermedades,
    "4": respuestas.carencias,
    "5": "SI",
    "6": "SI",
    "7": "SI",
    "8": respuestas.pep,
  };
}
