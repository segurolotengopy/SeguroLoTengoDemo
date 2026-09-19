/**
 * Puerto de emisión de póliza (SEBAOT), posterior a P8: recibe el
 * expediente aprobado, el código Bancard y los documentos firmados, y emite
 * la póliza con el número de la propuesta (no se genera Nota de Cobertura,
 * ver P8 y P9). Expone también el estado de la facturación electrónica:
 * Alianza la emite, SeguroLoTengo solo recibe estado/referencia.
 *
 * ## ⚠️ La operación real no contesta (aviso de Alianza, 18-sep-2026)
 *
 * Este puerto modela una integración que responde, y la operación que Alianza
 * describió es otra: **las solicitudes de emisión llegan por correo**, en
 * archivos TXT dentro de un ZIP con contraseña, y **las procesa una persona a
 * mano en SEBAOT**. No hay SFTP para esto, no hay acuse y no hay a quién
 * consultarle un estado. Alianza no sabe cuánto tiempo va a funcionar así.
 *
 * **Solo cambia de canal el lote de pólizas** (D-49). El Certificado de
 * Cobertura sigue yendo y volviendo por el conector SFTP, que es otro camino y
 * otro puerto (`IntercambioAseguradora`).
 *
 * Lo que eso implica para el adaptador oficial, cuando se escriba:
 *
 * - `emitirPoliza` solo puede significar **«se remitió»**, con fecha y
 *   destinatario. Nunca «emitida», y nunca un número de póliza devuelto.
 * - `consultarEstadoPoliza` y `consultarEstadoFacturaElectronica` **no tienen
 *   implementación posible** por ese canal: el estado real entra a mano por la
 *   consola administrativa.
 * - El envío es **un lote diario** (respuesta A4.3), no una llamada por caso.
 *
 * El puerto **no se reescribe todavía**: el adaptador live no existe, el mock
 * sirve para el demo, y el formato del TXT sigue sin definir (SEBAOT). Esta
 * nota está para que nadie construya encima de la premisa de que hay
 * respuesta. Análisis en `docs/ANALISIS_RESPUESTAS_ALIANZA.md` §10.
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
