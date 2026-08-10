/**
 * Puerto de firma electrónica (Code100), P8: inicia el acto de firma único
 * sobre la Solicitud y el FIPF ya cerrados y hasheados (regla de negocio
 * inviolable #4), envía el enlace al canal verificado elegido por el
 * cliente, y confirma el resultado.
 *
 * El OTP que Code100 usa dentro del acto de firma es el tercer OTP del
 * flujo (P8) — distinto y no reutilizable respecto de los OTP de celular
 * (P1) y correo (P4) de `OtpProvider` (regla de negocio inviolable #1).
 * **Vive del lado del proveedor**: la persona lo tipea en la pantalla de
 * Code100, no en SeguroLoTengo, así que no hay ningún método de esta
 * interfaz que lo reciba ni lo devuelva. Un adaptador mock que necesite
 * mostrarlo en el panel de demo lo hace por un canal aparte, igual que
 * `OtpProvider` (regla inviolable #2).
 *
 * Regla de negocio inviolable #3 (atómica): esta interfaz no admite ningún
 * tipo de retorno que represente "un documento firmado y el otro no". La
 * rama `FIRMADO` de `confirmarResultado` trae una `Firma` completa —de
 * `src/domain/tipos.ts`, con `hashSolicitudFirmada` y `hashFipfFirmado`
 * como campos obligatorios, no opcionales— o el puerto reporta que no se
 * firmó nada. No existe un tercer estado intermedio representable a nivel
 * de tipos.
 *
 * Respaldo normativo (`docs/Tabla Cumplimiento SeguroLo Tengo - Tabla.csv`,
 * categoría "R4 - FIRMA ELECTRÓNICA MEDIANTE CODE100"): fila 34 (el cliente
 * firma la Solicitud y el FIPF, Ley 6822/21, arts. 38(1), 42(5) y 67-69;
 * Res. SS SG. 215/15, anexo 1, numeral 11.15), fila 36 (un mismo enlace para
 * los dos documentos), fila 41 (vigencia de 24 horas del enlace) y fila 42
 * (conservar identidad, OTP, IP, fecha, hora, hash y resultado, Ley 6822/21,
 * arts. 42(5), 66 y 68(3)).
 *
 * Contrato técnico del adaptador oficial:
 * `docs/Integraciones/Documentacion Firmador - API FLOW.pdf`.
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
  /** Vigencia del enlace de firma: 24 horas (fila 41 de la matriz). */
  readonly venceEn: string; // ISO 8601
  /**
   * Enlace que Code100 le manda a la persona por el canal elegido (el
   * `_authUrl` de `GET /signature/session-start`). SeguroLoTengo lo registra
   * como evidencia; no lo abre por su cuenta.
   */
  readonly urlActoDeFirma: string;
}

export type MotivoNoFirmado = "RECHAZADA" | "EXPIRADA" | "CANCELADA" | "ERROR_PROVEEDOR";

/**
 * Estado del acto de firma, tal como lo reporta `POST /signature/getSessionId`.
 *
 * Los tres estados son mutuamente excluyentes y ninguno de ellos puede
 * describir una firma a medias: `PENDIENTE` no expone ningún hash firmado,
 * `FIRMADO` los exige a los dos dentro de una `Firma`, y `NO_FIRMADO` no
 * tiene dónde ponerlos (regla inviolable #3).
 */
export type ResultadoFirma =
  | {
      readonly estado: "PENDIENTE";
      readonly enlaceEnviadoEn: string;
      readonly venceEn: string;
      /** `true` cuando la persona ya abrió el enlace y Code100 le pidió el OTP de firma. */
      readonly enlaceAbierto: boolean;
    }
  | { readonly estado: "FIRMADO"; readonly firma: Firma }
  | {
      readonly estado: "NO_FIRMADO";
      readonly motivo: MotivoNoFirmado;
      readonly detalle: string | null;
    };

/**
 * Falla del proveedor al iniciar el acto de firma. Gemelo de `ErrorBancard`:
 * distingue "Code100 contestó que no" de "Code100 no contestó", que es la
 * diferencia entre reintentar y avisar.
 */
export class ErrorCode100 extends Error {
  constructor(
    readonly motivo: "TIMEOUT" | "RECHAZADA" | "PAQUETE_INVALIDO",
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorCode100";
  }
}

/**
 * Los dos PDF firmados que devuelve `POST /signature/sign-pdf`
 * (`documents_signeds` en la documentación de Code100).
 *
 * Regla inviolable #3, otra vez: **los dos o ninguno**. No hay campos
 * opcionales, así que no existe forma de recibir la Solicitud firmada sin el
 * FIPF. Y sus huellas tienen que coincidir con las de la `Firma` que devolvió
 * `confirmarResultado`: son los mismos archivos.
 */
export interface DocumentosFirmados {
  readonly solicitud: Uint8Array;
  readonly fipf: Uint8Array;
}

export interface SignatureProvider {
  /**
   * Envía el enlace único de firma para **ambos** documentos al canal
   * elegido (fila 36 de la matriz: un mismo enlace Code100 para la Solicitud
   * y el FIPF). Lanza `ErrorCode100` si el proveedor no acepta el paquete.
   */
  iniciarFirma(input: IniciarFirmaInput): Promise<FirmaIniciada>;

  /**
   * Baja los dos PDF firmados de un acto ya completado, para archivarlos y
   * ponerlos a descargar en P9. `null` si el acto todavía no se firmó o no
   * existe — nunca uno solo.
   *
   * Va aparte de `confirmarResultado` a propósito: el sondeo de P8 corre cada
   * dos segundos y no tiene por qué arrastrar dos PDF en cada vuelta. Es el
   * mismo reparto que hace Code100 entre `getSessionId` (estado) y `sign-pdf`
   * (los archivos).
   */
  descargarDocumentosFirmados(idCode100: string): Promise<DocumentosFirmados | null>;

  /**
   * Estado del acto de firma iniciado con `idCode100`. Es el método que
   * sondea P8 mientras muestra `Esperando confirmación verificable de
   * Code100`, y el que va a atender el callback del adaptador oficial.
   * Idempotente: consultarlo no cambia nada del lado del proveedor.
   */
  confirmarResultado(idCode100: string): Promise<ResultadoFirma>;
}
