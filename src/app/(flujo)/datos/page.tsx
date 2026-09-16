/**
 * `/datos` — pantalla **03D** del flujo v4.
 *
 * Ruta nueva: en v2 los datos personales se declaraban dentro de la pantalla
 * de identidad, y v4 los separa. Fuera de v4 no existe, así que redirige al
 * lugar donde ese contenido vive hoy.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Pantalla03D } from "@/components/v4/pantallas/Pantalla03D";
import { sufijoTitulo } from "@/domain/entidades";
import { flujoV4Activo } from "@/domain/flujo-vigente";

export const metadata: Metadata = {
  title: `Completá tus datos · ${sufijoTitulo()}`,
};

export default function PantallaDatosPersonales() {
  if (!flujoV4Activo()) redirect("/identidad");
  return <Pantalla03D />;
}
