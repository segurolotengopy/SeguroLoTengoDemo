"use client";

/**
 * 03E1 · «¿Qué significa PEP?».
 *
 * En el arte es una **pantalla completa sin stepper**, no una hoja inferior:
 * ocupa todo lo que hay bajo la cabecera y se cierra con la ✕. Se dibuja así,
 * porque la diferencia no es estética — una hoja sugiere «elegí algo» y esto
 * es una explicación de la que se vuelve sin haber elegido nada.
 */

import { TEXTOS_03E1 } from "@/domain/v4/textos-actividad";
import { AvisoAzulV4 } from "../piezas";
import { BotonCerrarV4 } from "../superficies";

export function PanelPep03E1({ alCerrar }: { readonly alCerrar: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: "var(--v4-blanco)" }}
      role="dialog"
      aria-modal="true"
      aria-label={TEXTOS_03E1.titulo}
    >
      <div className="mx-auto w-full max-w-[38rem] px-4 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[1.75rem] font-bold" style={{ color: "var(--v4-navy)" }}>
              {TEXTOS_03E1.titulo}
            </h2>
            <p className="v4-bajada mt-1">{TEXTOS_03E1.bajada}</p>
          </div>
          <BotonCerrarV4 alCerrar={alCerrar} />
        </div>

        <div className="mt-4 h-px" style={{ background: "var(--v4-gris-borde)" }} />

        <div className="mt-4 space-y-4">
          {TEXTOS_03E1.tarjetas.map((tarjeta) => (
            <div key={tarjeta.titulo} className="v4-tarjeta-azul p-4 pb-6">
              <p className="mb-2 font-bold uppercase" style={{ color: "var(--v4-navy)" }}>
                {tarjeta.titulo}
              </p>
              <p className="text-[0.9375rem] leading-relaxed" style={{ color: "var(--v4-azul-apagado)" }}>
                {tarjeta.cuerpo}
              </p>
            </div>
          ))}
        </div>

        <AvisoAzulV4 className="mt-4">{TEXTOS_03E1.cierre}</AvisoAzulV4>
      </div>
    </div>
  );
}
