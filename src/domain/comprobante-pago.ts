/**
 * Comprobante del pago del premio: contenido (D-05, CHG-43).
 *
 * El tercero de los descargables de la pantalla de confirmación, junto con la
 * Solicitud + FIPF firmados y el Certificado de Cobertura Provisional. D-05 lo
 * decidió como parte del paquete que la persona se lleva; no hay fila en la
 * matriz de cumplimiento que lo exija, así que **es decisión de producto**.
 *
 * ## Lo que este documento no es, y por qué importa decirlo
 *
 * **No es la factura.** La factura electrónica la emite Alianza Garantía por
 * SIFEN y llega a los canales verificados (fila 40 de la matriz: Ley 4868/13,
 * arts. 31-32; Ley 125/91, art. 85). Un comprobante emitido por el corredor
 * que no aclarara esto sería, para cualquiera que lo mire, un documento
 * fiscal — y no lo es. La aclaración va en el cuerpo, no en letra chica.
 *
 * **No se verifica por sí solo, y por eso no lleva QR.** Lo que este documento
 * dice ya está probado por dos instrumentos que sí tienen huella registrada:
 * el certificado (`CPC-…`) y la Solicitud firmada (`PROP-…`). Un QR acá
 * sugeriría una verificación independiente que no existe.
 *
 * **No se persiste ni se hashea.** Se arma de lo que ya está en el expediente
 * y es determinista: mismo expediente ⇒ mismos bytes. Guardarlo sería
 * almacenar una proyección de datos que ya están guardados, y hashearlo sería
 * sugerir que es un instrumento cerrado como los otros dos (regla inviolable
 * #4, que gobierna lo que se firma).
 *
 * Igual que `documentos.ts` y `certificado-cobertura.ts`: libre de `node:*`
 * para poder viajar al navegador.
 */
import { PLANES, desglosePremio, formatearGuaranies, NOMBRE_PRODUCTO } from "./catalogo";
import { ALIANZA, INTERSEGUROS } from "./entidades";
import { codigoSolicitud } from "./documentos";
import type { CampoDocumento, EncabezadoDocumento } from "./documentos";
import { codigoCertificado, formatearInstante } from "./certificado-cobertura";
import type { Expediente, MedioDePago } from "./tipos";

// ---------------------------------------------------------------------------
// Identidad del documento
// ---------------------------------------------------------------------------

export const PREFIJO_COMPROBANTE = "REC";

/** `00018425` → `REC-00018425`. Un correlativo, cuatro códigos internos. */
export function codigoComprobante(correlativo: string): string {
  return `${PREFIJO_COMPROBANTE}-${correlativo}`;
}

export const VERSION_COMPROBANTE = 1;

export const TITULO_COMPROBANTE = "Comprobante de pago del premio";

// ---------------------------------------------------------------------------
// Modelo de contenido
// ---------------------------------------------------------------------------

export interface ContenidoComprobante {
  readonly encabezado: EncabezadoDocumento;
  readonly correlativo: string;
  /** Bloque 1 — Quién pagó y a nombre de quién se factura. */
  readonly pagador: readonly CampoDocumento[];
  /** Bloque 2 — La operación en Bancard. */
  readonly operacion: readonly CampoDocumento[];
  /** Bloque 3 — Desglose del importe, rotulado como provisional (D-04). */
  readonly desglose: readonly CampoDocumento[];
  readonly leyendaDesgloseProvisional: string;
  /** Bloque 4 — Qué habilitó este pago. */
  readonly consecuencias: readonly string[];
  readonly leyendaNoEsFactura: string;
  readonly leyendaSinDatosDeTarjeta: string;
}

export type CampoFaltanteComprobante =
  | "numeroPropuesta"
  | "plan"
  | "identidad"
  | "pagoConfirmado"
  | "certificadoCobertura";

export type ResultadoContenidoComprobante =
  | { readonly ok: true; readonly contenido: ContenidoComprobante }
  | { readonly ok: false; readonly faltantes: readonly CampoFaltanteComprobante[] };

const LEYENDA_NO_ES_FACTURA =
  "Este documento no es la factura. La factura electrónica la emite Alianza Garantía Seguros y " +
  "Reaseguros S.A. por SIFEN y se envía a los canales verificados.";

const LEYENDA_SIN_DATOS_DE_TARJETA =
  "El cobro lo procesó Bancard. Este comprobante no contiene ni puede contener el número de " +
  "tarjeta ni el código de seguridad: esos datos nunca pasan por el portal.";

const LEYENDA_DESGLOSE_PROVISIONAL =
  "Desglose provisional, derivado del premio total. El desglose oficial lo fija Alianza Garantía " +
  "y se informa en la factura electrónica.";

/** Cómo se nombra el medio de pago. Nunca datos de tarjeta (regla inviolable #6). */
function medioLegible(medio: MedioDePago): string {
  switch (medio) {
    case "QR_BANCARD":
      return "QR Bancard";
    case "TARJETA_CREDITO":
      return "Tarjeta de crédito (Bancard)";
    case "TARJETA_DEBITO":
      return "Tarjeta de débito (Bancard)";
  }
}

// ---------------------------------------------------------------------------
// Armado
// ---------------------------------------------------------------------------

/**
 * Proyecta el expediente cobrado sobre el contenido del comprobante.
 *
 * Exige el certificado además del pago, y no por capricho: los dos nacen en la
 * misma escritura (D-12), así que un expediente cobrado sin certificado sería
 * un estado imposible, y el comprobante cita el certificado como lo que ese
 * pago habilitó. Pedirlo acá hace que la imposibilidad se note si alguna vez
 * dejara de serlo.
 */
export function armarContenidoComprobante(
  expediente: Expediente,
): ResultadoContenidoComprobante {
  const { numeroPropuesta, plan, identidad, pago, certificadoCobertura, facturacion } = expediente;

  const faltantes: CampoFaltanteComprobante[] = [];
  if (!numeroPropuesta) faltantes.push("numeroPropuesta");
  if (!plan) faltantes.push("plan");
  if (!identidad) faltantes.push("identidad");
  if (!pago || !pago.confirmadoEn || !pago.referenciaBancard) faltantes.push("pagoConfirmado");
  if (!certificadoCobertura) faltantes.push("certificadoCobertura");

  if (
    !numeroPropuesta ||
    !plan ||
    !identidad ||
    !pago ||
    !pago.confirmadoEn ||
    !pago.referenciaBancard ||
    !certificadoCobertura
  ) {
    return { ok: false, faltantes };
  }

  const correlativo = numeroPropuesta;
  const codigo = codigoComprobante(correlativo);
  const desglose = desglosePremio(plan.planId);

  const encabezado: EncabezadoDocumento = {
    codigo,
    // De qué operación es constancia: la propuesta firmada que se pagó.
    codigoVinculado: codigoSolicitud(correlativo),
    correlativo,
    version: VERSION_COMPROBANTE,
    cerradoEn: pago.confirmadoEn,
    titulo: TITULO_COMPROBANTE,
    // Sin QR: ver la cabecera de este módulo.
    urlVerificacion: null,
    selloDeTiempo: formatearInstante(pago.confirmadoEn),
  };

  return {
    ok: true,
    contenido: {
      encabezado,
      correlativo,
      pagador: [
        { etiqueta: "Asegurado y pagador", valor: `${identidad.nombres} ${identidad.apellidos}`.trim() },
        { etiqueta: "Cédula", valor: identidad.numeroCedula },
        // La factura es siempre a nombre del asegurado; el RUC es opcional y
        // manual (P7). Sin RUC se factura con nombre y cédula.
        { etiqueta: "RUC declarado", valor: facturacion?.ruc ?? "No declarado" },
        { etiqueta: "Producto", valor: `${NOMBRE_PRODUCTO} · Plan ${PLANES[plan.planId].nombre}` },
      ],
      operacion: [
        { etiqueta: "Propuesta", valor: codigoSolicitud(correlativo) },
        { etiqueta: "Referencia Bancard", valor: pago.referenciaBancard },
        { etiqueta: "Medio de pago", valor: medioLegible(pago.medio) },
        { etiqueta: "Fecha y hora del cobro", valor: formatearInstante(pago.confirmadoEn) },
        { etiqueta: "Estado", valor: "COBRO ACREDITADO" },
        { etiqueta: "Emitido por", valor: `${INTERSEGUROS.razonSocial} · ${INTERSEGUROS.actividad}` },
      ],
      desglose: [
        { etiqueta: "Prima neta", valor: formatearGuaranies(desglose.primaNetaGs) },
        { etiqueta: "IVA", valor: formatearGuaranies(desglose.ivaGs) },
        { etiqueta: "Premio total pagado", valor: formatearGuaranies(pago.montoGs) },
      ],
      leyendaDesgloseProvisional: LEYENDA_DESGLOSE_PROVISIONAL,
      consecuencias: [
        `Se emitió el Certificado de Cobertura Provisional ${certificadoCobertura.codigo}.`,
        `La cobertura comienza el ${formatearInstante(certificadoCobertura.inicioCobertura)} y rige hasta el ${formatearInstante(certificadoCobertura.finCobertura)}.`,
        `Se remitió la solicitud a ${ALIANZA.razonSocial} para la emisión de la póliza.`,
        `El certificado se puede verificar por su código ${codigoCertificado(correlativo)}.`,
      ],
      leyendaNoEsFactura: LEYENDA_NO_ES_FACTURA,
      leyendaSinDatosDeTarjeta: LEYENDA_SIN_DATOS_DE_TARJETA,
    },
  };
}
