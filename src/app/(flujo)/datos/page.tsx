/**
 * `/datos` — pantalla **03D** · Completá tus datos (etapa 2).
 *
 * Los datos personales que antes se declaraban dentro de la pantalla de
 * identidad. Llena el expediente sin moverlo de `IDENTIDAD_VERIFICADA`.
 */
import type { Metadata } from "next";
import { Pantalla03D } from "@/components/v4/pantallas/Pantalla03D";
import { sufijoTitulo } from "@/domain/entidades";

export const metadata: Metadata = {
  title: `Completá tus datos · ${sufijoTitulo()}`,
};

export default function PantallaDatosPersonales() {
  return <Pantalla03D />;
}
