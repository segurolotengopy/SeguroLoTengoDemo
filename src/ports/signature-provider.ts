/**
 * Puerto de firma electrónica (Code100): inicia el acto de firma único sobre
 * el documento ya cerrado y hasheado (regla de negocio inviolable #4), envía
 * el enlace al canal verificado elegido por el cliente, y confirma el
 * resultado.
 *
 * El OTP que Code100 usa dentro del acto de firma es el del acto de firma —
 * distinto y no reutilizable respecto del OTP de celular de `OtpProvider`
 * (regla de negocio inviolable #1).
 * **Vive del lado del proveedor**: la persona lo tipea en la pantalla de
 * Code100, no en SeguroLoTengo, así que no hay ningún método de esta
 * interfaz que lo reciba ni lo devuelva. Un adaptador mock que necesite
 * mostrarlo en el panel de demo lo hace por un canal aparte, igual que
 * `OtpProvider` (regla inviolable #2).
 *
 * Regla de negocio inviolable #3 (atómica): **ya no hace falta defenderla
 * acá**. Este puerto recibía un `PaqueteDocumental` de dos documentos y su
 * trabajo era no admitir ningún retorno que representara "uno firmado y el
 * otro no". Con el documento único (D-11) hay un archivo y una huella: la
 * Solicitud y el FIPF son secciones del mismo PDF y no existe la operación
 * que podría separarlas. La regla pasó de ser una restricción de tipos a ser
 * una propiedad de la estructura, que es más fuerte.
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
import type { CanalFirma, DocumentoCerrado, Firma } from "../domain/tipos";

export interface IniciarFirmaInput {
  readonly expedienteId: string;
  /** Canal verificado elegido por el cliente en P8 (WhatsApp o correo). */
  readonly canal: CanalFirma;
  readonly destino: string;
  /** Debe corresponder a un documento ya cerrado y hasheado (regla #4); no hay firma sobre PDF abierto. */
  readonly documento: DocumentoCerrado;
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
 * Los tres estados son mutuamente excluyentes: `PENDIENTE` no expone ningún
 * hash firmado, `FIRMADO` trae la `Firma` con la huella del documento, y
 * `NO_FIRMADO` no tiene dónde ponerla.
 */
export type ResultadoFirma =
  | {
      readonly estado: "PENDIENTE";
      readonly enlaceEnviadoEn: string;
      readonly venceEn: string;
      /** `true` cuando la persona ya abrió el enlace y Code100 le pidió el OTP de firma. */
      readonly enlaceAbierto: boolean;
      /**
       * Caducidad de la sesión **según el proveedor**, no según nuestro reloj.
       *
       * `POST /signature/getSessionId` devuelve `fecha_expiracion` y
       * `expirado`, y no documenta una duración fija: en el ejemplo de Code100
       * una sesión creada 14-ene 17:10 UTC expira 15-ene 14:12, unas 21 horas.
       * Por eso no se la deduce restando de `venceEn` —eso sería hardcodear su
       * política— sino que se la lee (D-10).
       *
       * Es un hecho distinto del plazo de 24 h del expediente, que es nuestro:
       * la sesión puede caducar antes sin que el expediente venza, y entonces
       * lo que corresponde es pedir un enlace nuevo, no dar por perdido el
       * trámite.
       */
      readonly expirada: boolean;
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

export interface SignatureProvider {
  /**
   * Envía el enlace de firma al canal elegido (fila 36 de la matriz: un mismo
   * enlace Code100 para la Solicitud y el FIPF, que ahora son secciones del
   * mismo PDF). Lanza `ErrorCode100` si el proveedor no acepta el documento.
   */
  iniciarFirma(input: IniciarFirmaInput): Promise<FirmaIniciada>;

  /**
   * Baja el PDF firmado de un acto ya completado, para archivarlo y ponerlo a
   * descargar en P9. `null` si el acto todavía no se firmó o no existe.
   *
   * Va aparte de `confirmarResultado` a propósito: el sondeo de la pantalla de
   * firma corre cada dos segundos y no tiene por qué arrastrar un PDF en cada
   * vuelta. Es el mismo reparto que hace Code100 entre `getSessionId` (estado)
   * y `sign-pdf` (el archivo).
   */
  descargarDocumentoFirmado(idCode100: string): Promise<Uint8Array | null>;

  /**
   * Estado del acto de firma iniciado con `idCode100`. Es el método que
   * sondea P8 mientras muestra `Esperando confirmación verificable de
   * Code100`, y el que va a atender el callback del adaptador oficial.
   * Idempotente: consultarlo no cambia nada del lado del proveedor.
   */
  confirmarResultado(idCode100: string): Promise<ResultadoFirma>;
}
