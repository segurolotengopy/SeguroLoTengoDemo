import { PRODUCTOS } from "@/domain/catalogo";

/**
 * Pestañas de producto (maqueta p.1; canvas v3 «ramos»). Absorben las fichas
 * de P0: el oncológico activo y los otros tres productos anunciados.
 * Server-rendered: hoy no hay otro producto al que navegar, así que las
 * inactivas no son botones que finjan serlo.
 *
 * Vivían dentro de `plan/page.tsx`; se extrajeron en el lote F3 porque la
 * página del paso 2 del flujo v3 (`/seguro`) dibuja las mismas pestañas con
 * otra etiqueta («PRONTO», canvas del rediseño).
 */

/** Íconos de línea de la maqueta. Decorativos: la información va en el texto. */
function Icono({ trazo, className = "h-4 w-4" }: { trazo: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={trazo} />
    </svg>
  );
}

const TRAZOS = {
  persona: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.6-6 8-6s8 2 8 6",
  corazon: "M12 20s-7-4.6-9-9a5 5 0 019-3 5 5 0 019 3c-2 4.4-9 9-9 9z",
  escudo: "M12 3l7 2.5v5.2c0 4.6-3 8.2-7 10.3-4-2.1-7-5.7-7-10.3V5.5L12 3z",
} as const;

/** Ícono por producto, como los dibuja la maqueta en cada pestaña. */
const ICONO_PRODUCTO: Readonly<Record<string, string>> = {
  VIDA_ONCOLOGICO: TRAZOS.persona,
  VIDA: TRAZOS.corazon,
  ACCIDENTES_PERSONALES: TRAZOS.persona,
  RESPONSABILIDAD_CIVIL: TRAZOS.escudo,
};

export function PestanasDeProducto({
  etiquetaProximamente = "PRÓXIMAMENTE",
  canvas = false,
}: {
  /** «PRÓXIMAMENTE» en el flujo v2; «PRONTO» en el paso 2 del v3. */
  etiquetaProximamente?: string;
  /**
   * Dibujo del canvas (v3): pestañas subrayadas sobre una línea, sin caja ni
   * ícono. El de v2 son solapas con borde, que es otra cosa.
   */
  canvas?: boolean;
}) {
  if (canvas) {
    return (
      <div
        role="presentation"
        className="mt-4 mb-5 flex overflow-x-auto"
        style={{ borderBottom: "1px solid var(--color-divider)" }}
      >
        {PRODUCTOS.map((producto) => (
          <span
            key={producto.id}
            className="flex-none whitespace-nowrap"
            style={{
              padding: "12px 18px 11px",
              fontSize: "12.5px",
              fontWeight: producto.disponible ? 700 : 500,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: producto.disponible
                ? "var(--color-accent-700)"
                : "var(--color-neutral-400)",
              borderBottom: `3px solid ${producto.disponible ? "var(--color-accent)" : "transparent"}`,
            }}
          >
            {producto.nombre}
            {producto.disponible ? null : (
              <span style={{ fontSize: "9.5px", letterSpacing: "0.08em", marginLeft: "7px" }}>
                {etiquetaProximamente}
              </span>
            )}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1 border-b-2 border-naranja-500" role="presentation">
      {PRODUCTOS.map((producto) => (
        <span
          key={producto.id}
          className={`inline-flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-xs font-bold tracking-wide uppercase ${
            producto.disponible
              ? "border-x border-t border-naranja-500 bg-naranja-50 text-naranja-800 dark:bg-naranja-950 dark:text-naranja-200"
              : "border-x border-t border-borde-tenue bg-superficie text-etiqueta"
          }`}
        >
          <Icono trazo={ICONO_PRODUCTO[producto.id] ?? TRAZOS.escudo} />
          {producto.nombre}
          {producto.disponible ? null : (
            <span className="ml-1 text-[9px] font-semibold">{etiquetaProximamente}</span>
          )}
        </span>
      ))}
    </div>
  );
}
