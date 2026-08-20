/**
 * Puerto de emisión de póliza (SEBAOT), posterior a P8: recibe el
 * expediente aprobado, el código Bancard y los documentos firmados, y emite
 * la póliza con el número de la propuesta (no se genera Nota de Cobertura,
 * ver P8 y P9). Expone también el estado de la facturación electrónica:
 * Alianza la emite, SeguroLoTengo solo recibe estado/referencia.
 *
 * `emitirPoliza` exige `firma: Firma` completa (de `src/domain/tipos.ts`,
 * con ambos hashes firmados obligatorios) — regla de negocio inviolable #3:
 * no hay forma de invocar este puerto con documentos parcialmente firmados.
 */
import type { Firma, DocumentoCerrado } from "../domain/tipos";

export interface EmitirPolizaInput {
  readonly expedienteId: string;
  /** Correlativo de la propuesta (p.ej. PROP-00018425); la póliza lo reutiliza como número de póliza. */
  readonly propuestaId: string;
  readonly referenciaBancard: string;
  /** El documento único, cerrado y firmado (D-11). */
  readonly documento: DocumentoCerrado;
  readonly firma: Firma;
}

export type EstadoPoliza = "EN_PROCESO_DE_EMISION" | "EMITIDA" | "RECHAZADA";

export interface ResultadoEmisionPoliza {
  /** Igual al correlativo de la propuesta; SEBAOT no genera un número distinto. */
  readonly numeroPoliza: string;
  readonly estado: EstadoPoliza;
  readonly emitidaEn: string | null; // ISO 8601
}

export type EstadoFacturaElectronica = "PENDIENTE" | "EMITIDA" | "RECHAZADA";

export interface ResultadoFacturaElectronica {
  readonly referencia: string | null;
  readonly estado: EstadoFacturaElectronica;
}

export interface PolicyIssuer {
  emitirPoliza(input: EmitirPolizaInput): Promise<ResultadoEmisionPoliza>;

  consultarEstadoPoliza(numeroPoliza: string): Promise<ResultadoEmisionPoliza>;

  /** Alianza emite la factura a nombre del asegurado; SeguroLoTengo solo recibe estado/referencia. */
  consultarEstadoFacturaElectronica(numeroPoliza: string): Promise<ResultadoFacturaElectronica>;
}
