/**
 * Generación y hasheo de códigos OTP, con pepper (regla de negocio
 * inviolable #2 de CLAUDE.md: solo el hash del OTP se persiste, nunca el
 * código en claro — ni en base, ni en logs, ni en respuestas de API).
 *
 * Sin import del SDK de AWS: usa únicamente `node:crypto`. El pepper en sí
 * se obtiene de Secrets Manager en `secrets-client.ts`; este módulo solo
 * sabe hashear, no de dónde sale el pepper.
 *
 * Se usa HMAC-SHA256 (pepper como clave) en vez de un hash simple de
 * `pepper + código` — es la construcción estándar para un secreto de
 * aplicación combinado con un valor de baja entropía (6 dígitos): evita
 * ataques de extensión de longitud y ata criptográficamente el hash a la
 * clave, no solo a la concatenación de strings.
 */
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

const LONGITUD_CODIGO = 6;

/** Código numérico de 6 dígitos (con ceros a la izquierda), uniforme vía `crypto.randomInt`. */
export function generarCodigoOtp(): string {
  const valor = randomInt(0, 10 ** LONGITUD_CODIGO);
  return valor.toString().padStart(LONGITUD_CODIGO, "0");
}

/** HMAC-SHA256(pepper, código), en hexadecimal. Es lo único que se persiste. */
export function hashOtpConPepper(codigo: string, pepper: string): string {
  return createHmac("sha256", pepper).update(codigo, "utf8").digest("hex");
}

/**
 * Compara un código ingresado contra el hash persistido, sin recrear el
 * problema de leak de timing de un `===` sobre strings derivadas de un
 * secreto: usa `timingSafeEqual` sobre los buffers del hash calculado y el
 * persistido (nunca sobre el código en claro, que ya no existe en este
 * punto — el proponente solo entrega el código ingresado).
 */
export function codigoCoincideConHash(codigoIngresado: string, hashPersistido: string, pepper: string): boolean {
  const hashIngresado = hashOtpConPepper(codigoIngresado, pepper);
  const bufferIngresado = Buffer.from(hashIngresado, "hex");
  const bufferPersistido = Buffer.from(hashPersistido, "hex");
  if (bufferIngresado.length !== bufferPersistido.length) return false;
  return timingSafeEqual(bufferIngresado, bufferPersistido);
}
