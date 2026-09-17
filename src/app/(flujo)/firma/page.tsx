import type { Metadata } from "next";
import { Pantalla04E } from "@/components/v4/pantallas/Pantalla04E";
import { sufijoTitulo } from "@/domain/entidades";

/**
 * `/firma` — pantalla **04E** · Revisá, aceptá y firmá (etapa 4).
 *
 * Sin arte aprobado ni candidato todavía (ver la cabecera de
 * `Pantalla04E.tsx`): extrapola el sistema de las pantallas aprobadas y se
 * rehace cuando llegue el arte.
 *
 * La firma del cliente es la **interna** del portal (D1; Res. SS.SG. 210/2025
 * art. 4): OTP del acto de firma por el canal verificado, sobre el documento
 * único ya cerrado y hasheado (reglas inviolables #1, #3 y #4). Es el
 * segundo OTP del flujo, no el tercero: el de correo se retiró con D-06.
 */

export const metadata: Metadata = {
  title: `Revisión y firma final · ${sufijoTitulo()}`,
  description:
    "Revisión de la Solicitud y el FIPF cerrados y firma de ambos en un único acto.",
};

export default function PantallaFirma() {
  return <Pantalla04E />;
}
