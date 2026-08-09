/**
 * Textos versionados que el proponente acepta en P3, tal como figuran en
 * docs/ESPECIFICACION_PANTALLAS.md → "P3 · Paso 3 de 9 — Preparación y
 * autorización inicial".
 *
 * Mismo criterio que `textos-p1.ts`: módulo sin ninguna dependencia (ni
 * siquiera `node:*`) porque lo consumen las dos orillas —la pantalla, que
 * muestra el literal, y el caso de uso del servidor, que lo persiste en el
 * expediente y en la evidencia—. Si estuviera dentro del caso de uso,
 * importarlo desde el componente de cliente arrastraría `node:crypto` al
 * bundle.
 *
 * **Al cambiar una sola palabra del literal hay que subir la versión.** La
 * evidencia y los expedientes ya guardados apuntan a la versión vieja y
 * guardan además su texto completo: no se reescriben nunca.
 *
 * Respaldo normativo del consentimiento: fila 11 de `docs/Tabla Cumplimiento
 * SeguroLo Tengo - Tabla.csv` — "R2 - CONSENTIMIENTO, IDENTIFICACIÓN Y
 * REPUDIO", *Obtener consentimiento inicial para la contratación y el
 * tratamiento de datos*, Ley 4868/13, arts. 6(c) y 7(r); Constitución
 * Nacional, arts. 33 y 36.
 */

/**
 * Literal íntegro de `AUTORIZACIÓN INICIAL PARA COMENZAR`. Es exactamente lo
 * que se guarda como `textoAceptado` cuando la persona presiona el botón.
 *
 * No incluye consentimiento comercial ni publicitario, y no lo va a incluir:
 * la fila 12 de la matriz de cumplimiento (Ley 4868/13, arts. 20, 23 y 30(a))
 * exige que ese consentimiento sea separado, opcional y no premarcado, así
 * que no puede viajar dentro de esta autorización.
 */
/**
 * Cuerpo del consentimiento. Se expone por separado de la advertencia final
 * solo para poder **mostrar** esa última frase destacada, como la marca en
 * negrita la especificación, sin repetirla dos veces en pantalla. Lo que se
 * persiste es siempre el literal completo (`TEXTO_AUTORIZACION_INICIAL_P3`),
 * que es la concatenación exacta de estas dos partes.
 */
export const CUERPO_AUTORIZACION_INICIAL_P3 =
  "Al presionar TENGO TODO LISTO, autorizo a Interseguros S.A. y a Alianza Garantía Seguros y " +
  "Reaseguros S.A. a tratar y compartir mis datos personales, de identificación, biométricos, " +
  "médicos y de condición PEP necesarios para validar mi identidad, evaluar el riesgo, gestionar " +
  "la solicitud y cumplir obligaciones regulatorias. Si no fuera posible emitir automáticamente, " +
  "autorizo el envío de mi caso a Interseguros y Alianza para su análisis y que puedan " +
  "contactarme.";

export const ADVERTENCIA_AUTORIZACION_INICIAL_P3 = "Esto no contrata ni autoriza un pago.";

export const TEXTO_AUTORIZACION_INICIAL_P3 =
  `${CUERPO_AUTORIZACION_INICIAL_P3} ${ADVERTENCIA_AUTORIZACION_INICIAL_P3}`;

export const VERSION_AVISO_P3 = "P3-AUTORIZACION-INICIAL-v1";

/** Aclaración al pie del botón, tal como la pide la especificación. */
export const NOTA_REGISTRO_P3 =
  "Se registrarán fecha, hora, IP y versión del aviso. La aceptación contractual y la firma " +
  "ocurrirán después.";
