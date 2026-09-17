/**
 * `/consentimientos` — pantalla **04D** · Consentimientos (etapa 4).
 *
 * Los consentimientos que antes eran cuatro de las ocho declaraciones. Es la
 * **única** puerta a `DECLARACIONES_OK`.
 */
import type { Metadata } from "next";
import { Pantalla04D } from "@/components/v4/pantallas/Pantalla04D";
import { sufijoTitulo } from "@/domain/entidades";

export const metadata: Metadata = {
  title: `Consentimientos · ${sufijoTitulo()}`,
};

export default function PantallaConsentimientos() {
  return <Pantalla04D />;
}
