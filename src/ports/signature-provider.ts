/**
 * Puerto de firma electrónica (Code100), P8: inicia el acto de firma único
 * sobre la Solicitud y el FIPF ya cerrados y hasheados (regla de negocio
 * inviolable #4), envía el enlace al canal verificado elegido por el
 * cliente, y confirma el resultado.
 *
 * El OTP que Code100 usa dentro del acto de firma es el tercer OTP del
 * flujo (P8) — distinto y no reutilizable respecto de los OTP de celular
 * (P1) y correo (P4) de `OtpProvider` (regla de negocio inviolable #1).
 *
 * Regla de negocio inviolable #3 (atómica): esta interfaz no admite ningún
 * tipo de retorno que represente "un documento firmado y el otro no". La
 * rama exitosa de `confirmarResultado` trae una `Firma` completa —de
 * `src/domain/tipos.ts`, con `hashSolicitudFirmada` y `hashFipfFirmado`
 * como campos obligatorios, no opcionales— o el puerto reporta que no se
 * firmó nada. No existe un tercer estado intermedio representable a nivel
 * de tipos.
 */
import type { CanalFirma, Firma, PaqueteDocumental } from "../domain/tipos";

export interface IniciarFirmaInput {
  readonly expedienteId: string;
  /** Canal verificado elegido por el cliente en P8 (WhatsApp o correo). */
  readonly canal: CanalFirma;
  readonly destino: string;
  /** Debe corresponder a documentos ya cerrados y hasheados (regla #4); no hay firma sobre PDF abierto. */
  readonly paqueteDocumental: PaqueteDocumental;
}

export interface FirmaIniciada {
  readonly idCode100: string;
  readonly enlaceEnviadoEn: string; // ISO 8601
}

export type ResultadoFirma =
  | { readonly ok: true; readonly firma: Firma }
  | {
      readonly ok: false;
      readonly motivo: "RECHAZADA" | "EXPIRADA" | "CANCELADA" | "ERROR_PROVEEDOR";
      readonly detalle: string | null;
    };

export interface SignatureProvider {
  /** Envía el enlace único de firma para ambos documentos al canal elegido. */
  iniciarFirma(input: IniciarFirmaInput): Promise<FirmaIniciada>;

  /** Confirma el resultado del acto de firma iniciado con `idCode100`. Ver regla #3 sobre el tipo de retorno. */
  confirmarResultado(idCode100: string): Promise<ResultadoFirma>;
}
