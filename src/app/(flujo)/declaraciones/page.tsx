import type { Metadata } from "next";
import { Pantalla04A } from "@/components/v4/pantallas/Pantalla04A";
import { sufijoTitulo } from "@/domain/entidades";

/**
 * `/declaraciones` — pantalla **04A** · Datos y declaraciones (etapa 4).
 *
 * Tres preguntas de salud y el beneficiario. Una respuesta incompatible
 * detiene la emisión automática y deriva a `04A1` (regla inviolable #5).
 * Respaldo normativo del conjunto: filas 16, 18, 19, 20 y 21 de la matriz de
 * cumplimiento.
 */

export const metadata: Metadata = {
  title: `Datos y declaraciones · ${sufijoTitulo()}`,
  description: "Declaraciones de salud y beneficiario por fallecimiento.",
};

export default function PantallaDeclaraciones() {
  return <Pantalla04A />;
}
