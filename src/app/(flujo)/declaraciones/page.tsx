import { sufijoTitulo } from "@/domain/entidades";
import type { Metadata } from "next";
import Link from "next/link";
import {
  BarraPlanDelExpediente,
  HeaderInstitucional,
  StepperPasos,
  TituloDePantalla,
} from "@/components/shared";
import { SUBTITULO_P6, TITULO_P6 } from "@/domain/textos-p6";
import { FormularioDatosYDeclaraciones } from "./FormularioDatosYDeclaraciones";

/**
 * Paso 5 · Datos y declaraciones — `/declaraciones`, en el formato de la
 * maqueta (`PantallasDemo2.pdf` p.5).
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
  title: `Datos y declaraciones · ${sufijoTitulo()}`,
  description:
    "Paso 6 de 9: datos complementarios, beneficiario por fallecimiento y las ocho declaraciones obligatorias.",
};

export default function PantallaP6Declaraciones() {
  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional indicador={<StepperPasos slug="/declaraciones" />} />

      <main className="mx-auto flex w-full max-w-pantalla flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <BarraPlanDelExpediente enlaceTexto="Cambiar plan" enlaceHref="/plan" />

        <TituloDePantalla titulo={TITULO_P6} subtitulo={SUBTITULO_P6} />

        <FormularioDatosYDeclaraciones />

        <footer className="flex flex-col gap-2 border-t border-borde-tenue pt-3">
          <Link
            href="/identidad"
            className="text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500"
          >
            ← Volver a la verificación de identidad
          </Link>
        </footer>
      </main>
    </div>
  );
}
