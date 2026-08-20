"use client";

/**
 * Barra de plan seleccionado, en el formato de la maqueta (`PantallasDemo2.pdf`
 * — presente en todas sus páginas desde el paso 2; la reunión, 00:03:05:
 * *"siempre hay que mantener… lo que ha elegido y el valor de la prima"*):
 * escudo naranja, `Plan seleccionado` con el nombre debajo, el premio a la
 * derecha en naranja, y una ranura configurable al final (enlace o chip de
 * estado según la pantalla).
 *
 * El texto exacto del premio y del enlace cambia según la pantalla, así que
 * esta pieza no hardcodea esas variantes: la pantalla que la usa decide el
 * texto. Puramente presentacional, sin lógica de negocio ni acceso a datos
 * del expediente.
 */

/** Escudo con cruz de la maqueta. Decorativo: la información va en el texto. */
function IconoEscudo() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-8 w-8 shrink-0 text-naranja-600 dark:text-naranja-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l7 2.5v5.2c0 4.6-3 8.2-7 10.3-4-2.1-7-5.7-7-10.3V5.5L12 3z" />
      <path d="M12 8v6M9 11h6" />
    </svg>
  );
}
export interface BarraPlanSeleccionadoProps {
  /** Ej.: "Seguro de Vida Oncológico · CONFÍO+" */
  planNombre: string;
  /** Ej.: "Gs. 475.000 al año · IVA incluido" (P7/P8: "Gs. 475.000 · premio anual · IVA incluido") */
  premioTexto: string;
  /** Ej.: "Cambiar plan" (P8: "Volver al pago") */
  enlaceTexto: string;
  enlaceHref?: string;
  onEnlaceClick?: () => void;
  className?: string;
}

export function BarraPlanSeleccionado({
  planNombre,
  premioTexto,
  enlaceTexto,
  enlaceHref,
  onEnlaceClick,
  className = "",
}: BarraPlanSeleccionadoProps) {
  return (
    <div
      className={`flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border-2 border-borde-sutil bg-superficie px-4 py-2.5 ${className}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <IconoEscudo />
        <div className="min-w-0 leading-tight">
          <p className="text-[10px] font-semibold tracking-wide text-etiqueta uppercase">
            Plan seleccionado
          </p>
          <p className="truncate text-sm font-bold text-titulo">{planNombre}</p>
        </div>
        <span aria-hidden="true" className="hidden h-8 w-px bg-borde-sutil sm:block" />
        {/* El valor de la prima, en naranja como lo destaca la maqueta. */}
        <p className="text-base font-bold text-naranja-700 tabular-nums dark:text-naranja-300">
          {premioTexto}
        </p>
      </div>

      {enlaceHref ? (
        <a
          href={enlaceHref}
          onClick={onEnlaceClick}
          className="shrink-0 text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500 dark:hover:text-hueso-50"
        >
          {enlaceTexto}
        </a>
      ) : (
        <button
          type="button"
          onClick={onEnlaceClick}
          className="shrink-0 text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500 dark:hover:text-hueso-50"
        >
          {enlaceTexto}
        </button>
      )}
    </div>
  );
}
