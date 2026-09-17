import type { ReactNode } from "react";
import { CabeceraV4, PieV4 } from "@/components/v4/MarcoV4";
import { CapaLegalV4 } from "@/components/v4/CapaLegalV4";

/**
 * Marco de la verificación pública (CMP-06).
 *
 * Lleva la cabecera institucional —con la identificación regulatoria
 * permanente que exige la Res. 190/2025 (CMP-01, ver `CapaLegalV4` →
 * "Responsabilidades") y el pie con el enlace "Información legal"— pero **no
 * lleva stepper**: esta pantalla no es un paso del flujo y quien la abre casi
 * nunca es quien está contratando. Un contador de etapas acá le diría a un
 * hospital que está a mitad de una compra de seguro.
 */
export default function LayoutVerificacion({ children }: { children: ReactNode }) {
  return (
    <CapaLegalV4>
      <div className="flex flex-1 flex-col bg-fondo">
        <CabeceraV4 marcas={3} />
        <main className="mx-auto flex w-full max-w-pantalla flex-1 flex-col gap-4 px-4 py-5 sm:px-6">
          {children}
        </main>
        <div className="mx-auto w-full max-w-pantalla px-4">
          <PieV4 />
        </div>
      </div>
    </CapaLegalV4>
  );
}
