/**
 * Textos versionados que el proponente acepta en P1, tal como figuran en
 * docs/ESPECIFICACION_PANTALLAS.md → "P1 · Paso 1 de 9".
 *
 * Viven en un módulo sin ninguna dependencia (ni siquiera `node:*`) porque
 * los consumen las dos orillas: la pantalla, que muestra el literal, y el
 * caso de uso del servidor, que registra la versión aceptada en la evidencia
 * (regla inviolable #10). Si estuvieran dentro del caso de uso, importarlos
 * desde el componente de cliente arrastraría al navegador toda la lógica de
 * servidor —incluido `node:crypto`— y el bundle no compilaría.
 *
 * Al cambiar un literal hay que subir su versión: la evidencia ya guardada
 * apunta a la versión vieja y no se reescribe nunca.
 */

/** Literal del checkbox obligatorio del paso 1. */
export const TEXTO_AUTORIZACION_P1 =
  "Autorizo usar este número para verificar el canal, proteger el acceso y continuar el proceso. " +
  "No autoriza publicidad.";

export const VERSION_TEXTO_AUTORIZACION_P1 = "P1-AUTORIZACION-CANAL-v1";
