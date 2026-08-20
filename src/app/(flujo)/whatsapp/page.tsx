import { sufijoTitulo } from "@/domain/entidades";
import type { Metadata } from "next";
import Link from "next/link";
import { resolverModoIntegracion } from "@/adapters/index";
import { HeaderInstitucional, StepperPasos } from "@/components/shared";
import { AVISO_ALCANCE_VERIFICACION_P1 } from "@/domain/textos-p1";
import { FormularioVerificacionWhatsapp } from "./FormularioVerificacionWhatsapp";

/**
 * P1 · Paso 1 de 9 — Verificación de WhatsApp.
 *
 * Fuente de verdad: docs/ESPECIFICACION_PANTALLAS.md → "P1 · Paso 1 de 9 —
 * Verificación de WhatsApp". Textos, bloques y advertencias salen de ahí.
 *
 * Layout compacto por decisión de producto (2026-08): sin panel ilustrativo ni
 * bloque de "tres validaciones independientes", con los dos pasos del
 * formulario lado a lado en pantallas anchas para que todo entre sin scroll.
 *
 * Todo lo estático se renderiza en el servidor; lo único que baja como
 * componente de cliente es el formulario, que es la parte con estado.
 */

export const metadata: Metadata = {
  title: `Verificá tu WhatsApp · ${sufijoTitulo()}`,
  description:
    "Paso 1 de 9: verificación del WhatsApp personal. Todavía no es una contratación.",
};

function BandaInicioSeguro() {
  return (
    <div className="w-full border-b border-borde-tenue bg-superficie">
      <div className="mx-auto flex w-full max-w-pantalla flex-col gap-1 px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
        <p className="text-sm text-cuerpo">
          <span className="font-bold tracking-wide text-verde-700 uppercase dark:text-verde-300">
            Inicio seguro
          </span>{" "}
          · Verificación inicial de tu WhatsApp personal
        </p>
        <p className="text-xs font-semibold text-naranja-700 sm:text-right dark:text-naranja-300">
          Todavía no es una contratación — No se selecciona plan, no se firma y no se realiza
          ningún cobro.
        </p>
      </div>
    </div>
  );
}

export default function PantallaP1Whatsapp() {
  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional indicador={<StepperPasos slug="/whatsapp" />} />
      <BandaInicioSeguro />

      <main className="mx-auto flex w-full max-w-pantalla flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <header className="flex flex-col gap-1 lg:flex-row lg:items-baseline lg:gap-4">
          <h1 className="shrink-0 text-xl font-bold text-titulo sm:text-2xl">
            Verificá tu WhatsApp personal
          </h1>
          <p className="text-sm text-cuerpo">
            Va a ser el primer canal verificado y deberá permanecer activo durante todo el
            proceso. El código solo valida el canal: no contrata, no firma y no autoriza ningún
            cobro.
          </p>
        </header>

        <FormularioVerificacionWhatsapp
          // Aviso de la fase de pruebas del canal real (modo interino
          // template_header de WhatsApp-Modular): la entrega es confiable
          // cuando el destinatario inició la conversación con el número de
          // pruebas de Meta. Solo aparece con el canal real activo Y el
          // número configurado; en mock, o cuando llegue la plantilla
          // AUTHENTICATION definitiva, se apaga solo quitando la variable.
          numeroPruebaWhatsApp={
            resolverModoIntegracion("OTP") === "live"
              ? (process.env.WHATSAPP_NUMERO_PRUEBA ?? null)
              : null
          }
        />

        {/* CHG-10 · alcance de la verificación, al pie y en un solo bloque. */}
        <p className="rounded-lg border border-borde-sutil bg-superficie-suave p-3 text-xs leading-snug text-cuerpo">
          {AVISO_ALCANCE_VERIFICACION_P1}
        </p>

        <footer className="flex flex-col gap-2 border-t border-borde-tenue pt-3">
          <Link
            href="/plan"
            className="text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500"
          >
            ← Volver a la selección de plan
          </Link>
        </footer>
      </main>
    </div>
  );
}
