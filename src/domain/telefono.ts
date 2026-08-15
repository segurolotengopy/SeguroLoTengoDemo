/**
 * Normalización y enmascarado del número de celular de P1.
 *
 * Desde el 2026-08-14 el selector de país de P1 ofrece los países de la
 * región (decisión de producto para el demo — pruebas con celulares de
 * Bolivia y vecinos; la versión original de docs/ESPECIFICACION_PANTALLAS.md
 * contemplaba solo Paraguay, y la sección de P1 quedó anotada con este
 * cambio). Dos niveles de validación:
 *
 *   - **Paraguay y Bolivia**: regla estricta del plan de numeración móvil.
 *     Son los dos países cuyos prefijos acepta hoy WhatsApp-Modular para el
 *     envío real (`ALLOWED_COUNTRY_PREFIXES = 595, 591`).
 *   - **Resto de la región**: validación básica de largo (7 a 11 dígitos).
 *     En modo mock funcionan completos; para envío real habría que ampliar
 *     la lista de prefijos de WhatsApp-Modular (decisión de negocio de ese
 *     repo, con costo por país).
 *
 * El enmascarado sale de docs/ESPECIFICACION_PANTALLAS.md → P1: prefijo de
 * país, dos grupos ocultos y los últimos tres dígitos
 * (`+595 ••• ••• 000`). Ese es el formato que va a la UI y a la evidencia
 * (regla inviolable #10), nunca el número completo.
 *
 * Funciones puras, sin dependencias: la validación tiene que ser idéntica en
 * el cliente (para habilitar el botón) y en el servidor (que es el que
 * manda).
 */

/** Prefijo histórico. Se conserva exportado porque P1 lo usaba como único país. */
export const PREFIJO_PAIS_PARAGUAY = "+595";

export interface PaisCelular {
  /** Código ISO 3166-1 alfa-2, valor del selector de P1. */
  readonly iso: string;
  readonly nombre: string;
  /** Prefijo E.164 con `+`. */
  readonly prefijo: string;
  /** Ejemplo de número local para el placeholder del campo. */
  readonly ejemplo: string;
}

/**
 * Países habilitados en P1. Paraguay primero (default del selector), Bolivia
 * segundo (único otro país con envío real hoy), el resto alfabético.
 */
export const PAISES_CELULAR: readonly PaisCelular[] = [
  { iso: "PY", nombre: "Paraguay", prefijo: "+595", ejemplo: "981 000 000" },
  { iso: "BO", nombre: "Bolivia", prefijo: "+591", ejemplo: "712 34567" },
  { iso: "AR", nombre: "Argentina", prefijo: "+54", ejemplo: "11 2345 6789" },
  { iso: "BR", nombre: "Brasil", prefijo: "+55", ejemplo: "11 91234 5678" },
  { iso: "CL", nombre: "Chile", prefijo: "+56", ejemplo: "9 1234 5678" },
  { iso: "CO", nombre: "Colombia", prefijo: "+57", ejemplo: "301 234 5678" },
  { iso: "EC", nombre: "Ecuador", prefijo: "+593", ejemplo: "991 234 567" },
  { iso: "PE", nombre: "Perú", prefijo: "+51", ejemplo: "912 345 678" },
  { iso: "UY", nombre: "Uruguay", prefijo: "+598", ejemplo: "94 123 456" },
  { iso: "VE", nombre: "Venezuela", prefijo: "+58", ejemplo: "412 123 4567" },
];

export function paisPorIso(iso: string): PaisCelular | null {
  return PAISES_CELULAR.find((pais) => pais.iso === iso) ?? null;
}

/** Celular paraguayo: 9 dígitos que empiezan con 9 (ej.: 981 000 000). */
const LARGO_NUMERO_LOCAL_PY = 9;

export type ResultadoNormalizacion =
  | { readonly ok: true; readonly e164: string }
  | { readonly ok: false; readonly motivo: "FORMATO_INVALIDO" };

/**
 * Regla local por país. Estricta donde el envío real la va a hacer cumplir
 * de todos modos (Paraguay, Bolivia); básica en el resto.
 */
function validarLocal(iso: string, local: string): boolean {
  switch (iso) {
    case "PY":
      return local.length === LARGO_NUMERO_LOCAL_PY && local.startsWith("9");
    case "BO":
      // Móviles bolivianos: 8 dígitos, empiezan con 6 o 7.
      return local.length === 8 && (local.startsWith("6") || local.startsWith("7"));
    default:
      return local.length >= 7 && local.length <= 11 && !local.startsWith("0");
  }
}

function normalizarConPais(pais: PaisCelular, resto: string): ResultadoNormalizacion {
  // Se tolera el 0 de discado nacional que la gente escribe por costumbre.
  const local = resto.startsWith("0") ? resto.slice(1) : resto;
  if (!validarLocal(pais.iso, local)) return { ok: false, motivo: "FORMATO_INVALIDO" };
  return { ok: true, e164: `${pais.prefijo}${local}` };
}

/** Prefijos más largos primero: `+595` debe ganarle a `+59…` inexistente y `+51`. */
const POR_LARGO_DE_PREFIJO = [...PAISES_CELULAR].sort(
  (a, b) => b.prefijo.length - a.prefijo.length,
);

/**
 * Normaliza a E.164 lo que P1 manda al servidor: el número tipeado con el
 * prefijo del país seleccionado adelante (`+591 712 34567`). Si no viene
 * ningún prefijo de la región, se asume Paraguay en formato local — el
 * comportamiento histórico, que mantiene válidos los flujos y tests
 * anteriores a la habilitación regional.
 */
export function normalizarCelularRegional(entrada: string): ResultadoNormalizacion {
  const soloDigitos = entrada.replace(/\D/g, "");

  for (const pais of POR_LARGO_DE_PREFIJO) {
    const prefijoDigitos = pais.prefijo.slice(1);
    if (soloDigitos.startsWith(prefijoDigitos)) {
      return normalizarConPais(pais, soloDigitos.slice(prefijoDigitos.length));
    }
  }

  return normalizarCelularParaguayo(entrada);
}

/**
 * Devuelve el número en E.164 (`+595981000000`) a partir de lo tipeado en
 * formato local paraguayo. Es la regla original de P1; queda como caso
 * particular y como fallback de `normalizarCelularRegional`.
 */
export function normalizarCelularParaguayo(entrada: string): ResultadoNormalizacion {
  const soloDigitos = entrada.replace(/\D/g, "");

  const sinPrefijoPais = soloDigitos.startsWith("595") ? soloDigitos.slice(3) : soloDigitos;
  const local = sinPrefijoPais.startsWith("0") ? sinPrefijoPais.slice(1) : sinPrefijoPais;

  if (!validarLocal("PY", local)) {
    return { ok: false, motivo: "FORMATO_INVALIDO" };
  }

  return { ok: true, e164: `${PREFIJO_PAIS_PARAGUAY}${local}` };
}

/**
 * `+595981000123` → `+595 ••• ••• 123`. El prefijo mostrado es el del país
 * del número; el resto queda oculto salvo los últimos tres dígitos. Es la
 * única representación del número que puede salir hacia la UI, la evidencia
 * o cualquier registro.
 */
export function enmascararCelular(e164: string): string {
  const pais = POR_LARGO_DE_PREFIJO.find((candidato) => e164.startsWith(candidato.prefijo));
  const prefijo = pais?.prefijo ?? PREFIJO_PAIS_PARAGUAY;
  const ultimos = e164.slice(-3);
  return `${prefijo} ••• ••• ${ultimos}`;
}
