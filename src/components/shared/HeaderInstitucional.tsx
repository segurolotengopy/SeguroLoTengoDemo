import type { ReactNode } from "react";
import { IsologoAlianza, IsologoInterseguros } from "./marcas";
import { ToggleTema } from "./ToggleTema";

/**
 * Cabecera fija de las tres pantallas del flujo (ver
 * docs/ESPECIFICACION_PANTALLAS.md → "Elementos comunes a todas las
 * pantallas"): bloque aseguradora a la izquierda, bloque intermediario al
 * centro y un slot a la derecha para el indicador de paso de cada pantalla
 * (ver `StepperPasos`).
 *
 * A la derecha del indicador va el botón de día/noche (`ToggleTema`): al vivir
 * acá aparece igual en todas las pantallas, sin que ninguna lo repita.
 *
 * Puramente presentacional: no decide qué mostrar en el slot ni conoce el
 * estado del expediente.
 */
export interface HeaderInstitucionalProps {
  /** Indicador de paso de la pantalla actual (`<StepperPasos />` u otro contenido). */
  indicador?: ReactNode;
  className?: string;
}

function MarcaAseguradora() {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <IsologoAlianza tamano={36} className="shrink-0" />
      <div className="min-w-0 leading-tight">
        <p className="text-[10px] font-semibold tracking-wide text-etiqueta uppercase">
          Aseguradora
        </p>
        <p className="truncate text-sm font-semibold text-titulo">
          Alianza Garantía Seguros y Reaseguros S.A.
        </p>
      </div>
    </div>
  );
}

function MarcaIntermediario() {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <IsologoInterseguros tamano={36} className="shrink-0" />
      <div className="min-w-0 leading-tight">
        <p className="text-[10px] font-semibold tracking-wide text-etiqueta uppercase">
          Intermediario
        </p>
        <p className="truncate text-sm font-semibold text-titulo">
          Interseguros S.A. - Corredores de Seguros
        </p>
      </div>
    </div>
  );
}

export function HeaderInstitucional({
  indicador,
  className = "",
}: HeaderInstitucionalProps) {
  return (
    <header
      className={`w-full border-b border-borde-tenue bg-fondo ${className}`}
    >
      <div className="mx-auto flex w-full max-w-pantalla flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
        {/* `min-w-0` para que el truncado de los nombres largos pueda actuar
            y el bloque no empuje al indicador fuera de la pantalla. */}
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <MarcaAseguradora />
          <span
            aria-hidden="true"
            className="hidden h-8 w-px bg-borde-sutil sm:block"
          />
          <MarcaIntermediario />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
          {indicador}
          <ToggleTema />
        </div>
      </div>
    </header>
  );
}
