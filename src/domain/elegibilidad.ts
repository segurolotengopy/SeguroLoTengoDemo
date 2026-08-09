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

interface DefinicionDeclaracion {
  readonly numero: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  readonly clave: keyof Declaraciones;
  readonly respuestaHabilitante: RespuestaDeclaracion;
  /** true solo para 1, 2, 3 y 8: las únicas que bloquean la emisión automática. */
  readonly bloqueaEmisionAutomatica: boolean;
}

export const DECLARACIONES_P6: readonly DefinicionDeclaracion[] = [
  { numero: 1, clave: "estadoDeSalud", respuestaHabilitante: "SI", bloqueaEmisionAutomatica: true },
  { numero: 2, clave: "antecedentesDeContratacion", respuestaHabilitante: "NO", bloqueaEmisionAutomatica: true },
  { numero: 3, clave: "enfermedadesDiagnosticadas", respuestaHabilitante: "NO", bloqueaEmisionAutomatica: true },
  { numero: 4, clave: "vigenciaYCarencias", respuestaHabilitante: "SI", bloqueaEmisionAutomatica: false },
  { numero: 5, clave: "veracidad", respuestaHabilitante: "SI", bloqueaEmisionAutomatica: false },
  { numero: 6, clave: "entregaDigital", respuestaHabilitante: "SI", bloqueaEmisionAutomatica: false },
  { numero: 7, clave: "corredorDeLaPoliza", respuestaHabilitante: "SI", bloqueaEmisionAutomatica: false },
  { numero: 8, clave: "condicionPep", respuestaHabilitante: "NO", bloqueaEmisionAutomatica: true },
];

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
