/**
 * Literales del Paso 2 · Verificación de WhatsApp, en el formato de la maqueta
 * (`PantallasDemo2.pdf` p.3; reformulación en
 * `docs/plan/REFORMULACION_PANTALLAS_MAQUETA.md`). El archivo conserva su
 * nombre histórico (`textos-p1`) porque la evidencia guardada referencia sus
 * versiones.
 *
 * Viven en un módulo sin ninguna dependencia (ni siquiera `node:*`) porque
 * los consumen las dos orillas: la pantalla, que muestra el literal, y el
 * caso de uso del servidor, que registra la versión aceptada en la evidencia
 * (regla inviolable #10). Al cambiar un literal hay que subir su versión: la
 * evidencia ya guardada apunta a la versión vieja y no se reescribe nunca.
 */

export const TITULO_WHATSAPP = "Verificá tu número de WhatsApp";
export const SUBTITULO_WHATSAPP = "Este paso confirma que el número está activo y bajo tu control.";

export const TITULO_CONFIRMA_NUMERO = "1. Confirmá el número";
export const TITULO_INGRESA_CODIGO = "2. Ingresá el código";

/**
 * Autorización del envío del código. **v2** (formato maqueta): el acto de
 * autorización es presionar el botón de enviar, con este literal a la vista —
 * mismo patrón que el consentimiento inicial del paso 3. La maqueta incluía
 * acá el consentimiento para recibir ofertas; D-01 (cerrada) lo separó: esta
 * autorización cubre **solo** el código, y la casilla comercial vive aparte y
 * desmarcada en la confirmación.
 */
export const TEXTO_AUTORIZACION_P1 =
  "Al presionar el botón autorizo el envío de un código por WhatsApp con el único fin de " +
  "verificar que este número es mío y continuar con la contratación del seguro. Esta " +
  "autorización no incluye publicidad ni ofertas.";

export const VERSION_TEXTO_AUTORIZACION_P1 = "P1-AUTORIZACION-CANAL-v2";

export const BOTON_ENVIAR_CODIGO = "ENVIAR CÓDIGO POR WHATSAPP";
export const BOTON_VERIFICAR_WHATSAPP = "VERIFICAR WHATSAPP Y CONTINUAR";
export const ENLACE_REENVIAR = "Reenviar código";
export const ENLACE_EDITAR_NUMERO = "Editar número";

/** `Código enviado por WhatsApp a +595 981 ••• 456` (maqueta, en verde). */
export function leyendaCodigoEnviado(destinoEnmascarado: string): string {
  return `Código enviado por WhatsApp a ${destinoEnmascarado}`;
}

export const CHIP_VENCE = "Vence";
export const CHIP_INTENTOS = "Intentos";

export const AVISO_NO_COMPARTIR = "Nunca compartas este código con terceros.";

/**
 * CHG-09 · las dos precisiones de la reunión (00:08:16), compactas: nacen de
 * un susto real — al recibir el código de la prueba, Rodrigo pudo leerlo como
 * un intento de secuestro de su cuenta de WhatsApp.
 */
export const AVISO_SEGURIDAD_CODIGO =
  "Ni Interseguros ni Alianza te van a llamar para pedírtelo. No es el código de seguridad de " +
  "WhatsApp: no sirve para acceder a tu cuenta, solo confirma que este número es tuyo.";

/**
 * CHG-10 · qué significa y qué no significa haber verificado el número.
 * Literal de la maqueta (pie de la p.3), con las dos mitades juntas: la
 * primera desactiva el miedo a haberse comprometido a algo; la segunda deja
 * asentado lo único que la verificación sí prueba.
 */
export const AVISO_ALCANCE_VERIFICACION_P1 =
  "La verificación no implica la contratación del seguro, la firma de documentos, el inicio de la " +
  "cobertura ni la obligación de pago de prima. Sin embargo, constituye una declaración de que el " +
  "número indicado es de mi propiedad y se encuentra bajo mi control.";
