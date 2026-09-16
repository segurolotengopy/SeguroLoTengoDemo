/**
 * Textos de 04E (revisá, aceptá y firmá). Etapa 4 de 5.
 *
 * **No hay arte aprobado ni candidato para esta pantalla** (handoff v4,
 * 14-sep-2026): el manual funcional describe `04E` como pendiente. Estos
 * textos son una extrapolación del sistema de 03A (verificación con OTP) y de
 * la lógica ya construida para el acto de firma interno del cliente
 * (`src/domain/firma-cliente.ts`, D1 ratificada el 30-ago-2026), no una
 * transcripción de un PNG. Se reescriben en cuanto Interseguros mande el arte.
 *
 * Reglas que estos textos respetan y no pueden aflojar:
 * - **No hay SMS** (D-44): los dos canales posibles son WhatsApp y correo, los
 *   mismos que ya verificó el resto del flujo.
 * - El código nunca se nombra en un mensaje de forma que lo revele (regla
 *   inviolable #2): acá solo se habla de "código", nunca se interpola uno.
 * - Se dice «premio», no «prima» (D-47).
 */

/** Segundos → `MM:SS`. Igual criterio que el resto del flujo (03A). */
export function relojFirma(segundos: number): string {
  const minutos = Math.floor(Math.max(segundos, 0) / 60);
  const resto = Math.max(segundos, 0) % 60;
  return `${String(minutos).padStart(2, "0")}:${String(resto).padStart(2, "0")}`;
}

/** Huella abreviada para mostrar en pantalla: nunca hace falta la huella entera para reconocer el documento. */
export function huellaAbreviada(hashSha256: string): string {
  return hashSha256.length <= 16 ? hashSha256 : `${hashSha256.slice(0, 8)}…${hashSha256.slice(-8)}`;
}

export const TEXTOS_04E = {
  titulo: "Revisá, aceptá",
  tituloAcento: "y firmá",
  bajada: "Tu propuesta ya está lista. Revisala y firmala con un código de un solo uso.",

  // -------------------------------------------------------------------------
  // Qué vas a firmar
  // -------------------------------------------------------------------------
  seccionDocumentoTitulo: "QUÉ VAS A FIRMAR",
  documentoNombre: (codigo: string) => `Solicitud de Seguro + FIPF · ${codigo}`,
  documentoDetalle: (version: number, huella: string) =>
    `PDF cerrado · versión ${version} · huella SHA-256 ${huella}`,
  verPdf: "VER EL PDF",
  preparandoDocumento: "Estamos cerrando tu Solicitud y el FIPF, y registrando su huella…",

  avisoLegalidadTitulo: "AL FIRMAR, ACEPTÁS",
  avisoLegalidad:
    "El PDF que vas a firmar incluye, integradas, tu declaración de que los fondos con los que vas a pagar este seguro tienen origen lícito y tu declaración de veracidad sobre los datos que completaste. No hay una casilla aparte: se aceptan en el mismo acto en que firmás.",

  // -------------------------------------------------------------------------
  // 1 · Elegir canal
  // -------------------------------------------------------------------------
  bloque1Titulo: "1. Elegí por dónde recibir el código",
  botonEnviarWhatsapp: (destino: string) => `Enviar por WhatsApp · ${destino}`,
  botonEnviarCorreo: (destino: string) => `Enviar por correo · ${destino}`,
  botonEnviando: "ENVIANDO CÓDIGO...",

  // -------------------------------------------------------------------------
  // 2 · Código y firma
  // -------------------------------------------------------------------------
  bloque2Titulo: "2. Ingresá el código y firmá",
  codigoEnviado: (destino: string) => `Enviamos un código de firma a ${destino}.`,
  codigoReenviado: (destino: string) => `Enviamos un nuevo código de firma a ${destino}.`,
  venceEn: (reloj: string) => `El código vence en ${reloj}`,
  reenviar: "Reenviar código",
  reenviarEn: (reloj: string) => `Reenviar código en ${reloj}`,
  elegirOtroCanal: "Elegir otro canal",
  botonFirmar: "FIRMAR Y CONTINUAR",
  botonFirmando: "FIRMANDO...",

  firmadoTitulo: "Tu firma quedó registrada",
  firmadoEsperando: "Estamos aplicando las firmas de Interseguros y Alianza Garantía…",

  // -------------------------------------------------------------------------
  // Errores
  // -------------------------------------------------------------------------
  errorCodigoIncorrecto: (intentos: number) =>
    `Código incorrecto. Te ${intentos === 1 ? "queda" : "quedan"} ${intentos} ${intentos === 1 ? "intento" : "intentos"}.`,
  errorIntentosAgotados: "Código invalidado por superar el máximo de intentos. Pedí uno nuevo.",
  errorVencido: "El código venció. Pedí uno nuevo.",
  errorReemplazado: "Pediste un código más nuevo y este dejó de valer. Usá solo el último que recibiste.",
  errorCanalNoVerificado: "Ese canal no está verificado en tu trámite. Elegí el otro.",
  errorPaqueteNoCerrado: "Todavía estamos preparando tu Solicitud y el FIPF. Esperá unos segundos y volvé a intentar.",
  errorEstadoInvalido: "Tu trámite ya no está en este paso. Recargá la página para retomarlo.",
  errorConstanciaNoEmitida: "No pudimos registrar tu firma. Pedí un código nuevo e intentá de nuevo.",
  errorEnvio: "No pudimos enviar el código. Intentá nuevamente.",
  errorGenerico: "No pudimos procesar tu pedido. Intentá nuevamente.",
  errorConexion: "No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.",

  // -------------------------------------------------------------------------
  // Firmas institucionales
  // -------------------------------------------------------------------------
  institucionalesFallidasTitulo: "NO PUDIMOS COMPLETAR TU FIRMA",
  institucionalesFallidas:
    "Tu firma quedó registrada, pero todavía no pudimos aplicar las de Interseguros y Alianza Garantía. Volvé a intentar en unos segundos.",
  botonReintentar: "REINTENTAR",
  reintentando: "REINTENTANDO...",

  // -------------------------------------------------------------------------
  // Avisos fijos
  // -------------------------------------------------------------------------
  avisoCodigoTitulo: "SOBRE EL CÓDIGO DE FIRMA",
  avisoCodigo:
    "Este código es de un solo uso y firma el documento en tu nombre. Interseguros y Alianza nunca te lo van a pedir por mensaje o llamada.",
  avisoImportanteTitulo: "IMPORTANTE",
  avisoImportante:
    "Después de firmar vas a tener 10 minutos para pagar. Si el plazo vence, el trámite caduca sin ningún cobro.",
} as const;
