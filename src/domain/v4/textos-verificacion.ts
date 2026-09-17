/**
 * Textos de 03A (verificación del número de WhatsApp) y 03B (preparación).
 *
 * ## Lo que cambió respecto del arte
 *
 * 1. **No hay SMS** (D-44). Los artes `03A_10 · SMS disponible` y
 *    `03A_11 · Código SMS enviado` **no se implementan**, y con ellos se cae
 *    el rótulo inconsistente que el análisis marcó —«Verifique su número de
 *    WhatsApp» con un código llegado por SMS—. La cadena queda: WhatsApp →
 *    reenvío por WhatsApp → bloqueo temporal.
 * 2. **El reenvío espera 60 segundos**, no 30: lo dice el manual, que manda
 *    sobre el arte (D-28), y coincide con la regla inviolable #1.
 * 3. **Voseo** (D-35).
 *
 * El texto del consentimiento es el de `screens.json`
 * (`whatsapp_verification_and_marketing`) y no se toca: es el que la persona
 * acepta y el que después se imprime en el paquete documental.
 */

export const TEXTOS_03A = {
  titulo: "Verificá tu número",
  tituloAcento: "de WhatsApp",
  bajada: "Confirmamos que tu número está activo y bajo tu control.",

  bloque1Titulo: "1. Confirmá el número",
  etiquetaPais: "País",
  valorPais: "Paraguay +595",
  etiquetaNumero: "Número de WhatsApp",
  marcadorNumero: "981 000 000",
  consentimiento:
    "Autorizo el envío de un código por WhatsApp para verificar que el número indicado es de mi propiedad y se encuentra bajo mi control. Asimismo, autorizo el envío de publicidad y ofertas de seguros intermediados por Interseguros S.A. por este mismo canal, autorización que podré retirar en cualquier momento.",
  botonEnviar: "ENVIAR CÓDIGO A MI WHATSAPP",
  botonEnviando: "ENVIANDO CÓDIGO...",

  bloque2Titulo: "2. Ingresá el código",
  venceEn: (reloj: string) => `El código vence en ${reloj}`,
  botonVerificar: "VERIFICAR WHATSAPP Y CONTINUAR",
  botonVerificando: "VERIFICANDO...",
  reenviar: "Reenviar código",
  reenviarEn: (reloj: string) => `Reenviar código en ${reloj}`,
  editarNumero: "Editar número",

  // Mensajes de éxito
  codigoEnviado: (numero: string) => `Enviamos un código por WhatsApp al ${numero}`,
  codigoReenviado: (numero: string) => `Enviamos un nuevo código por WhatsApp al ${numero}.`,
  verificado: "Número verificado correctamente",
  continuando: "Continuando...",

  // Errores, uno por estado del arte
  errorNumeroInvalido: "Ingresá los 9 dígitos del número, sin 0 inicial ni +595.",
  errorCodigoIncorrecto: (intentos: number) =>
    `Código incorrecto. Te ${intentos === 1 ? "queda" : "quedan"} ${intentos} ${intentos === 1 ? "intento" : "intentos"}.`,
  errorIntentosAgotados:
    "Código invalidado por superar el máximo de intentos. Pedí uno nuevo.",
  errorVencido: "El código venció. Pedí uno nuevo.",
  errorEnvio: "No pudimos enviar el código. Intentá nuevamente.",
  errorBloqueo: (reloj: string) => `Verificación bloqueada. Nuevo intento disponible en ${reloj}.`,

  avisoCodigoTitulo: "SOBRE EL CÓDIGO ENVIADO",
  avisoCodigo:
    "El código no afecta el funcionamiento ni la seguridad de tu cuenta de WhatsApp; su única finalidad es verificar que el número proporcionado se encuentra activo. Interseguros y Alianza no van a pedirte este código por mensaje o llamada.",
  avisoImportanteTitulo: "IMPORTANTE",
  avisoImportante:
    "Continuar con la verificación del número de WhatsApp no implica, bajo ninguna circunstancia, la contratación del seguro, la firma de documentos, la emisión de la póliza o de la factura, el inicio de la cobertura ni la obligación de pagar el premio.",
} as const;

export const TEXTOS_03B = {
  titulo: "Prepará lo",
  tituloAcento: "necesario",
  bajada: "Antes de empezar la validación, asegurate de tener todo a mano.",
  requisitos: [
    {
      titulo: "Cédula de identidad paraguaya vigente",
      cuerpo:
        "Vamos a fotografiar el frente y el dorso. Los datos deben verse completos, nítidos y sin reflejos.",
    },
    {
      titulo: "Celular o computadora con cámara",
      cuerpo:
        "La cámara se utiliza para fotografiar la cédula y realizar una selfie con prueba de vida.",
    },
    {
      titulo: "WhatsApp y correo electrónico activos",
      cuerpo: "Ambos deben ser de tu propiedad y encontrarse accesibles.",
    },
    {
      titulo: "Medio de pago",
      cuerpo: "Vas a poder pagar con QR Bancard o con tarjeta de débito o crédito.",
    },
  ],
  avisoTitulo: "IMPORTANTE:",
  aviso:
    "Este seguro solo puede ser contratado por la persona que será asegurada. La cédula de identidad, el número de WhatsApp, el correo electrónico y el medio de pago deben pertenecerte.",
  consentimientoAntes: "Leí el ",
  consentimientoEnlace: "Aviso de Privacidad",
  consentimientoDespues:
    " y autorizo, de forma libre, previa, expresa, específica e informada, a Interseguros S.A. y a Alianza Garantía Seguros y Reaseguros S.A., en el ámbito de sus respectivas funciones, a tratar mis datos personales y de salud, fotografías y datos biométricos para verificar mi identidad, realizar la prueba de vida, evaluar el riesgo y gestionar la solicitud, contratación y administración del seguro.",
  continuar: "TENGO TODO LISTO Y CONTINUAR",
} as const;
