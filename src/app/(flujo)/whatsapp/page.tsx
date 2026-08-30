import { sufijoTitulo } from "@/domain/entidades";
import type { Metadata } from "next";
import { resolverModoIntegracion } from "@/adapters/index";
import {
  BarraPlanDelExpediente,
  HeaderInstitucional,
  PieLegal,
  StepperPasos,
  TituloDePantalla,
  TramiteEnOtroPaso,
} from "@/components/shared";
import { esModoDemo } from "@/app/demo-panel/_sesion";
import { DETALLE_WHATSAPP_YA_VERIFICADO } from "@/domain/textos-reencaminado";
import { expedienteEnOtroPaso } from "../_reencaminado";
import {
  AVISO_ALCANCE_VERIFICACION_P1,
  SUBTITULO_WHATSAPP,
  TITULO_WHATSAPP,
} from "@/domain/textos-p1";
import { FormularioVerificacionWhatsapp } from "./FormularioVerificacionWhatsapp";

/**
 * Paso 2 · Verificá tu número de WhatsApp — `/whatsapp`, en el formato de la
 * maqueta (`PantallasDemo2.pdf` p.3; reformulación en
 * `docs/plan/REFORMULACION_PANTALLAS_MAQUETA.md`): barra de plan arriba,
 * título centrado, dos tarjetas numeradas y la nota legal al pie.
 *
 * En la maqueta este era el paso 3; el intercambio con la preparación se
 * acordó en la reunión (00:05:49 — el código actúa como disuasivo porque todo
 * lo anterior es público) y quedó fijado en `PASOS_FLUJO` (CHG-01).
 */

export const metadata: Metadata = {
  title: `Verificá tu WhatsApp · ${sufijoTitulo()}`,
  description: "Paso 2: verificación del número de WhatsApp. Todavía no es una contratación.",
};

export default async function PantallaVerificacionWhatsapp() {
  const enOtroPaso = await expedienteEnOtroPaso("/whatsapp");
  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional indicador={<StepperPasos slug="/whatsapp" />} />

      <main className="mx-auto flex w-full max-w-pantalla flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <BarraPlanDelExpediente enlaceTexto="Cambiar plan" enlaceHref="/plan" />

        <TituloDePantalla titulo={TITULO_WHATSAPP} subtitulo={SUBTITULO_WHATSAPP} />

        {enOtroPaso ? (
          <TramiteEnOtroPaso
            destino={enOtroPaso}
            detalle={DETALLE_WHATSAPP_YA_VERIFICADO}
            modoDemo={esModoDemo()}
          />
        ) : (
          <FormularioVerificacionWhatsapp
            // Aviso operativo de la fase de pruebas del canal real: solo con
            // INTEGRATION_OTP=live y el número configurado; en mock no aparece.
            numeroPruebaWhatsApp={
              resolverModoIntegracion("OTP") === "live"
                ? (process.env.WHATSAPP_NUMERO_PRUEBA ?? null)
                : null
            }
          />
        )}

        {/* CHG-10 · alcance de la verificación, al pie como en la maqueta. */}
        <p className="rounded-lg border border-borde-sutil bg-superficie-suave px-3 py-2 text-xs leading-snug font-semibold text-rojo-800 dark:text-rojo-300">
          {AVISO_ALCANCE_VERIFICACION_P1}
        </p>
      </main>

      <PieLegal />
    </div>
  );
}
