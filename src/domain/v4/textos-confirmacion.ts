/**
 * Textos de 05B · Contratación confirmada.
 *
 * **05B no tiene arte aprobado.** `ANALISIS_VISUAL_PNG.md` §8 lo dice
 * explícito: *"04E (revisión y firma), 05A (pago) y 05B (confirmación) no
 * tienen arte y por D-41 no se implementan hasta tenerlo"*. Esta pantalla se
 * escribe igual, por el mismo encargo del 16-sep-2026 que ya destrabó 03E
 * (ver la cabecera de `textos-actividad.ts`: *"empezá a implementar TODAS las
 * pantallas con el arte aprobado o pendiente"*). Es **provisional**: si
 * Interseguros manda el arte de 05B, este archivo y `Pantalla05B.tsx` se
 * rehacen sobre él.
 *
 * Reproduce el mismo contenido normativo que ya tiene `textos-p9.ts` (v2), no
 * uno nuevo: los cuatro descargables (D-05, D-12, D-27), la ausencia de Nota
 * de Cobertura y el inicio de cobertura a 24 horas exactas del cobro (CHG-41)
 * ya están decididos y con respaldo — lo único que cambia es la piel v4 y el
 * voseo. Dos literales **no se reescriben acá y se importan tal cual** de
 * `textos-p9.ts`: el de comunicaciones comerciales y el del mensaje de
 * WhatsApp, porque el primero es exactamente lo que el servidor registra como
 * evidencia (`emision-p9.ts` → `registrarComunicacionesComercialesP9`) y
 * mostrar una paráfrasis distinta de la que queda firmada sería un texto que
 * la persona nunca leyó.
 */

export { TEXTO_COMUNICACIONES_COMERCIALES, mensajeWhatsappP9 } from "../textos-p9";

export const TEXTOS_05B = {
  titulo: "Contratación",
  tituloAcento: "confirmada",
  bajada:
    "Alianza Garantía va a emitir tu póliza y te la va a enviar en breve a tus canales verificados.",

  franjaPago: "Pago acreditado por Bancard.",
  rotuloPremio: "Premio pagado",
  rotuloOperacion: "Operación N.º",

  tituloEstado: "ESTADO DE LA SOLICITUD",
  filas: {
    datos: { concepto: "Datos recibidos", estado: "Completado" },
    firma: { concepto: "Firma electrónica", estado: "Confirmada" },
    pago: { concepto: "Pago del premio", estado: "Confirmado" },
    solicitud: { concepto: "Solicitud", estado: "Aceptada" },
    polizaConcepto: "Póliza",
    polizaEnPreparacion: "En preparación",
    polizaEmitida: (numero: string) => `Emitida N.º ${numero}`,
  },
  etiquetaPropuesta: "N.º de propuesta",

  tituloCobertura: "TU COBERTURA",
  etiquetaInicio: "Inicio de la cobertura",
  etiquetaFin: "Vigencia hasta",
  /**
   * CHG-41 · son 24 horas exactas desde el cobro acreditado, no "el día
   * siguiente". La fecha concreta no se calcula acá: sale del certificado.
   */
  detalleInicio:
    "24 horas exactas después de la confirmación del pago, tal como lo aceptaste en tus consentimientos.",
  certificadoPendienteTitulo: "CERTIFICADO EN PREPARACIÓN",
  certificadoPendiente:
    "El Certificado de Cobertura Provisional está en preparación. Vas a poder descargarlo apenas Alianza Garantía lo firme.",
  entregaCanales: (whatsapp: string, correo: string) =>
    `Alianza Garantía emite y envía la póliza y la factura a tu WhatsApp (${whatsapp}) y tu correo (${correo}) verificados.`,
  /** Leyenda obligatoria: el producto no contempla Nota de Cobertura. */
  leyendaSinNotaCobertura: "No se genera Nota de Cobertura.",

  tituloDocumentos: "TUS DOCUMENTOS",
  documentos: {
    /** D-11 · un solo documento firmado: Solicitud + FIPF. */
    paquete: {
      nombre: "Solicitud de Seguro y FIPF (firmado)",
      // D-42 · Alianza no firma la propuesta; Interseguros la firma con
      // certificado cualificado después del pago (D-38), y la emisión no se
      // ordena hasta que esa firma esté aplicada (`emision-p9.ts`).
      detalle: "Firmado por vos e Interseguros.",
      pendiente: "Preparando el archivo firmado…",
    },
    /** D-12 · el Certificado de Cobertura Provisional. */
    certificado: {
      nombre: "Certificado de Cobertura Provisional",
      detalle: "Firmado por Alianza Garantía. Tu respaldo hasta que llegue la póliza.",
      pendiente: "En preparación.",
    },
    /** D-05 · el comprobante de pago, no la factura. */
    comprobante: {
      nombre: "Comprobante de pago del premio",
      detalle: "Constancia del cobro acreditado por Bancard. No es la factura.",
      pendiente: "Disponible con el certificado de cobertura.",
    },
    /** D-27 · solo con firma interna del cliente. */
    constancia: {
      nombre: "Constancia de tu firma electrónica",
      detalle:
        "Identidad verificada, código de un solo uso, fecha, hora y huella del documento.",
    },
  },
  botonDescargar: "Descargar",

  tituloComunicaciones: "COMUNICACIONES COMERCIALES · OPCIONAL",

  tituloAyuda: "¿NECESITÁS AYUDA?",
  bajadaAyuda: "Escribinos por cualquier duda sobre tu contratación, tu cobertura o tus documentos.",
  /** D-17 · botón de WhatsApp, solo en esta pantalla salvo que se extienda por flag. */
  botonWhatsapp: "Escribinos por WhatsApp",

  botonFinalizar: "Finalizar",
  leyendaCierre:
    "Interseguros va a seguir brindándote asesoramiento y asistencia durante todo el proceso.",
  botonReintentar: "REINTENTAR",
} as const;

/**
 * Mapa de motivo → mensaje, para cuando `GET /api/p9/resumen` responde
 * `ok: false`. Los motivos son los mismos que ya devuelve `emision-p9.ts`
 * (`MotivoRechazoP9`); acá solo se traducen a algo accionable.
 */
export const MENSAJES_05B: Readonly<Record<string, string>> = {
  SESION_INVALIDA: "Se perdió la sesión. Volvé a empezar desde la verificación de WhatsApp.",
  EXPEDIENTE_NO_ENCONTRADO: "Se perdió la sesión. Volvé a empezar desde la verificación de WhatsApp.",
  ESTADO_INVALIDO: "Todavía no llegaste a la contratación aceptada.",
  SIN_FIRMA: "Todavía falta firmar la Solicitud y el FIPF.",
  COBRO_NO_CONFIRMADO:
    "Todavía estamos confirmando el cobro con Bancard. La emisión se pide recién cuando el pago está confirmado.",
  // D-38/D-42 · cobrado, pero la firma cualificada de Interseguros todavía no
  // se aplicó: la emisión no se ordena hasta que esté (`emision-p9.ts`).
  FIRMA_CORREDOR_PENDIENTE:
    "Tu pago está acreditado. Falta la firma de Interseguros sobre tu documentación; en cuanto se aplique, ordenamos la emisión. Volvé a intentar en unos segundos.",
  EXPEDIENTE_INCOMPLETO: "Faltan datos del expediente para remitirlo a Alianza.",
  SEBAOT_NO_DISPONIBLE: "Alianza Garantía no respondió. Volvé a intentar en unos segundos.",
  ERROR_GENERICO: "No pudimos recuperar tu contratación. Volvé a intentar en unos instantes.",
} as const;
