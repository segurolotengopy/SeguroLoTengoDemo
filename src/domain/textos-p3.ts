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
/**
 * v2 — redacción de la maqueta (p.2, caja azul con candado), completada con la
 * frase de derivación que la Pantalla A necesita poder citar ("conforme al
 * consentimiento general inicial…"): la maqueta no la traía y sin ella la
 * remisión a análisis quedaría sin autorización expresa.
 */
export const CUERPO_AUTORIZACION_INICIAL_P3 =
  "Al presionar el botón TENGO TODO LISTO Y CONTINUAR acepto que todos mis datos personales " +
  "proporcionados, incluyendo información de salud, fotografías y demás información brindada, " +
  "sean utilizados exclusivamente para verificar mi identidad, evaluar el riesgo y generar la " +
  "documentación contractual vinculada a la contratación del seguro y al pago correspondiente.";

/**
 * La autorización a remitir el caso a análisis. Se muestra **en letra más
 * chica** bajo el cuerpo (aprobación del 20-ago-2026): es una consecuencia
 * posible, no la autorización principal, y así se lee sin competir con ella.
 * Vive separada solo para poder maquetarla distinto.
 */
export const DERIVACION_AUTORIZACION_INICIAL_P3 =
  "Si no fuera posible emitir automáticamente, autorizo el envío de mi caso a Interseguros y " +
  "Alianza Garantía para su análisis y que puedan contactarme.";

export const ADVERTENCIA_AUTORIZACION_INICIAL_P3 = "Esto no contrata ni autoriza un pago.";

/**
 * El literal que se persiste y se hashea en la evidencia: las tres partes en
 * el orden en que se muestran. Partirlas para maquetar no cambia ni un
 * carácter de lo aceptado, así que `VERSION_AVISO_P3` no se toca.
 */
export const TEXTO_AUTORIZACION_INICIAL_P3 =
  `${CUERPO_AUTORIZACION_INICIAL_P3} ${DERIVACION_AUTORIZACION_INICIAL_P3} ` +
  `${ADVERTENCIA_AUTORIZACION_INICIAL_P3}`;

export const VERSION_AVISO_P3 = "P3-AUTORIZACION-INICIAL-v2";

/** Aclaración al pie del botón, tal como la pide la especificación. */
export const NOTA_REGISTRO_P3 =
  "Se registrarán fecha, hora, IP y versión del aviso. La aceptación contractual y la firma " +
  "ocurrirán después.";
