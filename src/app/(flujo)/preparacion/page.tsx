import type { Metadata } from "next";
import { Pantalla03B } from "@/components/v4/pantallas/Pantalla03B";
import { sufijoTitulo } from "@/domain/entidades";

/**
 * `/preparacion` — pantalla **03B** · Prepará lo necesario (etapa 2).
 *
 * Esta pantalla **no solicita ningún dato**: informa qué hay que tener a mano
 * y toma la autorización inicial (fila 11 de la matriz de cumplimiento). El
 * acto de aceptación es el botón, con el literal a la vista.
 */

export const metadata: Metadata = {
  title: `Prepará lo necesario · ${sufijoTitulo()}`,
  description:
    "Qué tener a mano antes de la validación. No solicita datos, no cobra y no firma documentos.",
};

export default function PantallaPreparacion() {
  return <Pantalla03B />;
}
