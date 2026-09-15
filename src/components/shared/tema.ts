/**
 * Tema visual claro/oscuro. Preferencia puramente cosmética: no es un dato del
 * expediente ni se registra como evidencia, y vive solo en el navegador.
 *
 * El tema claro es el especificado en docs/ESPECIFICACION_PANTALLAS.md; el
 * oscuro es una capa de accesibilidad/comodidad agregada por decisión de
 * producto (no hay obligación normativa detrás).
 *
 * **Forzado a claro desde el 15-sep-2026 (D-29).** La primera fase del
 * handoff de pantallas v4 sale solo en tema claro; el botón de día/noche se
 * retiró de `HeaderInstitucional`. Los tokens semánticos y las funciones de
 * abajo se conservan intactos para retomar el oscuro más adelante — lo único
 * que cambia es que `SCRIPT_TEMA_INICIAL` ya no lee ni la preferencia
 * guardada ni la del sistema operativo.
 */

export type Tema = "claro" | "oscuro";

/** Clave de `localStorage`. Guarda únicamente "claro" u "oscuro". */
export const CLAVE_TEMA = "segurolotengo:tema";

export function esTema(valor: unknown): valor is Tema {
  return valor === "claro" || valor === "oscuro";
}

/** Aplica el tema al documento. Idempotente. */
export function aplicarTema(tema: Tema): void {
  const raiz = document.documentElement;
  raiz.dataset.tema = tema;
  raiz.style.colorScheme = tema === "oscuro" ? "dark" : "light";
}

/**
 * Script que corre en el `<head>`, antes del primer pintado.
 *
 * **D-29 (15-sep-2026): fuerza el tema claro**, sin leer `localStorage` ni la
 * preferencia del sistema operativo — una preferencia oscura guardada de
 * antes de esta fase no se aplica. Antes de D-29 este script respetaba la
 * elección guardada y, si no había ninguna, la preferencia del sistema; ese
 * comportamiento vuelve el día que se retome el tema oscuro.
 *
 * Se inyecta como texto (no como módulo) justamente porque tiene que
 * ejecutarse antes de que React hidrate. Ver `layout.tsx`.
 */
export const SCRIPT_TEMA_INICIAL = `(function(){try{var r=document.documentElement;r.dataset.tema="claro";r.style.colorScheme="light";}catch(e){}})();`;
