import type { Metadata } from "next";
import Link from "next/link";
import { BarraPlanDelExpediente, HeaderInstitucional, StepperPasos } from "@/components/shared";
import { VerificacionIdentidad } from "./VerificacionIdentidad";

/**
 * P5 · Paso 5 de 9 — Verificación de identidad.
 *
 * Fuente de verdad: docs/ESPECIFICACION_PANTALLAS.md → "P5 · Paso 5 de 9 —
 * Verificación de identidad". Respaldo normativo: fila 14 de la matriz de
 * cumplimiento (Res. SEPRELAD 71/19, arts. 25(a-c), 26(1)(a-b) y 29(b)).
 *
 * Todo lo estático se renderiza en el servidor; lo único que baja como
 * componente de cliente son los bloques interactivos y la barra de plan.
 */

export const metadata: Metadata = {
  title: "Verificá tu identidad · SeguroLoTengo",
  description:
    "Paso 5 de 9: captura de cédula paraguaya, selfie en vivo con prueba de vida y coincidencia facial.",
};

export default function PantallaP5Identidad() {
  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional indicador={<StepperPasos pasoActual={5} />} />

      <main className="mx-auto flex w-full max-w-pantalla flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <BarraPlanDelExpediente enlaceTexto="Cambiar plan" enlaceHref="/p2-plan" />

        <header className="flex flex-col gap-1 lg:flex-row lg:items-baseline lg:gap-4">
          <h1 className="shrink-0 text-xl font-bold text-titulo sm:text-2xl">
            Verificá tu identidad
          </h1>
          <p className="text-sm text-cuerpo">
            Vas a fotografiar tu cédula paraguaya vigente y a hacer una selfie en vivo.{" "}
            <span className="font-semibold">
              No se admite pasaporte ni documento extranjero. Esta pantalla no contiene
              declaraciones, pago ni firma.
            </span>
          </p>
        </header>

        <VerificacionIdentidad />

        <footer className="flex flex-col gap-2 border-t border-borde-tenue pt-3">
          <Link
            href="/p4-correo"
            className="text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500"
          >
            ← Volver a la verificación de correo
          </Link>
        </footer>
      </main>
    </div>
  );
}
