/**
 * Textos del paso 3 del flujo v3 · «Pagá y firmá» (`/pago-y-firma`), según
 * docs/ESPECIFICACION_PANTALLAS.md → "Paso 3" y las decisiones DI-1 y DI-8
 * del Bloque E.
 *
 * Mismo criterio que `textos-inscripcion.ts` y `textos-seguro.ts`: módulo sin
 * dependencias con `node:*`, consumido por la pantalla (muestra) y por el
 * endpoint (persiste). **Cambiar una palabra del literal aceptado obliga a
 * subir la versión.**
 *
 * La aceptación agrupada 3 es, además, **el texto que la firma interna del
 * cliente registra como aceptado en el acto** (`firma-cliente.ts`
 * recibe `textoAceptado`/`versionTextoAceptado` y los asienta en la firma):
 * lo que se acepta al marcar la casilla es lo que queda firmado.
 */

export const ENCABEZADO_PASO_3 =
  "Firmás primero y pagás después: así solo te cobramos algo que ya aceptaste.";

export const TITULO_SECCION_FIRMA = "primero, tu firma";
export const TITULO_SECCION_PAGO = "Después, el pago";

export const INTRO_FIRMA =
  "Interseguros S.A. te hace una propuesta de seguro: un PDF cerrado con el plan que elegiste, " +
  "tus datos y tus declaraciones, acompañado del FIPF. Si estás de acuerdo, la firmás.";

/** Expandible «¿Qué es el FIPF?» — el formulario real (DI-1, Res. SEPRELAD 71/19). */
export const ROTULO_QUE_ES_FIPF = "¿Qué es el FIPF y qué estoy firmando?";
export const NOTA_QUE_ES_FIPF =
  "El FIPF es el Formulario de Identificación de Persona Física que exige la normativa de " +
  "prevención de lavado de activos: identifica a quien contrata — datos personales, laborales, " +
  "económicos, origen de fondos y condición PEP — y viaja dentro del mismo PDF que la " +
  "propuesta, con una sola huella SHA-256. Al firmar aceptás la propuesta completa; hasta ese " +
  "momento no hay contrato ni cobro.";

// ---------------------------------------------------------------------------
// Aceptación agrupada 3 (DI-8)
// ---------------------------------------------------------------------------

export const ROTULO_ACEPTACION_FIRMA =
  "Marcá acá para aceptar la propuesta y firmarla — revisión, licitud de fondos y solicitud de " +
  "firma, en un solo paso.";

export const ITEMS_ACEPTACION_FIRMA: readonly string[] = [
  "Confirmo que recibí de Interseguros el PDF único con la propuesta y el FIPF, que pude " +
    "revisarlo y corregir mis datos, que acepto su contenido y que deseo firmarlo " +
    "electrónicamente.",
  "Declaro que los fondos con los que pagaré este seguro tienen origen lícito.",
  "Entiendo que después de mi firma firman Interseguros y Alianza Garantía (firma cualificada) " +
    "y recién entonces se habilita el pago, con 24 horas para completarlo.",
];

/** El literal que la firma del cliente registra como texto aceptado. */
export const TEXTO_ACEPTACION_FIRMA = ITEMS_ACEPTACION_FIRMA.join(" ");

export const VERSION_ACEPTACION_FIRMA = "PAGO-FIRMA-ACEPTACION-v1";

// ---------------------------------------------------------------------------
// Canal, código y estados del acto
// ---------------------------------------------------------------------------

export const INTRO_CANAL_FIRMA =
  "La firma se realiza mediante un código de un solo uso que te enviamos a un canal que ya " +
  "verificaste. Elegí por dónde querés recibirlo:";

export const AVISO_CANAL_FIRMA =
  "Solo se envía a los canales que ya verificaste. Ningún operador te va a pedir ese código.";

export const CONFIRMACION_FIRMADO =
  "✓ Documento firmado · cliente + Interseguros + Alianza Garantía";

export const ESPERANDO_INSTITUCIONALES =
  "Tu firma quedó registrada. Estamos aplicando las firmas de Interseguros y Alianza Garantía…";

export const INTRO_PAGO =
  "El pago se habilita apenas firmes — es la garantía de que solo pagás lo que ya aceptaste.";

export const BLOQUEO_PAGO = "El pago se habilita apenas firmes.";
