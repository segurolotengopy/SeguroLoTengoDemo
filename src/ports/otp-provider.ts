/**
 * Puerto para los **tres** OTP del flujo: celular (WhatsApp), correo y firma.
 *
 * El de firma vivía en `SignatureProvider` mientras el acto de firma era de
 * un tercero. Desde que la firma del cliente es no cualificada y la genera
 * SeguroLoTengo (decisión del 26-ago-2026), el tercer OTP es nuestro y entra
 * acá, junto a los otros dos: mismo motor, misma política y misma evidencia.
 * Los tres siguen siendo criptográficamente distintos entre sí (regla de
 * negocio inviolable #1 de CLAUDE.md).
 *
 * Respaldo normativo del OTP de firma: **Resolución SS.SG. N.º 210/2025,
 * art. 4** (`docs/normativa/`), que admite la firma electrónica simple del
 * proponente siempre que esté respaldada por un mecanismo de autenticación
 * previo —OTP u otro medio técnicamente idóneo— que garantice la
 * identificación del firmante, el origen e integridad de sus datos y la
 * trazabilidad de la operación. El OTP no es un adorno del acto de firma: es
 * lo que lo vuelve oponible.
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

/** Canal por el que viaja el OTP. */
export type CanalOtp = "WHATSAPP" | "EMAIL";

/**
 * Para qué se emite el OTP. Los tres propósitos son actos distintos y un
 * código jamás sirve para otro (regla inviolable #1), aunque los tres
 * lleguen al mismo teléfono.
 *
 * - `VERIFICACION_CELULAR` — verifica que el número es de quien contrata.
 * - `VERIFICACION_CORREO` — lo mismo con la dirección de correo.
 * - `FIRMA` — manifiesta la voluntad de firmar la Solicitud y el FIPF. No
 *   verifica nada: firma. Por eso puede viajar por **cualquiera de los dos
 *   canales ya verificados**, el que la persona elija.
 */
export type PropositoOtp = "VERIFICACION_CELULAR" | "VERIFICACION_CORREO" | "FIRMA";

export interface DestinoOtp {
  /** Debe ser coherente con `proposito`: ver `canalCoherenteConProposito`. */
  readonly canal: CanalOtp;
  /** Número en formato E.164 o dirección de correo, según `canal`. */
  readonly valor: string;
}

/**
 * Un OTP de verificación solo puede ir por el canal que verifica —mandar el
 * código del celular a un correo no verificaría nada—, mientras que el de
 * firma admite los dos, porque para cuando se firma ambos canales ya fueron
 * verificados y la persona elige por cuál recibirlo.
 *
 * Vive en el puerto porque es un invariante de `SolicitudEnvioOtp`, no una
 * particularidad de un proveedor: todos los adaptadores lo hacen cumplir.
 */
export function canalCoherenteConProposito(proposito: PropositoOtp, canal: CanalOtp): boolean {
  switch (proposito) {
    case "VERIFICACION_CELULAR":
      return canal === "WHATSAPP";
    case "VERIFICACION_CORREO":
      return canal === "EMAIL";
    case "FIRMA":
      return true;
  }
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
