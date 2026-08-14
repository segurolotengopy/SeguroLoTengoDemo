/**
 * Textos de la pantalla de asistencia de identidad.
 *
 * **No es la Pantalla A**, y el contenido lo refleja. La Pantalla A dice
 * `Declaraciones recibidas ✓` y su motivo es `[Salud / PEP / vínculo PEP]`;
 * quien llega acá nunca llegó a P6 ni declaró nada, así que reusar esos textos
 * sería afirmar algo falso sobre la persona.
 *
 * Diferencias de fondo con la Pantalla A, que estos textos tienen que dejar
 * claras porque la situación de la persona es muy distinta:
 *
 * - **No hay nada en su contra.** La Pantalla A dice "por la información
 *   declarada"; acá el problema es del documento o de la captura, no de quien
 *   contrata. El texto no puede sonar a sospecha.
 * - **Puede volver a intentar.** A diferencia de una derivación por
 *   elegibilidad, este estado no bloquea la cédula (regla inviolable #11): si
 *   consigue mejor luz o el documento nuevo, empieza de cero. Decirlo es lo
 *   que evita que abandone creyendo que quedó vetada.
 *
 * Textos en voseo, como el resto del producto.
 *
 * Esta pantalla es **decisión de producto**: no tiene fila en la matriz de
 * cumplimiento ni figura en `ESPECIFICACION_PANTALLAS.md` como parte de las 12
 * pantallas originales.
 */

export const TITULO_ASISTENCIA_IDENTIDAD = "No pudimos verificar tu identidad automáticamente";

export const BAJADA_ASISTENCIA_IDENTIDAD =
  "No es un rechazo y no hay nada anotado en tu contra: el sistema no logró leer tu documento o " +
  "confirmar la selfie. Un asesor de Interseguros puede ayudarte a completar la verificación.";

export const ROTULO_PRODUCTO_ASISTENCIA = "SEGURO DE VIDA ONCOLÓGICO";
export const ROTULO_MODO_ASISTENCIA = "ASISTENCIA DE IDENTIDAD";

export type EstadoHito = "COMPLETADO" | "DERIVACION" | "PENDIENTE";

export interface HitoAsistencia {
  readonly numero: number;
  readonly titulo: string;
  readonly estado: EstadoHito;
  readonly detalle: string;
}

/**
 * Los cuatro hitos, **veraces para este camino**: los canales sí quedaron
 * verificados (P1 y P4 se completaron), pero la identidad no, y las
 * declaraciones nunca se pidieron.
 */
export const HITOS_ASISTENCIA: readonly HitoAsistencia[] = [
  { numero: 1, titulo: "Canales verificados", estado: "COMPLETADO", detalle: "WhatsApp y correo" },
  {
    numero: 2,
    titulo: "Verificación de identidad",
    estado: "DERIVACION",
    detalle: "No se pudo completar automáticamente",
  },
  {
    numero: 3,
    titulo: "Asistencia de un asesor",
    estado: "PENDIENTE",
    detalle: "Pendiente de contacto",
  },
  {
    numero: 4,
    titulo: "Continuar la contratación",
    estado: "PENDIENTE",
    detalle: "Se retoma cuando la identidad quede verificada",
  },
];

export const TITULO_CASO_ASISTENCIA = "CASO DE ASISTENCIA";

export const TITULO_SIN_CONTRATACION = "NO SE INICIÓ NINGUNA CONTRATACIÓN";

/**
 * Lo mismo que declara la Pantalla A sobre no haber cobrado ni emitido. Acá
 * importa aún más: la persona ni siquiera llegó a ver un precio, y conviene
 * que no quede con la duda de si le cobraron algo.
 */
export const PUNTOS_SIN_CONTRATACION: readonly string[] = [
  "No se generó ninguna póliza ni se inició su emisión.",
  "No se solicitó ninguna firma.",
  "No se realizó ni se autorizó ningún pago.",
];

export const TITULO_PODES_REINTENTAR = "PODÉS VOLVER A INTENTARLO";

/**
 * El mensaje que distingue esta pantalla de una derivación por elegibilidad.
 * Sin esto, la persona se va creyendo que quedó vetada.
 */
export const TEXTO_PODES_REINTENTAR =
  "Tu cédula no quedó bloqueada. Si conseguís mejor luz, una fotografía más nítida o tenés a mano " +
  "tu documento vigente, podés empezar de nuevo cuando quieras.";

export const TITULO_QUE_CONVIENE_REVISAR = "QUÉ CONVIENE REVISAR ANTES DE REINTENTAR";

/**
 * Consejos accionables. Salen de los motivos de rechazo reales que produce
 * `identidad-parametros.ts`: pose, nitidez, iluminación, oclusión y encuadre.
 * No mencionan umbrales ni puntuaciones — eso es para la evidencia.
 */
export const CONSEJOS_REINTENTO: readonly string[] = [
  "Buscá un lugar bien iluminado, sin contraluz ni reflejos sobre el documento.",
  "Apoyá la cédula sobre una superficie lisa y que entre completa en el recuadro.",
  "Para la selfie, mirá de frente a la cámara y quitate lentes o barbijo.",
  "Si tu cédula está muy gastada o vencida, conviene renovarla antes de reintentar.",
];

export const TITULO_ASISTENCIA_HUMANA = "TE PODEMOS AYUDAR";

export const TEXTO_ASISTENCIA_HUMANA =
  "Guardá el número de caso y comunicate con Interseguros por cualquiera de estos medios. " +
  "También podemos contactarte por los canales que ya verificaste.";

export const ROTULO_BOTON_REINTENTAR = "VOLVER A INTENTAR";
export const ROTULO_BOTON_INICIO = "Volver al inicio";

export const LEYENDA_NO_ES_RECHAZO_IDENTIDAD =
  "No poder verificar la identidad automáticamente no significa que no puedas contratar: " +
  "significa que el proceso necesita una mano humana.";

export const LEYENDA_CASO_DISTINTO =
  "El número de caso de asistencia es distinto del correlativo de una propuesta o póliza, y " +
  "también del número de caso de una revisión por elegibilidad.";
