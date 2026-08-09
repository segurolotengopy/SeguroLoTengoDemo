/**
 * Motor de elegibilidad de P6 (docs/ESPECIFICACION_PANTALLAS.md, sección P6).
 *
 * Las 8 declaraciones del bloque 2, cada una con su respuesta habilitante.
 * Por la "REGLA AUTOMÁTICA DE ELEGIBILIDAD" y la regla de negocio #5 de
 * CLAUDE.md, una respuesta incompatible en las declaraciones 1, 2, 3 u 8
 * impide la emisión automática (no se prepara pago ni firma) y deriva el
 * expediente a DERIVADO_MANUAL. Las declaraciones 4-7 tienen respuesta
 * habilitante pero no disparan esa derivación.
 */
import type { Declaraciones, RespuestaDeclaracion } from "./tipos";

/**
 * Categoría del bloqueo, para el campo `Motivo` de la Pantalla A
 * (docs/ESPECIFICACION_PANTALLAS.md → "Pantalla A", bloque `CASO DERIVADO PARA
 * ANÁLISIS`: *Motivo `[Salud / PEP / vínculo PEP]`*). `null` en las
 * declaraciones que no derivan.
 */
export type CategoriaBloqueo = "SALUD" | "PEP";

export interface DefinicionDeclaracion {
  readonly numero: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  readonly clave: keyof Declaraciones;
  readonly respuestaHabilitante: RespuestaDeclaracion;
  /** true solo para 1, 2, 3 y 8: las únicas que bloquean la emisión automática. */
  readonly bloqueaEmisionAutomatica: boolean;
  readonly categoriaBloqueo: CategoriaBloqueo | null;
}

export const DECLARACIONES_P6: readonly DefinicionDeclaracion[] = [
  { numero: 1, clave: "estadoDeSalud", respuestaHabilitante: "SI", bloqueaEmisionAutomatica: true, categoriaBloqueo: "SALUD" },
  { numero: 2, clave: "antecedentesDeContratacion", respuestaHabilitante: "NO", bloqueaEmisionAutomatica: true, categoriaBloqueo: "SALUD" },
  { numero: 3, clave: "enfermedadesDiagnosticadas", respuestaHabilitante: "NO", bloqueaEmisionAutomatica: true, categoriaBloqueo: "SALUD" },
  { numero: 4, clave: "vigenciaYCarencias", respuestaHabilitante: "SI", bloqueaEmisionAutomatica: false, categoriaBloqueo: null },
  { numero: 5, clave: "veracidad", respuestaHabilitante: "SI", bloqueaEmisionAutomatica: false, categoriaBloqueo: null },
  { numero: 6, clave: "entregaDigital", respuestaHabilitante: "SI", bloqueaEmisionAutomatica: false, categoriaBloqueo: null },
  { numero: 7, clave: "corredorDeLaPoliza", respuestaHabilitante: "SI", bloqueaEmisionAutomatica: false, categoriaBloqueo: null },
  { numero: 8, clave: "condicionPep", respuestaHabilitante: "NO", bloqueaEmisionAutomatica: true, categoriaBloqueo: "PEP" },
];

export function definicionDeclaracion(numero: number): DefinicionDeclaracion | null {
  return DECLARACIONES_P6.find((definicion) => definicion.numero === numero) ?? null;
}

/** `true` si el valor es una de las dos respuestas posibles. */
export function esRespuestaDeclaracion(valor: unknown): valor is RespuestaDeclaracion {
  return valor === "SI" || valor === "NO";
}

export type ResultadoInterpretacionDeclaraciones =
  | { readonly ok: true; readonly declaraciones: Declaraciones }
  | { readonly ok: false; readonly sinResponder: readonly number[] };

/**
 * Toma el cuerpo crudo de la petición (o el estado del formulario), donde las
 * respuestas llegan indexadas por número de declaración, y devuelve el objeto
 * `Declaraciones` tipado o la lista de las que faltan.
 *
 * Las ocho son obligatorias: no hay respuesta por defecto ni valor implícito.
 * Fila 8 de la matriz de cumplimiento — *"Obtener aceptación expresa; no
 * considerar el silencio como aceptación"*, Ley 4868/13, arts. 7(r) y 26; Ley
 * 6822/21, arts. 67-69; Ley 1334/98, art. 28(m).
 */
export function interpretarDeclaracionesP6(
  bruto: Readonly<Record<string, unknown>>,
): ResultadoInterpretacionDeclaraciones {
  const sinResponder: number[] = [];
  const respuestas: Partial<Record<keyof Declaraciones, RespuestaDeclaracion>> = {};

  for (const definicion of DECLARACIONES_P6) {
    const valor = bruto[String(definicion.numero)];
    if (!esRespuestaDeclaracion(valor)) {
      sinResponder.push(definicion.numero);
      continue;
    }
    respuestas[definicion.clave] = valor;
  }

  if (sinResponder.length > 0) return { ok: false, sinResponder };
  return { ok: true, declaraciones: respuestas as Declaraciones };
}

export interface ResultadoElegibilidad {
  readonly elegibleParaEmisionAutomatica: boolean;
  /** Todas las declaraciones (1-8) cuya respuesta no coincide con la habilitante. */
  readonly declaracionesIncompatibles: readonly number[];
  /** Subconjunto de las anteriores que dispara DERIVADO_MANUAL (regla #5): 1, 2, 3 y/o 8. */
  readonly declaracionesQueBloquean: readonly number[];
}

export function evaluarElegibilidad(declaraciones: Declaraciones): ResultadoElegibilidad {
  const incompatibles: number[] = [];
  const bloquean: number[] = [];

  for (const definicion of DECLARACIONES_P6) {
    if (declaraciones[definicion.clave] !== definicion.respuestaHabilitante) {
      incompatibles.push(definicion.numero);
      if (definicion.bloqueaEmisionAutomatica) {
        bloquean.push(definicion.numero);
      }
    }
  }

  return {
    elegibleParaEmisionAutomatica: bloquean.length === 0,
    declaracionesIncompatibles: incompatibles,
    declaracionesQueBloquean: bloquean,
  };
}

// ---------------------------------------------------------------------------
// Motivo de la derivación (campo `Motivo` de la Pantalla A)
// ---------------------------------------------------------------------------

export type MotivoDerivacion = "SALUD" | "PEP" | "SALUD_Y_PEP";

/**
 * Traduce los números de declaración que bloquearon a la categoría que la
 * Pantalla A muestra como `Motivo`. Devuelve `null` si no bloqueó ninguna.
 *
 * **Nota de la regla inviolable #7:** esto es deliberadamente grueso. El
 * motivo dice "Salud" o "PEP", nunca cuál fue la respuesta ni a qué pregunta:
 * es lo máximo que puede salir del expediente hacia una pantalla o hacia
 * Alianza sin exponer un dato médico concreto.
 */
export function clasificarMotivoDerivacion(
  declaracionesQueBloquean: readonly number[],
): MotivoDerivacion | null {
  const categorias = new Set(
    declaracionesQueBloquean
      .map((numero) => definicionDeclaracion(numero)?.categoriaBloqueo)
      .filter((categoria): categoria is CategoriaBloqueo => categoria !== null && categoria !== undefined),
  );

  if (categorias.has("SALUD") && categorias.has("PEP")) return "SALUD_Y_PEP";
  if (categorias.has("PEP")) return "PEP";
  if (categorias.has("SALUD")) return "SALUD";
  return null;
}

/** Etiqueta legible del motivo, tal como la muestra la Pantalla A. */
export function rotuloMotivoDerivacion(motivo: MotivoDerivacion): string {
  switch (motivo) {
    case "SALUD":
      return "Salud";
    case "PEP":
      return "PEP o vínculo PEP";
    case "SALUD_Y_PEP":
      return "Salud y PEP o vínculo PEP";
  }
}
