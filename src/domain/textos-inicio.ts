/**
 * La aceptación de Términos y condiciones del inicio del flujo v3 (DI-10,
 * Bloque E de docs/plan/DECISIONES.md): es el acto que **crea el expediente**
 * antes del paso 1, con evidencia de fecha, hora, IP y versión de texto.
 *
 * Mismo criterio que `textos-p3.ts`: módulo sin dependencias, el servidor
 * persiste el literal completo, y **cambiar una palabra obliga a subir la
 * versión**.
 *
 * El literal declara solo lo que la casilla del inicio afirma: que se
 * aceptaron los T&C del portal para empezar. Todo lo demás —datos, biometría,
 * firma, derivación— se acepta recién en la aceptación agrupada del paso 1
 * (`textos-inscripcion.ts`), y la publicidad al final, aparte (D-01).
 */

export const ROTULO_TERMINOS_INICIO = "Tocá acá para aceptar los términos y condiciones";

export const TEXTO_TERMINOS_INICIO =
  "Acepto los Términos y condiciones de uso de SeguroLoTengo.com para iniciar la " +
  "contratación. Esta aceptación no contrata un seguro, no firma documentos y no autoriza " +
  "ningún pago: la contratación comienza en el paso 1 y la aceptación contractual ocurre al " +
  "firmar.";

export const VERSION_TERMINOS_INICIO = "INICIO-TYC-v1";

/** Guía del CTA cuando los T&C todavía no se aceptaron (canvas del inicio). */
export const GUIA_TERMINOS_PENDIENTES = "Aceptá los términos y condiciones para continuar.";

/** Guía del CTA con los T&C aceptados (canvas del inicio). */
export const GUIA_TERMINOS_ACEPTADOS =
  "Tené a mano tu cédula vigente y tu celular con cámara.";
