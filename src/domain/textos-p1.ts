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

/**
 * CHG-10 · qué significa y qué **no** significa haber verificado el número.
 *
 * La reunión (00:08:16) lo pidió al pie de la pantalla y con las dos mitades
 * juntas, que es lo que lo hace útil: la primera desactiva el miedo a haberse
 * comprometido a algo, y la segunda deja asentado lo único que la verificación
 * sí prueba. Sin la segunda mitad el paso no tendría valor probatorio; sin la
 * primera, la persona puede creer que ya contrató.
 */
export const AVISO_ALCANCE_VERIFICACION_P1 =
  "La verificación no implica la contratación del seguro, la firma de documentos, el inicio de la " +
  "cobertura ni la obligación de pago de prima. Sin embargo, constituye una declaración de que el " +
  "número indicado es de mi propiedad y se encuentra bajo mi control.";
