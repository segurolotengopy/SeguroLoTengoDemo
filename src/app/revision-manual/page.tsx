import type { Metadata } from "next";
import { PantallaRevisionManual } from "@/components/v4/pantallas/PantallaRevisionManual";
import { sufijoTitulo } from "@/domain/entidades";

/**
 * Pantalla A · Emisión no automática (derivación a revisión manual).
 *
 * v4 · artes `03E2` (PEP) y `04A1` (salud), que comparten pantalla y se
 * distinguen por el motivo del caso. Se llega solo desde las declaraciones,
 * cuando una respuesta incompatible detiene la emisión automática (regla de
 * negocio inviolable #5).
 *
 * **Fuera del contador de etapas** y sin barra de plan: el plan dejó de estar
 * en juego porque no hay contratación en curso.
 */

export const metadata: Metadata = {
  title: `Tu solicitud requiere una revisión adicional · ${sufijoTitulo()}`,
  description:
    "Pantalla A: la póliza no puede emitirse automáticamente; el caso se derivó a Interseguros y Alianza Garantía.",
};

export default function PantallaARevisionManual() {
  return <PantallaRevisionManual />;
}
