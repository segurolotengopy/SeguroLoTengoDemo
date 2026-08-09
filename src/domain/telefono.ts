/**
 * Normalización y enmascarado del número de celular paraguayo (P1).
 *
 * El enmascarado sale de docs/ESPECIFICACION_PANTALLAS.md → P1: la leyenda
 * verde muestra `Código enviado al número +595 ••• ••• 000`, es decir prefijo
 * de país, dos grupos ocultos y los últimos tres dígitos. Ese es el formato
 * que va a la UI y a la evidencia (regla inviolable #10: "número
 * enmascarado"), nunca el número completo.
 *
 * Funciones puras, sin dependencias: la validación tiene que ser idéntica en
 * el cliente (para habilitar el botón) y en el servidor (que es el que
 * manda).
 */

/** Único país habilitado en P1: Paraguay. */
export const PREFIJO_PAIS_PARAGUAY = "+595";

/**
 * Celular paraguayo: 9 dígitos que empiezan con 9 (p.ej. 981 000 000, el
 * ejemplo del placeholder de la especificación). Se tolera el 0 inicial que
 * la gente escribe por costumbre (0981...) y cualquier separador.
 */
const LARGO_NUMERO_LOCAL = 9;

export type ResultadoNormalizacion =
  | { readonly ok: true; readonly e164: string }
  | { readonly ok: false; readonly motivo: "FORMATO_INVALIDO" };

/**
 * Devuelve el número en E.164 (`+595981000000`) a partir de lo que se tipeó
 * en el campo local. No acepta números de otros países: P1 solo ofrece el
 * selector de Paraguay.
 */
export function normalizarCelularParaguayo(entrada: string): ResultadoNormalizacion {
  const soloDigitos = entrada.replace(/\D/g, "");

  const sinPrefijoPais = soloDigitos.startsWith("595") ? soloDigitos.slice(3) : soloDigitos;
  const local = sinPrefijoPais.startsWith("0") ? sinPrefijoPais.slice(1) : sinPrefijoPais;

  if (local.length !== LARGO_NUMERO_LOCAL || !local.startsWith("9")) {
    return { ok: false, motivo: "FORMATO_INVALIDO" };
  }

  return { ok: true, e164: `${PREFIJO_PAIS_PARAGUAY}${local}` };
}

/**
 * `+595981000123` → `+595 ••• ••• 123`. Es la única representación del
 * número que puede salir hacia la UI, la evidencia o cualquier registro.
 */
export function enmascararCelular(e164: string): string {
  const ultimos = e164.slice(-3);
  return `${PREFIJO_PAIS_PARAGUAY} ••• ••• ${ultimos}`;
}
