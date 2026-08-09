/**
 * Tema visual claro/oscuro. Preferencia puramente cosmética: no es un dato del
 * expediente ni se registra como evidencia, y vive solo en el navegador.
 *
 * El tema claro es el especificado en docs/ESPECIFICACION_PANTALLAS.md; el
 * oscuro es una capa de accesibilidad/comodidad agregada por decisión de
 * producto (no hay obligación normativa detrás).
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
 * Script que corre en el `<head>`, antes del primer pintado, para evitar el
 * destello de tema equivocado: si el usuario ya eligió, respeta su elección;
 * si no, sigue la preferencia del sistema operativo.
 *
 * Se inyecta como texto (no como módulo) justamente porque tiene que
 * ejecutarse antes de que React hidrate. Ver `layout.tsx`.
 */
export const SCRIPT_TEMA_INICIAL = `(function(){try{var g=localStorage.getItem(${JSON.stringify(
  CLAVE_TEMA,
)});if(g!=="claro"&&g!=="oscuro"){g=window.matchMedia("(prefers-color-scheme: dark)").matches?"oscuro":"claro";}var r=document.documentElement;r.dataset.tema=g;r.style.colorScheme=g==="oscuro"?"dark":"light";}catch(e){}})();`;
