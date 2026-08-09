/**
 * Normalización y enmascarado del correo electrónico (P4).
 *
 * El enmascarado sale de docs/ESPECIFICACION_PANTALLAS.md → P4: la leyenda
 * muestra `Código enviado a m••••••@correo.com`, es decir la primera letra
 * del buzón, viñetas y el dominio completo. Ese es el formato que va a la UI
 * y a la evidencia, nunca la dirección completa.
 *
 * Funciones puras, sin dependencias: la validación tiene que ser idéntica en
 * el cliente (para habilitar el botón) y en el servidor (que es el que
 * manda), igual que en `telefono.ts`.
 */

/**
 * Validación deliberadamente conservadora: un buzón sin espacios ni arrobas,
 * una arroba, y un dominio con al menos un punto y una extensión de dos
 * letras o más. No intenta implementar RFC 5322 —nadie lo hace bien— porque
 * la prueba real de que la dirección existe y es de la persona es el OTP que
 * llega a ella, no esta expresión regular.
 */
const FORMATO_CORREO = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;

/** Cota defensiva: la dirección termina en la base y en la evidencia. */
const LARGO_MAXIMO_CORREO = 254;

export type ResultadoNormalizacionCorreo =
  | { readonly ok: true; readonly correo: string }
  | { readonly ok: false; readonly motivo: "FORMATO_INVALIDO" };

/**
 * Devuelve la dirección normalizada (sin espacios alrededor y en
 * minúsculas). El buzón es técnicamente sensible a mayúsculas según el RFC,
 * pero ningún proveedor de correo de uso masivo lo trata así, y normalizar
 * evita que la misma persona quede con dos expedientes por haber tipeado
 * `Ana@` una vez y `ana@` la otra.
 */
export function normalizarCorreo(entrada: string): ResultadoNormalizacionCorreo {
  const limpio = entrada.trim().toLowerCase();

  if (limpio.length === 0 || limpio.length > LARGO_MAXIMO_CORREO || !FORMATO_CORREO.test(limpio)) {
    return { ok: false, motivo: "FORMATO_INVALIDO" };
  }

  return { ok: true, correo: limpio };
}

/**
 * `monica.gorena@example.com` → `m••••••@example.com`. Es la única
 * representación del correo que puede salir hacia la UI, la evidencia o
 * cualquier registro.
 *
 * La cantidad de viñetas es fija (la que muestra la especificación) y no
 * sigue al largo real del buzón: si lo siguiera, la máscara filtraría cuántos
 * caracteres tiene la dirección.
 */
const VINIETAS = "••••••";

export function enmascararCorreo(correo: string): string {
  const arroba = correo.lastIndexOf("@");
  if (arroba <= 0) return VINIETAS;

  const inicial = correo.slice(0, 1);
  const dominio = correo.slice(arroba);
  return `${inicial}${VINIETAS}${dominio}`;
}
