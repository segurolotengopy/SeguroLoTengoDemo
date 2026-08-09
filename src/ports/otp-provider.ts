/**
 * Puerto para los OTP de canal: celular (P1 · WhatsApp) y correo (P4).
 *
 * El OTP de firma (P8) NO vive acá — es parte del acto de firma de Code100
 * y se modela en `SignatureProvider`. Los tres OTP del flujo (celular,
 * correo y firma) son criptográficamente distintos entre sí (regla de
 * negocio inviolable #1 de CLAUDE.md).
 *
 * Reglas que esta interfaz modela (regla inviolable #1): 6 dígitos, uso
 * único, vigencia 5 minutos, máximo 3 intentos, reenvío bloqueado 60
 * segundos.
 *
 * La interfaz es agnóstica de si el proveedor real (Infobip 2FA) genera y
 * valida el código él mismo, o si SeguroLoTengo genera el código y el
 * proveedor solo entrega el mensaje — ambos casos se modelan con los mismos
 * tres métodos (enviar, verificar, reenviar).
 *
 * Regla inviolable #2: ningún tipo de retorno de esta interfaz expone el
 * código en texto plano, ni siquiera para debug. Solo el hash del OTP se
 * persiste. Un adaptador mock que necesite mostrar el código en el panel de
 * demo debe hacerlo por un canal aparte, fuera de esta interfaz.
 */

/** Canal por el que se envía el OTP de verificación de canal (no de firma). */
export type CanalOtp = "WHATSAPP" | "EMAIL";

/** A qué verificación de canal corresponde el OTP: P1 (celular) o P4 (correo). */
export type PropositoOtp = "VERIFICACION_CELULAR" | "VERIFICACION_CORREO";

export interface DestinoOtp {
  /** Debe ser coherente con `proposito` (WHATSAPP → VERIFICACION_CELULAR, EMAIL → VERIFICACION_CORREO). */
  readonly canal: CanalOtp;
  /** Número en formato E.164 o dirección de correo, según `canal`. */
  readonly valor: string;
}

export interface SolicitudEnvioOtp {
  readonly expedienteId: string;
  readonly proposito: PropositoOtp;
  readonly destino: DestinoOtp;
}

export type ResultadoEnvioOtp =
  | {
      readonly ok: true;
      /** Identificador opaco de esta transacción de OTP, no el código. */
      readonly otpId: string;
      readonly expiraEn: string; // ISO 8601, envío + 5 minutos
      /** Referencia de entrega del proveedor (para trazabilidad en EvidenceStore), nunca el código. */
      readonly referenciaEnvio: string;
    }
  | { readonly ok: false; readonly motivo: "REENVIO_BLOQUEADO"; readonly segundosRestantes: number }
  | { readonly ok: false; readonly motivo: "ERROR_ENVIO"; readonly detalle: string };

export interface SolicitudVerificacionOtp {
  readonly otpId: string;
  readonly codigoIngresado: string;
}

export type ResultadoVerificacionOtp =
  | { readonly ok: true }
  | { readonly ok: false; readonly motivo: "CODIGO_INCORRECTO"; readonly intentosRestantes: number }
  | { readonly ok: false; readonly motivo: "INTENTOS_AGOTADOS" }
  | { readonly ok: false; readonly motivo: "EXPIRADO" }
  | { readonly ok: false; readonly motivo: "YA_UTILIZADO" }
  | { readonly ok: false; readonly motivo: "NO_ENCONTRADO" };

export interface OtpProvider {
  /** Genera (si corresponde) y envía un OTP nuevo. Persiste solo su hash. */
  enviarOtp(solicitud: SolicitudEnvioOtp): Promise<ResultadoEnvioOtp>;

  /**
   * Verifica el código ingresado contra el OTP identificado por `otpId`.
   * Un OTP verificado con éxito queda consumido: no puede reutilizarse
   * (regla inviolable #1, uso único).
   */
  verificarOtp(solicitud: SolicitudVerificacionOtp): Promise<ResultadoVerificacionOtp>;

  /**
   * Reenvía el OTP asociado a una transacción previa. Sujeto al bloqueo de
   * 60 segundos desde el último envío (regla inviolable #1).
   */
  reenviarOtp(otpId: string): Promise<ResultadoEnvioOtp>;
}
