/**
 * Caso de uso de P4 · Verificación de correo
 * (docs/ESPECIFICACION_PANTALLAS.md → "P4 · Paso 4 de 9 — Verificación de
 * correo": *"Estructura idéntica a P1 pero para correo electrónico"*).
 *
 * Reutiliza el mismo motor que P1 (`verificacion-canal.ts`): vigencia,
 * intentos, uso único, cooldown, transición y evidencia son exactamente el
 * mismo código. Lo único propio de P4 es esta configuración.
 *
 * Diferencias con P1:
 *   - Propósito `VERIFICACION_CORREO` y canal `EMAIL`. La especificación es
 *     explícita: *"este código es diferente al de WhatsApp"*, y lo es porque
 *     el repositorio genera un código nuevo por cada `crear`. Además el motor
 *     rechaza verificar un OTP cuyo propósito no sea este, así que los dos
 *     códigos no son intercambiables (regla inviolable #1). Ver
 *     `__tests__/otp-independientes.test.ts`.
 *   - Va de AUTORIZADO a CANAL_EMAIL_VERIFICADO: el expediente ya existe, y
 *     esta pantalla no puede crear uno.
 *   - No tiene checkbox: el consentimiento de tratamiento de datos ya se tomó
 *     en P3, y la especificación de P4 no agrega ninguna aceptación nueva.
 */
import { normalizarCorreo, enmascararCorreo } from "./correo";
import {
  enviarOtpDeCanal,
  reenviarOtpDeCanal,
  verificarOtpDeCanal,
} from "./verificacion-canal";
import type {
  ConfiguracionCanal,
  DependenciasVerificacionCanal,
  EntradaEnvioCanal,
  EntradaReenvioCanal,
  EntradaVerificacionCanal,
  ResultadoEnvioCanal,
  ResultadoVerificacionCanal,
} from "./verificacion-canal";

export type DependenciasP4 = DependenciasVerificacionCanal;

export const PASO_EVIDENCIA_ENVIO_CORREO = "P4_OTP_CORREO_ENVIO";
export const PASO_EVIDENCIA_REENVIO_CORREO = "P4_OTP_CORREO_REENVIO";
export const PASO_EVIDENCIA_VERIFICACION_CORREO = "P4_OTP_CORREO_VERIFICACION";

export const CANAL_CORREO_P4: ConfiguracionCanal = {
  proposito: "VERIFICACION_CORREO",
  canal: "EMAIL",
  estadoRequerido: "AUTORIZADO",
  estadoDestino: "CANAL_EMAIL_VERIFICADO",
  campoCanal: "canalEmail",
  normalizar: (entrada) => {
    const resultado = normalizarCorreo(entrada);
    return resultado.ok ? { ok: true, valor: resultado.correo } : { ok: false };
  },
  enmascarar: enmascararCorreo,
  pasosEvidencia: {
    envio: PASO_EVIDENCIA_ENVIO_CORREO,
    reenvio: PASO_EVIDENCIA_REENVIO_CORREO,
    verificacion: PASO_EVIDENCIA_VERIFICACION_CORREO,
  },
  // P4 no pide aceptar ningún literal nuevo.
  versionTextoAceptado: null,
  requiereAutorizacion: false,
  creaExpediente: false,
};

export interface EntradaEnvioP4
  extends Omit<EntradaEnvioCanal, "destinoIngresado" | "autorizacionAceptada"> {
  readonly correoIngresado: string;
}

/** Paso 1 de P4: valida el correo y dispara el envío del OTP. */
export async function enviarOtpCorreo(
  deps: DependenciasP4,
  entrada: EntradaEnvioP4,
): Promise<ResultadoEnvioCanal> {
  return enviarOtpDeCanal(CANAL_CORREO_P4, deps, {
    ...entrada,
    destinoIngresado: entrada.correoIngresado,
    // La configuración no lo exige; se pasa para satisfacer la forma común.
    autorizacionAceptada: true,
  });
}

/** Enlace `Reenviar código` de P4. Sujeto al bloqueo de 60 segundos. */
export async function reenviarOtpCorreo(
  deps: DependenciasP4,
  entrada: EntradaReenvioCanal,
): Promise<ResultadoEnvioCanal> {
  return reenviarOtpDeCanal(CANAL_CORREO_P4, deps, entrada);
}

/**
 * Paso 2 de P4: verifica el código y, solo si es correcto, transiciona el
 * expediente a CANAL_EMAIL_VERIFICADO registrando como canal verificado la
 * misma dirección a la que se envió el código.
 */
export async function verificarOtpCorreo(
  deps: DependenciasP4,
  entrada: EntradaVerificacionCanal,
): Promise<ResultadoVerificacionCanal> {
  return verificarOtpDeCanal(CANAL_CORREO_P4, deps, entrada);
}
