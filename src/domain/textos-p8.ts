/**
 * Literales de P8 · Revisión y firma final, transcritos de
 * docs/ESPECIFICACION_PANTALLAS.md → "P8 · Paso 8 de 9 — Revisión y firma
 * final".
 *
 * Mismo criterio que `textos-p1.ts`, `textos-p3.ts`, `textos-p6.ts` y
 * `textos-p7.ts`: módulo sin ninguna dependencia (ni siquiera `node:*`) porque
 * lo consumen las dos orillas —la pantalla, que muestra los literales, y el
 * caso de uso del servidor, que registra la versión del que se aceptó—.
 *
 * **Al cambiar una sola palabra de la declaración de firma hay que subir
 * `VERSION_DECLARACION_FIRMA`.** Las evidencias ya guardadas apuntan a la
 * versión vieja y no se reescriben nunca (regla inviolable #10).
 *
 * ## Respaldo normativo de los bloques
 *
 * Filas de `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv`, categoría
 * "R4 - FIRMA ELECTRÓNICA MEDIANTE CODE100" salvo donde se indica:
 *
 * - 34 — El cliente firma electrónicamente la Solicitud y el FIPF
 *   (Ley 6822/21, arts. 38(1), 42(5) y 67-69; Res. SS SG. 215/15, anexo 1,
 *   numeral 11.15).
 * - 35 — Cerrar los documentos antes de firmar y conservar sus huellas
 *   digitales (Ley 6822/21, arts. 42(5), 61 y 66).
 * - 36 — Un mismo enlace Code100 para firmar la Solicitud y el FIPF (diseño
 *   del proceso; debe mantener atribución conforme al art. 40 de la Ley 6822/21).
 * - 37 — Orden de firma: cliente primero; Interseguros y Alianza después, en
 *   paralelo (no hay artículo que lo imponga).
 * - 41 — Vigencia de 24 horas para el enlace de firma (no es plazo legal;
 *   debe informarse conforme a Ley 4868/13, arts. 7(f), 7(n) y 7(r)).
 * - 42 — Conservar evidencia Code100: identidad, OTP, IP, fecha, hora, hash y
 *   resultado (Ley 6822/21, arts. 42(5), 66 y 68(3)).
 * - 29 — Recordatorios de firma a 1, 5 y 12 horas ("R3", no hay artículo que
 *   determine esos horarios).
 * - 43 y 47 — Firma confirmada → cobro → envío a Alianza → validación
 *   automática → emisión, y vinculación por correlativos o hashes
 *   ("R5 - ACEPTACIÓN, EMISIÓN Y PÓLIZA"; Código Civil, arts. 1348 y 1373-1374;
 *   Res. SS SG. 215/15, punto 14; Ley 6822/21, arts. 44-46).
 */
import type { CanalFirma } from "./tipos";

export const TITULO_P8 = "Revisión y firma final";

export const SUBTITULO_P8 =
  "Revisá los documentos cerrados y firmalos en un único proceso seguro de Code100.";

export const ADVERTENCIA_ACEPTACION_P8 =
  "La aceptación contractual ocurre al firmar en Code100, no al presionar un botón del portal.";

// ---------------------------------------------------------------------------
// Bloque 1 — Revisá los documentos
// ---------------------------------------------------------------------------

export const TITULO_BLOQUE_DOCUMENTOS_P8 = "Revisá los documentos";

export const BADGE_DATOS_VERIFICADOS_P8 = "DATOS E IDENTIDAD VERIFICADOS";

/** D-11 · un solo documento con las dos secciones adentro. */
export const NOMBRE_DOCUMENTO_P8 = "Solicitud de Seguro de Vida Oncológico y FIPF";

export const DESCRIPCION_DOCUMENTO_P8 =
  "Un solo PDF: plan, coberturas, premio y beneficiario; declaraciones médicas, de licitud y " +
  "veracidad, y de cuenta propia; datos personales, laborales y económicos, condición PEP y " +
  "evidencias. Versión definitiva preparada para firma.";

/** Regla inviolable #4: el PDF se cierra y se hashea antes de habilitar la firma. */
export const MARCA_PDF_CERRADO_P8 = "PDF cerrado · hash registrado";

export const BOTON_VER_PDF_P8 = "VER PDF";

/**
 * CHG-29 · por qué acá no hay botón de descarga.
 *
 * Se puede leer el documento entero antes de firmarlo; lo que no se ofrece es
 * llevárselo, porque todavía no lo firmó nadie y un PDF sin firma circulando
 * como si fuera el instrumento confunde más de lo que ayuda. El texto lo dice
 * en vez de dejar que la ausencia del botón parezca un olvido — y no promete
 * que el archivo sea inaccesible, porque no lo es.
 */
export const NOTA_SIN_DESCARGA_ANTES_DE_FIRMAR_P8 =
  "Podés revisarlo completo antes de firmar. La descarga se habilita después del pago, cuando el " +
  "documento ya está firmado y es el instrumento definitivo.";

export const TITULO_ACCESO_PREVIO_P8 = "ACCESO PREVIO A LA INFORMACIÓN";

export const ENLACES_ACCESO_PREVIO_P8: readonly string[] = [
  "Coberturas, exclusiones y carencias",
  "Condiciones del seguro",
  "Aviso de privacidad",
];

export const NOTA_SIN_MODIFICACION_P8 =
  "Después de enviar, los documentos no podrán modificarse sin generar una nueva versión y nuevas huellas digitales.";

// ---------------------------------------------------------------------------
// Bloque 2 — Elegí el canal
// ---------------------------------------------------------------------------

export const TITULO_BLOQUE_CANAL_P8 = "Elegí el canal";

export const SUBTITULO_BLOQUE_CANAL_P8 = "Code100 enviará el enlace al canal elegido.";

/** El canal por defecto de la especificación es el WhatsApp verificado. */
export const CANAL_FIRMA_POR_DEFECTO: CanalFirma = "WHATSAPP";

export const ROTULO_CANAL_P8: Readonly<Record<CanalFirma, string>> = {
  WHATSAPP: "WhatsApp verificado",
  EMAIL: "Correo verificado",
};

/**
 * D-08 · lo que sigue después de firmar.
 *
 * Reemplaza al bloque `GARANTÍA DE PAGO LISTA` de la especificación, que
 * describía el orden viejo: se llegaba a firmar con el premio ya cobrado. Con
 * el orden invertido lo que hay que decir es lo contrario — todavía no se
 * cobró nada, y firmar es lo que habilita el cobro.
 */
export const TITULO_QUE_SIGUE_P8 = "DESPUÉS DE FIRMAR";

export const NOTA_PAGO_DESPUES_DE_FIRMAR_P8 =
  "Todavía no se cobró nada. Al firmar se habilita el pago, y tenés 24 horas para completarlo.";

export const TITULO_UN_SOLO_ACTO_P8 = "UN SOLO ACTO DE FIRMA";

export const TEXTO_UN_SOLO_ACTO_P8 =
  "La firma electrónica no cualificada del cliente quedará vinculada simultáneamente a la Solicitud y al FIPF mediante sus huellas digitales.";

// ---------------------------------------------------------------------------
// Bloque 3 — Firmá mediante Code100
// ---------------------------------------------------------------------------

export const TITULO_BLOQUE_FIRMA_P8 = "Firmá mediante Code100";

export const TITULO_DECLARACION_FIRMA_P8 = "DECLARACIÓN QUE SE ACEPTARÁ AL FIRMAR";

/**
 * Literal íntegro que la persona tiene a la vista al pedir el enlace. Se guarda
 * completo en la evidencia —no solo su versión— por el mismo motivo que en P3 y
 * P7: si alguien edita este archivo sin subir la versión, el expediente sigue
 * conteniendo, palabra por palabra, lo que la persona aceptó.
 */
export const TEXTO_DECLARACION_FIRMA_P8 =
  "Declaro haber tenido acceso y haber revisado la Solicitud, el FIPF, las condiciones, coberturas, " +
  "exclusiones, carencias, premio y forma de entrega; confirmo la veracidad de los datos; acepto el " +
  "contenido de ambos documentos y solicito firmarlos electrónicamente con firma electrónica no " +
  "cualificada, y solicito la emisión de la póliza electrónica de Seguro de Vida Oncológico.";

/**
 * v2 (19-ago-2026, CHG-31): la declaración explicita ahora que la firma del
 * cliente es **no cualificada**.
 *
 * Lo pidió Rodrigo en la reunión (00:25:12: "habría que aumentarle tal vez con
 * firma no cualificada"). No es una precisión cosmética: es el nivel de firma
 * que la persona está solicitando, y la Ley 6822/2021 le asigna efectos
 * distintos que a la cualificada. Que el texto lo diga cierra la distancia
 * entre lo que la pantalla anuncia y lo que Code100 aplica (NC-06).
 *
 * Las evidencias emitidas hasta hoy apuntan a `2026-01-P8-v1` y conservan su
 * propio literal: no se reescriben nunca (regla inviolable #10).
 */
export const VERSION_DECLARACION_FIRMA_P8 = "2026-08-P8-v2";

export const NOTA_ACEPTACION_REGISTRADA_P8 =
  "La aceptación queda registrada por Code100 junto con la firma.";

export const BOTON_ENVIAR_ENLACE_P8 = "ENVIAR ENLACE SEGURO DE FIRMA";

export const NOTA_ENVIO_ENLACE_P8 =
  "Code100 enviará el enlace al canal verificado seleccionado.";

export const PASOS_PROGRESO_FIRMA_P8: readonly string[] = [
  "Recibí el enlace",
  "Abrí y firmá",
  "Volvé al portal",
];

export const ESTADO_ESPERANDO_CODE100_P8 = "Esperando confirmación verificable de Code100";

export const NOTA_SEGUIMIENTO_Y_VENCIMIENTO_P8 =
  "Firmada la Solicitud, el pago tiene seguimiento a 1, 5 y 12 horas y vence a las 24 horas.";

// ---------------------------------------------------------------------------
// Después de la firma del cliente
// ---------------------------------------------------------------------------

export const TITULO_DESPUES_DE_LA_FIRMA_P8 = "DESPUÉS DE LA FIRMA DEL CLIENTE";

export interface PasoPosteriorP8 {
  readonly titulo: string;
  readonly detalle: string;
}

export const PASOS_POSTERIORES_P8: readonly PasoPosteriorP8[] = [
  {
    titulo: "Confirmación Code100",
    detalle: "El cliente firmó la Solicitud y el FIPF; se verifican los hashes y la transacción.",
  },
  {
    titulo: "Firmas institucionales",
    detalle: "Interseguros y Alianza firman ambos PDF con certificado cualificado.",
  },
  {
    titulo: "Pago del premio",
    detalle:
      "Con la firma válida se habilita el cobro por Bancard; tenés 24 horas para completarlo.",
  },
  {
    titulo: "Envío y validación",
    detalle:
      "SeguroLoTengo remite el expediente a Alianza; Alianza valida automáticamente mediante SEBAOT.",
  },
  {
    titulo: "Emisión y entrega",
    detalle:
      "Alianza emite y firma la póliza electrónica; envía la póliza y la factura a los canales verificados.",
  },
];

export const LEYENDAS_FINALES_P8: readonly string[] = [
  "No se genera Nota de Cobertura.",
  "La póliza conserva el correlativo de la Solicitud y el identificador de Bancard.",
  "Se registrarán PDFs, hashes, aceptación, canal, ID de Code100, firmantes, fecha, hora, IP, estados y callbacks.",
];

// ---------------------------------------------------------------------------
// Estados de la pantalla que no son literales del documento
// ---------------------------------------------------------------------------
//
// La especificación describe la pantalla en su estado normal. Estos textos
// cubren los desenlaces que el documento nombra pero no redacta (el enlace
// rechazado, el plazo cumplido) y se escribieron para esta pantalla siguiendo
// el mismo registro. No son literales citables de la especificación.

export const AVISO_FIRMA_RECHAZADA_P8 =
  "Code100 informó que el acto de firma no se completó. Podés pedir un enlace nuevo cuando quieras.";

export const AVISO_ENLACE_ENVIADO_P8 =
  "Enviamos el enlace de firma a tu canal verificado. Abrilo, firmá y volvé a esta pantalla.";
