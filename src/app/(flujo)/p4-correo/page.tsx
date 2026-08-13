import type { Metadata } from "next";
import Link from "next/link";
import { BarraPlanDelExpediente, HeaderInstitucional, StepperPasos } from "@/components/shared";
import { FormularioVerificacionCorreo } from "./FormularioVerificacionCorreo";
import { TarjetaWhatsappVerificado } from "./TarjetaWhatsappVerificado";

/**
 * P4 · Paso 4 de 9 — Verificación de correo.
 *
 * Fuente de verdad: docs/ESPECIFICACION_PANTALLAS.md → "P4 · Paso 4 de 9 —
 * Verificación de correo": *"Estructura idéntica a P1 pero para correo
 * electrónico"*. Comparte con P1 el layout compacto (decisión de producto
 * 2026-08): sin panel ilustrativo ni bloque de validaciones, dos pasos del
 * formulario lado a lado en pantallas anchas.
 *
 * Todo lo estático se renderiza en el servidor; lo único que baja como
 * componente de cliente es el formulario, la tarjeta de WhatsApp verificado y
 * la barra de plan.
 */

export const metadata: Metadata = {
  title: "Verificá tu correo · SeguroLoTengo",
  description:
    "Paso 4 de 9: verificación del correo electrónico con un código diferente al de WhatsApp.",
};

export default function PantallaP4Correo() {
  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional indicador={<StepperPasos pasoActual={4} />} />

      <main className="mx-auto flex w-full max-w-pantalla flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <BarraPlanDelExpediente enlaceTexto="Cambiar plan" enlaceHref="/p2-plan" />

        <header className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          <div className="flex flex-col gap-1 lg:flex-row lg:items-baseline lg:gap-4">
            <h1 className="shrink-0 text-xl font-bold text-titulo sm:text-2xl">
              Verificá tu correo electrónico
            </h1>
            <p className="text-sm text-cuerpo">
              Se va a usar para los avisos del proceso y la entrega de documentos electrónicos.
              Este código es diferente al de WhatsApp: no contrata, no firma y no autoriza ningún
              cobro.
            </p>
          </div>
          <div className="shrink-0">
            <TarjetaWhatsappVerificado />
          </div>
        </header>

        <FormularioVerificacionCorreo />

        <footer className="flex flex-col gap-2 border-t border-borde-tenue pt-3">
          <Link
            href="/p3-preparacion"
            className="text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500"
          >
            ← Volver a la preparación
          </Link>
        </footer>
      </main>
    </div>
  );
}
