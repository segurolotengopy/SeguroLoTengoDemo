"use client";

/**
 * Barra de plan seleccionado, presente de P3 a P8 (ver
 * docs/ESPECIFICACION_PANTALLAS.md → "Elementos comunes a todas las
 * pantallas"): check, "PLAN SELECCIONADO", nombre del plan, premio anual con
 * IVA incluido, y un enlace configurable a la derecha.
 *
 * El texto exacto del premio y del enlace cambia según la pantalla (P7/P8
 * dicen "premio anual · IVA incluido" y P8 usa el enlace "Volver al pago" en
 * vez de "Cambiar plan"), así que esta pieza no hardcodea esas variantes: la
 * pantalla que la usa decide el texto. Puramente presentacional, sin lógica
 * de negocio ni acceso a datos del expediente.
 */
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
      className={`flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-verde-200 bg-verde-50 px-4 py-3 dark:border-verde-800 dark:bg-verde-950 ${className}`}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-verde-600 text-[11px] font-bold text-hueso-50"
        >
          ✓
        </span>
        <div className="min-w-0 leading-tight">
          <p className="text-[10px] font-semibold tracking-wide text-verde-700 uppercase dark:text-verde-300">
            Plan seleccionado
          </p>
          <p className="truncate text-sm font-semibold text-titulo">
            {planNombre}
          </p>
          <p className="text-sm text-cuerpo">{premioTexto}</p>
        </div>
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
