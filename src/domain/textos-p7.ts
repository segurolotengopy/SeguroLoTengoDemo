/**
 * Literales de P7 · Facturación y garantía de pago, transcritos de
 * docs/ESPECIFICACION_PANTALLAS.md → "P7 · Paso 7 de 9 — Facturación y
 * garantía de pago".
 *
 * Mismo criterio que `textos-p1.ts`, `textos-p3.ts` y `textos-p6.ts`: módulo
 * sin ninguna dependencia (ni siquiera `node:*`) porque lo consumen las dos
 * orillas —la pantalla, que muestra los literales, y el caso de uso del
 * servidor, que registra la versión del que se aceptó—.
 *
 * **Al cambiar una sola palabra de la declaración de origen lícito hay que
 * subir `VERSION_DECLARACION_ORIGEN_LICITO`.** Las evidencias ya guardadas
 * apuntan a la versión vieja y no se reescriben nunca (regla inviolable #10).
 *
 * ## Divergencia declarada de la especificación
 *
 * El documento presenta dos medios de pago (`QR BANCARD` y `TARJETA DE
 * CRÉDITO O DÉBITO`); acá hay tres, separando débito de crédito porque son dos
 * productos distintos de Bancard aunque hoy se comporten igual. Desde D-02 los
 * tres cobran directo: la preautorización se retiró y con ella la distinción
 * entre dinero reservado y dinero acreditado.
 *
 * ## Respaldo normativo de los bloques
 *
 * Filas de `docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv`, categoría
 * "R3 - INTEGRACIÓN DE PAGO CON BANCARD" salvo donde se indica:
 *
 * - 23 — Alianza Garantía titular del vPOS y receptora del premio (decisión
 *   comercial; Bancard bajo Ley 70/2020, arts. 3-4, y Res. BCP 25/21, arts. 1-4).
 * - 24 — SeguroLoTengo no almacena PAN completo, CVV ni credenciales de
 *   tarjeta (Res. BCP 25/21, art. 8; PCI-DSS por contrato).
 * - 25 — El importe enviado a Bancard coincide con el premio informado
 *   (Ley 4868/13, art. 7(l); Ley 1334/98, art. 15(a); Res. BCP 25/21, arts. 5-6).
 * - 26 y 27 — Preautorizar antes de firmar y capturar después. **Ya no
 *   aplican:** D-02 retiró la preautorización. La protección que buscaban —no
 *   cobrar por un contrato sin firmar— la da ahora el orden del flujo.
 * - 28 — En QR, permitir el pago anterior a la firma e informar la condición y
 *   la devolución (Ley 4868/13, arts. 7(m, p, q) y 30(c)).
 * - 30 — Devolver el premio si no se firma dentro del plazo comunicado
 *   (Ley 4868/13, arts. 7(f), 17 y 30(b); Res. SS SG. 215/15, Anexo 1,
 *   numerales 8.4, 8.5 y 8.9).
 * - 31 — Conservar ID, estado, fecha, hora, importe y referencia de la
 *   operación (Res. BCP 25/21, art. 6(a-e); Ley 6822/21, arts. 42(5) y 66).
 * - 32 — Idempotencia para impedir cobros o eventos duplicados
 *   (Ley 6822/21, art. 68(1); Res. BCP 25/21, art. 8).
 * - 16 — El origen de fondos integra el FIPF ("R2 - CONSENTIMIENTO,
 *   IDENTIFICACIÓN Y REPUDIO", Res. SEPRELAD 71/19, art. 26(1)(a-j)).
 */
import type { MedioDePago } from "./tipos";

export const TITULO_P7 = "Facturación y garantía de pago";

export const SUBTITULO_P7 = "Prepará el pago antes de firmar.";

export const ADVERTENCIA_P7 = "La póliza todavía no se emite en esta pantalla.";

export const LEYENDA_PROCESADOR_P7 =
  "Bancard procesa la operación directamente a favor de Alianza Garantía.";

// ---------------------------------------------------------------------------
// Bloque 1 — Datos para la factura
// ---------------------------------------------------------------------------

export const TITULO_BLOQUE_FACTURA_P7 = "Datos para la factura";

export const NOTA_FACTURA_A_NOMBRE_DEL_ASEGURADO_P7 = "Siempre a nombre del asegurado.";

export const ROTULO_NOMBRE_A_FACTURAR_P7 = "Nombre a quien facturar";

export const ROTULO_RUC_P7 = "RUC";

export const NOTA_RUC_VACIO_P7 =
  "Si queda vacío, SeguroLoTengo enviará automáticamente a Alianza el nombre y la cédula del asegurado.";

export const TITULO_LIQUIDACION_P7 = "Liquidación del premio";

export const ROTULO_PRIMA_NETA_P7 = "Prima neta anual";

export const ROTULO_IVA_P7 = "IVA";

export const ROTULO_PREMIO_TOTAL_P7 = "Premio total anual";

/**
 * Aviso de que la apertura del premio todavía no es la oficial (D-04).
 *
 * La matriz deja el desglose como PENDIENTE ALIANZA. Mostrar los importes sin
 * decirlo sería peor que no mostrarlos: un número con forma de definitivo se
 * lee como definitivo, y este va a una factura.
 */
export const NOTA_DESGLOSE_PROVISIONAL_P7 =
  "Apertura provisional para la demostración: el desglose oficial entre prima e impuestos lo " +
  "define Alianza Garantía.";

/** CHG-35 · aclaración de moneda al pie de la liquidación. */
export const NOTA_MONEDA_P7 = "Todos los importes están expresados en guaraníes.";

/**
 * CHG-36 · destino de los fondos, al pie de la pantalla de pago.
 *
 * Lo pidió Rodrigo en la reunión (00:36:51) y lo corrigió en el acto: no es
 * "el pago de la prima" sino **del premio** —prima más impuestos—, que es lo
 * que la persona efectivamente paga. Importa que se diga acá: el cobro lo
 * recibe la aseguradora, no el corredor, y esa es la razón por la que
 * Interseguros no toca el dinero (fila 23 de la matriz de cumplimiento:
 * Alianza Garantía es titular del vPOS y receptora del premio).
 */
export const NOTA_DESTINO_DE_FONDOS_P7 =
  "El pago del premio irá directamente a las cuentas de Alianza Garantía Seguros y Reaseguros S.A.";

// ---------------------------------------------------------------------------
// Declaración de origen lícito de fondos (checkbox obligatorio)
// ---------------------------------------------------------------------------

export const VERSION_DECLARACION_ORIGEN_LICITO = "P7-ORIGEN-LICITO-v1";

/** Literal exacto del checkbox obligatorio del bloque 1. */
export const TEXTO_DECLARACION_ORIGEN_LICITO =
  "Declaro que los fondos utilizados para pagar el premio son de mi propiedad y tienen origen lícito.";

export const NOTA_DECLARACION_ORIGEN_LICITO_OBLIGATORIA_P7 = "Obligatorio para continuar.";

// ---------------------------------------------------------------------------
// Referencias de la operación
// ---------------------------------------------------------------------------

export const TITULO_REFERENCIAS_P7 = "Referencias de la operación";

export const ROTULO_PROPUESTA_P7 = "Propuesta / futura póliza";

export const ROTULO_IDENTIFICADOR_BANCARD_P7 = "Identificador Bancard";

export const IDENTIFICADOR_BANCARD_PENDIENTE_P7 = "Se genera al confirmar";

export const NOTA_IDENTIFICADOR_BANCARD_P7 = "Se incorporará a la póliza.";

// ---------------------------------------------------------------------------
// Bloque 2 — Medios de pago
// ---------------------------------------------------------------------------

export const TITULO_BLOQUE_MEDIOS_P7 = "Elegí el medio de pago";

export const NOTA_MOMENTOS_DISTINTOS_P7 =
  "Las modalidades tienen momentos de confirmación diferentes.";

export interface TextoMedioDePago {
  readonly medio: MedioDePago;
  /** Rótulo del encabezado de la tarjeta de opción, en mayúsculas. */
  readonly titulo: string;
  /** Bajada que explica cuándo se mueve el dinero. */
  readonly momento: string;
  readonly vinetas: readonly string[];
  readonly botón: string;
  /** Secuencia del bloque `DESPUÉS DE ESTA PANTALLA`. */
  readonly secuencia: string;
}

export const TEXTOS_MEDIOS_DE_PAGO_P7: readonly TextoMedioDePago[] = [
  {
    medio: "QR_BANCARD",
    titulo: "QR Bancard",
    momento: "Pago definitivo antes de la firma",
    vinetas: [
      "Bancard genera un QR por el premio total anual.",
      "El pago se acredita directamente a Alianza.",
      "Solo después del pago se habilita la firma.",
    ],
    botón: "GENERAR QR BANCARD",
    secuencia: "QR pagado → Firma Code100 → Solicitud de emisión",
  },
  {
    medio: "TARJETA_DEBITO",
    titulo: "Tarjeta de débito",
    momento: "Pago definitivo antes de la firma",
    vinetas: [
      "Bancard abre su formulario seguro.",
      "El importe se debita y se acredita a Alianza en el momento; no queda reservado.",
      "Solo después del pago se habilita la firma.",
    ],
    botón: "PAGAR CON DÉBITO",
    secuencia: "Débito pagado → Firma Code100 → Solicitud de emisión",
  },
  {
    medio: "TARJETA_CREDITO",
    titulo: "Tarjeta de crédito",
    // D-02 · cobro directo, igual que el débito. La reserva desapareció con la
    // preautorización, así que las tres modalidades se describen igual: cambia
    // por dónde entra el dinero, no cuándo.
    momento: "Cobro al confirmarse la operación",
    vinetas: [
      "Bancard abre su formulario seguro.",
      "El importe se cobra y se acredita a Alianza en el momento.",
      "Los datos de la tarjeta no pasan por el portal.",
    ],
    botón: "PAGAR CON TARJETA DE CRÉDITO",
    secuencia: "Tarjeta cobrada → Firma → Emisión",
  },
];

/** Opción por defecto de la especificación. */
export const MEDIO_POR_DEFECTO_P7: MedioDePago = "QR_BANCARD";

export const TITULO_PLAZO_FIRMA_P7 = "Plazo para firmar: 24 horas";

/**
 * Aviso del plazo para las modalidades que ya cobraron (QR y débito): si la
 * firma no llega, hay devolución. Transcrito de la viñeta del QR de la
 * especificación, con "el pago" en lugar de "el QR" para que sirva a las dos.
 */
export const AVISO_PLAZO_FIRMA_CON_DEVOLUCION_P7 =
  "Si no se completa la firma dentro de 24 horas, la solicitud vence; se avisa por WhatsApp y correo " +
  "y habrá que firmar la solicitud de devolución en las oficinas de Alianza Garantía.";

export const TITULO_DEPENDENCIA_BANCARD_P7 = "Dependencia de Bancard";

/** Literal de la especificación, bajo la opción de tarjeta. */
export const DEPENDENCIA_BANCARD_P7 =
  "Se habilitará cuando Bancard confirme la modalidad de compra simple para el vPOS de Alianza.";

export const TITULO_DESPUES_DE_ESTA_PANTALLA_P7 = "Después de esta pantalla";

// ---------------------------------------------------------------------------
// Seguridad y trazabilidad
// ---------------------------------------------------------------------------

export const TITULO_SEGURIDAD_P7 = "Seguridad y trazabilidad";

export const SEGURIDAD_P7: readonly string[] = [
  "Alianza es el comercio adherido y titular de la cuenta.",
  "SeguroLoTengo e Interseguros no reciben el dinero ni almacenan el número completo de tarjeta o CVV.",
  "Se registrarán referencia, importe, estado, fecha, hora, respuesta e identificador Bancard.",
];

export const ADVERTENCIA_PAGO_NO_ES_FIRMA_P7 = "El pago no equivale a firma ni emisión.";

// ---------------------------------------------------------------------------
// Botón final
// ---------------------------------------------------------------------------

export const BOTON_CONTINUAR_P7 = "CONTINUAR A FIRMA →";
