/**
 * `/actividad` — pantalla **03E** · Actividad e ingresos (etapa 3).
 *
 * La actividad económica y el origen de los fondos, con los catálogos de
 * D-48. Llena el expediente sin moverlo de `IDENTIDAD_VERIFICADA`; la
 * condición PEP deriva a `03E2` (revisión manual).
 */
import type { Metadata } from "next";
import { Pantalla03E } from "@/components/v4/pantallas/Pantalla03E";
import { sufijoTitulo } from "@/domain/entidades";

export const metadata: Metadata = {
  title: `Actividad e ingresos · ${sufijoTitulo()}`,
};

export default function PantallaActividadEIngresos() {
  return <Pantalla03E />;
}
