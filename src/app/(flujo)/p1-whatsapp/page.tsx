import type { Metadata } from "next";
import Link from "next/link";
import { HeaderInstitucional, StepperPasos } from "@/components/shared";
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
  title: "Verificá tu WhatsApp · SeguroLoTengo",
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
      <HeaderInstitucional indicador={<StepperPasos pasoActual={1} />} />
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

        <FormularioVerificacionWhatsapp />

        <footer className="flex flex-col gap-2 border-t border-borde-tenue pt-3">
          <Link
            href="/"
            className="text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500"
          >
            ← Volver a la información
          </Link>
        </footer>
      </main>
    </div>
  );
}
