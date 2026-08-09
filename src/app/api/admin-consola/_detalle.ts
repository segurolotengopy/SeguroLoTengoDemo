/**
 * Reexportes que usa la vista de detalle de la consola, en un archivo con
 * guion bajo para que App Router no lo enrute.
 *
 * Existe solo para que el Route Handler tenga un único punto de importación y
 * no arme una lista larga de imports del dominio.
 */
import { leerCasoDerivado } from "@/domain/declaraciones-p6";
import type { CasoDerivado } from "@/domain/declaraciones-p6";
import type { Expediente } from "@/domain/tipos";

export { estadoBloqueaRegistro, expedientesQueBloquean } from "@/domain/consola-administrativa";

/** `null` si el expediente no está derivado; nunca inventa un número de caso. */
export function leerCasoDerivadoSiCorresponde(expediente: Expediente): CasoDerivado | null {
  return leerCasoDerivado(expediente);
}
