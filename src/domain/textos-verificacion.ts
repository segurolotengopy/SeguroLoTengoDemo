/**
 * Literales de la página pública de verificación (CMP-06).
 *
 * Mismo criterio que el resto de los `textos-*`: módulo sin ninguna
 * dependencia, porque lo consumen el servidor y el navegador.
 *
 * ## Por qué el copy de esta pantalla se cuida distinto
 *
 * Es la única pantalla del producto que **le habla a alguien que no es el
 * cliente**: un hospital, un empleador, un familiar, alguien de Alianza con el
 * PDF en la mano. Dos consecuencias sobre los textos:
 *
 * - No puede prometer nada sobre la cobertura. Dice qué verifica —que el
 *   documento se emitió acá y no fue alterado— y dice explícitamente qué no
 *   (el estado de la cobertura, que se consulta con la aseguradora). Ver el
 *   encabezado de `src/domain/verificacion-documento.ts`.
 * - No puede tutear ni vosear a nadie en particular sin sonar raro: el voseo
 *   del resto del producto se dirige a quien contrata. Acá los textos son
 *   impersonales salvo las instrucciones de uso, que sí se dirigen a quien
 *   está consultando.
 *
 * Respaldo normativo: CMP-06 de `docs/plan/PLAN_DE_CAMBIOS_v2.md` §7.1
 * (*"verificación de autenticidad del CPC"*). El QR que lleva a esta página es
 * decisión de producto y no obligación legal (ver `src/documentos/qr.ts`); la
 * verificación en sí sí lo es.
 */

export const TITULO_VERIFICACION = "Verificación de documentos";

export const BAJADA_VERIFICACION =
  "Esta página confirma que un documento fue emitido por este portal y permite comprobar que no fue alterado.";

/**
 * El límite de la página, dicho de frente y no en letra chica. Sin esto, un
 * documento auténtico se lee como "cobertura vigente", que es otra cosa.
 */
export const ALCANCE_VERIFICACION =
  "Confirma la autenticidad y la integridad del documento. No informa el estado de la cobertura ni el de la póliza: eso se consulta con la aseguradora.";

export const AVISO_SIN_DATOS_PERSONALES =
  "Por privacidad, esta página no muestra datos de la persona asegurada. Los datos figuran en el documento.";

// ---------------------------------------------------------------------------
// Buscador
// ---------------------------------------------------------------------------

export const ROTULO_CAMPO_CODIGO = "Código del documento";

export const AYUDA_CAMPO_CODIGO =
  "Está impreso arriba a la derecha de cada página del documento, y es el que codifica su código QR.";

export const EJEMPLO_CODIGO = "PROP-00018425";

export const BOTON_VERIFICAR = "VERIFICAR";

// ---------------------------------------------------------------------------
// Resultado
// ---------------------------------------------------------------------------

export const TITULO_DOCUMENTO_VERIFICADO = "DOCUMENTO VERIFICADO";

export const ROTULO_CODIGO = "Código";
export const ROTULO_TIPO_DOCUMENTO = "Documento";
export const ROTULO_CORRELATIVO = "Correlativo";
export const ROTULO_VERSION = "Versión";
export const ROTULO_SELLO_DE_TIEMPO = "Cerrado el";
export const ROTULO_VINCULADO = "Vinculado a";
export const ROTULO_HUELLA = "Huella SHA-256";

export const TITULO_FIRMANTES = "FIRMAS";

export const ROTULO_NIVEL_FIRMA: Readonly<Record<string, string>> = {
  SIMPLE: "Firma electrónica no cualificada",
  CUALIFICADA: "Firma electrónica cualificada",
};

export const ROTULO_MODALIDAD_FIRMA: Readonly<Record<string, string>> = {
  PREFIRMADO: "Prefirmado",
  CONJUNTO: "En el mismo acto",
};

export const LEYENDA_FIRMA_PENDIENTE = "Todavía no aplicada.";

export const TITULO_VIGENCIA = "COBERTURA QUE DECLARA EL CERTIFICADO";

export const ROTULO_INICIO_VIGENCIA = "Desde";
export const ROTULO_FIN_VIGENCIA = "Hasta";

/**
 * La aclaración que evita el malentendido más caro de esta pantalla: que el
 * certificado sea auténtico no significa que la cobertura esté vigente hoy.
 */
export const LEYENDA_VIGENCIA_DECLARADA =
  "Son las fechas que el certificado declara. La vigencia efectiva de la cobertura la confirma la aseguradora.";

// ---------------------------------------------------------------------------
// Comparación de la huella
// ---------------------------------------------------------------------------

export const TITULO_COMPARAR = "COMPROBÁ TU ARCHIVO";

export const BAJADA_COMPARAR =
  "Elegí el PDF que tenés y calculamos su huella en tu propio dispositivo para compararla con la registrada. El archivo no se sube a ningún lado.";

export const ROTULO_BOTON_ARCHIVO = "ELEGIR EL PDF";

export const RESULTADO_COMPARACION_COINCIDE =
  "La huella coincide: el archivo es exactamente el que se emitió.";

export const RESULTADO_COMPARACION_NO_COINCIDE =
  "La huella no coincide. El archivo no es el que se emitió con este código, o fue modificado después.";

export const RESULTADO_COMPARACION_SIN_SOPORTE =
  "Este navegador no puede calcular la huella. Compará el valor a mano con el de tu archivo.";

// ---------------------------------------------------------------------------
// Casos en los que no hay nada que verificar
// ---------------------------------------------------------------------------

export const TITULO_NO_VERIFICADO = "NO PUDIMOS VERIFICAR ESTE CÓDIGO";

export const MOTIVOS_NO_VERIFICABLE: Readonly<Record<string, string>> = {
  CODIGO_INVALIDO:
    "Ese código no tiene la forma de ninguno de los documentos de este portal. Revisá que esté completo, con su prefijo y sus ocho dígitos.",
  NO_ENCONTRADO:
    "No hay ningún documento emitido con ese código. Revisá que esté bien tipeado; si lo escaneaste del documento y el resultado es este, comunicate con Interseguros.",
  COMPROBANTE_SIN_VERIFICACION:
    "El comprobante de pago no se verifica por sí solo: constata una operación que ya está respaldada por el certificado de cobertura y por la Solicitud firmada. Verificá cualquiera de esos dos.",
};

export const ROTULO_VOLVER_AL_INICIO = "Ir al inicio";
