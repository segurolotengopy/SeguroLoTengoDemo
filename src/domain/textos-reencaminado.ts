/**
 * Lo que cada pantalla del flujo le dice a quien vuelve a ella con el trámite
 * ya adelantado.
 *
 * Es el único texto propio del panel `TramiteEnOtroPaso`: el título, el rótulo
 * del botón y el aviso de demostración son iguales en todas. Están acá juntos
 * y no repartidos en cada pantalla porque se leen como una familia —conviene
 * ver de un vistazo que las cinco frases dicen lo mismo con distinta palabra— y
 * porque la voz del producto es del dominio, no de la capa de React.
 *
 * Dos reglas que comparten los cinco:
 *
 * - **Dicen qué paso quedó atrás, no "este paso ya pasó".** Quien vuelve a una
 *   pantalla suele estar buscando algo concreto (cambiar un dato, mirar qué
 *   había puesto); si el aviso no nombra el paso, no le contesta la pregunta.
 * - **Dicen qué hacer**, que es la regla de `rutas-flujo.ts` aplicada al texto
 *   y no solo al botón.
 *
 * `DETALLE_TRAMITE_CERRADO` (en `textos-plan.ts`) los reemplaza a todos cuando
 * el trámite ya terminó: ahí no importa qué paso quedó atrás.
 */

export const DETALLE_WHATSAPP_YA_VERIFICADO =
  "Tu WhatsApp ya está verificado, así que no hace falta pedir otro código. " +
  "Podés retomar el trámite donde quedaste.";

export const DETALLE_PREPARACION_YA_AUTORIZADA =
  "Ya autorizaste el inicio del trámite, así que esta pantalla no vuelve a pedirlo. " +
  "Podés retomarlo donde quedaste.";

export const DETALLE_IDENTIDAD_YA_VERIFICADA =
  "Tu identidad ya fue verificada, así que las fotografías no se vuelven a tomar desde acá. " +
  "Si algún dato de tu cédula quedó mal, escribinos antes de firmar: el documento que vas a " +
  "firmar los lleva.";

export const DETALLE_INSCRIPCION_COMPLETA =
  "Tu inscripción ya está completa: identidad verificada, WhatsApp confirmado y " +
  "autorizaciones aceptadas. Podés retomar el trámite donde quedaste.";

export const DETALLE_DECLARACIONES_YA_RESPONDIDAS =
  "Ya respondiste las declaraciones y quedaron guardadas con la fecha y la hora en que las " +
  "hiciste, así que no se editan desde acá. Podés retomar el trámite donde quedaste.";

export const DETALLE_FIRMA_YA_HECHA =
  "El documento ya está firmado, así que no se vuelve a firmar. Podés retomar el trámite " +
  "donde quedaste.";

export const DETALLE_CONFIRMACION_SIN_CONTRATACION =
  "Este trámite todavía no llegó a la contratación aceptada, así que acá no hay nada que " +
  "mostrar. Podés retomarlo donde quedaste.";

export const DETALLE_PAGO_YA_HECHO =
  "El pago de este trámite ya está confirmado, así que esta pantalla no vuelve a cobrarlo. " +
  "Podés ver el detalle y descargar tus documentos donde quedaste.";
