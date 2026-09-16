/**
 * `/consentimientos` — pantalla **04D** del flujo v4.
 *
 * Ruta nueva: en v2 los consentimientos eran cuatro de las ocho declaraciones
 * de la misma pantalla. Fuera de v4 no existe.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Pantalla04D } from "@/components/v4/pantallas/Pantalla04D";
import { sufijoTitulo } from "@/domain/entidades";
import { flujoV4Activo } from "@/domain/flujo-vigente";

export const metadata: Metadata = {
  title: `Consentimientos · ${sufijoTitulo()}`,
};

export default function PantallaConsentimientos() {
  if (!flujoV4Activo()) redirect("/declaraciones");
  return <Pantalla04D />;
}
