import type { ReactNode } from "react";

/**
 * Título de pantalla en el formato de la maqueta: grande, centrado, con el
 * subtítulo azul en una línea debajo (`docs/plan/REFORMULACION_PANTALLAS_MAQUETA.md`
 * → "Cromática compartida"). Es el patrón de las 8 páginas de
 * `PantallasDemo2.pdf` y reemplaza a los encabezados en caja.
 *
 * Puramente presentacional. El `accesorio` es la ranura derecha que algunas
 * páginas de la maqueta usan (el botón de video en la selección de plan).
 */
export function TituloDePantalla({
  titulo,
  subtitulo,
  accesorio,
  className = "",
}: {
  titulo: string;
  subtitulo?: string;
  accesorio?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative flex flex-col items-center gap-1 py-1 text-center ${className}`}>
      <h1 className="text-2xl font-bold text-titulo sm:text-3xl">{titulo}</h1>
      {subtitulo ? (
        <p className="text-sm font-semibold text-azul-700 dark:text-azul-300">{subtitulo}</p>
      ) : null}
      {accesorio ? (
        <div className="mt-1 lg:absolute lg:top-1 lg:right-0 lg:mt-0">{accesorio}</div>
      ) : null}
    </div>
  );
}
