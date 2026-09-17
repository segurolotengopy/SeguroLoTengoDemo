import type { Metadata } from "next";
import { Pantalla03A } from "@/components/v4/pantallas/Pantalla03A";
import { sufijoTitulo } from "@/domain/entidades";

/**
 * `/whatsapp` — pantalla **03A** · Verificá tu número de WhatsApp (etapa 2).
 *
 * Sin SMS (D-44): la cadena es WhatsApp → reenvío (60 s) → bloqueo. Es el
 * único OTP de canal del flujo (regla inviolable #1); el del acto de firma es
 * otro y vive en `04E`.
 */

export const metadata: Metadata = {
  title: `Verificá tu WhatsApp · ${sufijoTitulo()}`,
  description: "Verificación del número de WhatsApp. Todavía no es una contratación.",
};

export default function PantallaVerificacionWhatsapp() {
  return <Pantalla03A />;
}
