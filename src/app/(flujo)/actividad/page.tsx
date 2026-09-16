/**
 * `/actividad` — pantalla **03E** del flujo v4.
 *
 * Ruta nueva: en v2 la actividad y los ingresos se declaraban dentro de la
 * pantalla de identidad. Fuera de v4 no existe.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Pantalla03E } from "@/components/v4/pantallas/Pantalla03E";
import { sufijoTitulo } from "@/domain/entidades";
import { flujoV4Activo } from "@/domain/flujo-vigente";

export const metadata: Metadata = {
  title: `Actividad e ingresos · ${sufijoTitulo()}`,
};

export default function PantallaActividadEIngresos() {
  if (!flujoV4Activo()) redirect("/identidad");
  return <Pantalla03E />;
}
