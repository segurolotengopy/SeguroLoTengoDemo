import type { ReactNode } from "react";
import { HeaderInstitucional } from "@/components/shared";

/**
 * Marco de la verificación pública (CMP-06).
 *
 * Lleva la cabecera institucional —con la identificación regulatoria
 * permanente que exige la Res. 190/2025 (CMP-01) y el botón de tema— pero
 * **no lleva stepper**: esta pantalla no es un paso del flujo y quien la abre
 * casi nunca es quien está contratando. Un contador de pasos acá le diría a un
 * hospital que está a mitad de una compra de seguro.
 */
export default function LayoutVerificacion({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional />
      <main className="mx-auto flex w-full max-w-pantalla flex-col gap-4 px-4 py-5 sm:px-6">
        {children}
      </main>
    </div>
  );
}
