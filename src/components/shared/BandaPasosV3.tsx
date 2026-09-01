/**
 * La banda de pasos del canvas: tres columnas iguales bajo la cabecera, cada
 * una con su número, su rótulo y un filete arriba —acento en el paso actual,
 * verde en los ya cumplidos, transparente en los que faltan— más un ✓ en los
 * cumplidos.
 *
 * **Reemplaza al indicador «Paso N de 3» con puntitos**, que era invención de
 * esta implementación: el canvas nunca lo tuvo. Va debajo de la cabecera y a
 * lo ancho, no dentro de ella (observación de Andres, 01-sep).
 *
 * Los rótulos y el orden salen de `PASOS_FLUJO` como siempre: el número no se
 * escribe a mano en ninguna pantalla.
 */
import { PASOS_FLUJO, numeroDePaso } from "@/domain/rutas-flujo";

export function BandaPasosV3({ slug }: { readonly slug: string }) {
  const pasoActual = numeroDePaso(slug);
  // Sin paso conocido no se dibuja: mejor sin banda que con un número inventado.
  if (pasoActual === null) return null;

  return (
    <nav
      aria-label="Progreso"
      style={{ borderBottom: "1px solid var(--color-divider)" }}
    >
      <ol
        style={{
          maxWidth: "1360px",
          margin: "0 auto",
          padding: "0 24px",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          listStyle: "none",
        }}
      >
        {PASOS_FLUJO.map((paso, indice) => {
          const numero = indice + 1;
          const cumplido = numero < pasoActual;
          const actual = numero === pasoActual;
          return (
            <li
              key={paso.id}
              aria-current={actual ? "step" : undefined}
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "baseline",
                padding: "12px 4px",
                fontSize: "12px",
                borderTop: `3px solid ${
                  actual
                    ? "var(--color-accent-600)"
                    : cumplido
                      ? "var(--verde-stepper)"
                      : "transparent"
                }`,
                color:
                  numero <= pasoActual
                    ? "var(--color-text)"
                    : "var(--color-neutral-500)",
              }}
            >
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700 }}>
                {numero}
              </span>
              <span style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {paso.titulo}
              </span>
              <span aria-hidden="true">{cumplido ? "✓" : ""}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
