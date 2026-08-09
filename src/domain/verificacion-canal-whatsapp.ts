/**
 * Caso de uso de P1 · Verificación de WhatsApp
 * (docs/ESPECIFICACION_PANTALLAS.md → "P1 · Paso 1 de 9").
 *
 * La mecánica —validar el destino, cooldown de reenvío, atadura entre el
 * canal que recibió el código y el que queda verificado, transición del
 * expediente y escritura de evidencia— vive en `verificacion-canal.ts`,
 * compartida con P4. Este módulo es solo la configuración de P1: qué
 * propósito, qué canal, entre qué estados y con qué literal.
 *
 * Lo propio de P1 respecto de P4:
 *   - Es la pantalla donde **nace** el expediente (P0 es informativa).
 *   - Tiene un checkbox obligatorio de autorización de canal.
 *   - El destino es un celular paraguayo, no un correo.
 */
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
import { enmascararCelular, normalizarCelularParaguayo } from "./telefono";
// Los literales viven aparte (`textos-p1.ts`) para que la pantalla pueda
// mostrarlos sin importar este módulo de servidor. Se re-exportan porque la
// evidencia de este paso los usa y quien lea el caso de uso los espera acá.
import { TEXTO_AUTORIZACION_P1, VERSION_TEXTO_AUTORIZACION_P1 } from "./textos-p1";

export { TEXTO_AUTORIZACION_P1, VERSION_TEXTO_AUTORIZACION_P1 };

/**
 * Tipos compartidos con el resto de la app. Viven en `verificacion-canal.ts`
 * (los usan P1, P2, P3 y P4) y se re-exportan acá porque este módulo fue su
 * lugar original.
 */
export type {
  ContextoPeticion,
  DependenciasVerificacionCanal,
  LectorMetadataOtp,
  MotivoRechazoEnvio,
  MotivoRechazoVerificacion,
  RegistroOtpMinimo,
  RepositorioExpediente,
  ResultadoEnvioCanal,
  ResultadoVerificacionCanal,
} from "./verificacion-canal";

/** Alias histórico: las dependencias de P1 son las del motor de canal. */
export type DependenciasP1 = DependenciasVerificacionCanal;

export const PASO_EVIDENCIA_ENVIO = "P1_OTP_WHATSAPP_ENVIO";
export const PASO_EVIDENCIA_REENVIO = "P1_OTP_WHATSAPP_REENVIO";
export const PASO_EVIDENCIA_VERIFICACION = "P1_OTP_WHATSAPP_VERIFICACION";

export const CANAL_WHATSAPP_P1: ConfiguracionCanal = {
  proposito: "VERIFICACION_CELULAR",
  canal: "WHATSAPP",
  estadoRequerido: "INICIADO",
  estadoDestino: "CANAL_WA_VERIFICADO",
  campoCanal: "canalWhatsapp",
  normalizar: (entrada) => {
    const resultado = normalizarCelularParaguayo(entrada);
    return resultado.ok ? { ok: true, valor: resultado.e164 } : { ok: false };
  },
  enmascarar: enmascararCelular,
  pasosEvidencia: {
    envio: PASO_EVIDENCIA_ENVIO,
    reenvio: PASO_EVIDENCIA_REENVIO,
    verificacion: PASO_EVIDENCIA_VERIFICACION,
  },
  versionTextoAceptado: VERSION_TEXTO_AUTORIZACION_P1,
  requiereAutorizacion: true,
  creaExpediente: true,
};

export interface EntradaEnvioP1 extends Omit<EntradaEnvioCanal, "destinoIngresado"> {
  readonly numeroIngresado: string;
}

/**
 * Paso 1 de P1: valida el número y la autorización, crea el expediente si
 * hace falta y dispara el envío del OTP de canal.
 */
export async function enviarOtpWhatsapp(
  deps: DependenciasP1,
  entrada: EntradaEnvioP1,
): Promise<ResultadoEnvioCanal> {
  return enviarOtpDeCanal(CANAL_WHATSAPP_P1, deps, {
    ...entrada,
    destinoIngresado: entrada.numeroIngresado,
  });
}

/** Enlace `Reenviar código` de P1. Sujeto al bloqueo de 60 segundos. */
export async function reenviarOtpWhatsapp(
  deps: DependenciasP1,
  entrada: EntradaReenvioCanal,
): Promise<ResultadoEnvioCanal> {
  return reenviarOtpDeCanal(CANAL_WHATSAPP_P1, deps, entrada);
}

/**
 * Paso 2 de P1: verifica el código y, solo si es correcto, transiciona el
 * expediente a CANAL_WA_VERIFICADO registrando como canal verificado el
 * mismo número al que se envió el código.
 */
export async function verificarOtpWhatsapp(
  deps: DependenciasP1,
  entrada: EntradaVerificacionCanal,
): Promise<ResultadoVerificacionCanal> {
  return verificarOtpDeCanal(CANAL_WHATSAPP_P1, deps, entrada);
}
