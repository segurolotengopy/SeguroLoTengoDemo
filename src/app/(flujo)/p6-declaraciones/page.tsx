import type { Metadata } from "next";
import Link from "next/link";
import { BarraPlanDelExpediente, HeaderInstitucional, StepperPasos } from "@/components/shared";
import { SUBTITULO_P6, TITULO_P6 } from "@/domain/textos-p6";
import { FormularioDatosYDeclaraciones } from "./FormularioDatosYDeclaraciones";

/**
 * P6 · Paso 6 de 9 — Datos y declaraciones.
 *
 * Fuente de verdad: docs/ESPECIFICACION_PANTALLAS.md → "P6 · Paso 6 de 9 —
 * Datos y declaraciones". Respaldo normativo del conjunto: filas 16, 18, 19,
 * 20 y 21 de la matriz de cumplimiento (Res. SEPRELAD 71/19, art. 26(1)(a-j) y
 * 44; Res. SEPRELAD 50/20, arts. 2-3 y 7; Código Civil, arts. 1349-1354 y
 * 1387; Ley 4868/13, arts. 6(a) y 7(b)).
 *
 * Todo lo estático se renderiza en el servidor; lo único que baja como
 * componente de cliente son el formulario y la barra de plan.
 */

export const metadata: Metadata = {
  title: "Datos y declaraciones · SeguroLoTengo",
  description:
    "Paso 6 de 9: datos complementarios, beneficiario por fallecimiento y las ocho declaraciones obligatorias.",
};

export default function PantallaP6Declaraciones() {
  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional indicador={<StepperPasos pasoActual={6} />} />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        <BarraPlanDelExpediente enlaceTexto="Cambiar plan" enlaceHref="/p2-plan" />

        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-titulo sm:text-3xl">{TITULO_P6}</h1>
          <p className="text-base text-azul-700 dark:text-azul-200">{SUBTITULO_P6}</p>
        </header>

        <FormularioDatosYDeclaraciones />

        <footer className="flex flex-col gap-2 border-t border-borde-tenue pt-4">
          <Link
            href="/p5-identidad"
            className="text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500"
          >
            ← Volver a la verificación de identidad
          </Link>
        </footer>
      </main>
    </div>
  );
}
