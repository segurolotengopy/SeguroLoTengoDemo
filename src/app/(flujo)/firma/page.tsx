import { sufijoTitulo } from "@/domain/entidades";
import type { Metadata } from "next";
import Link from "next/link";
import { BarraPlanDelExpediente, HeaderInstitucional, StepperPasos } from "@/components/shared";
import { esModoDemo } from "@/app/demo-panel/_sesion";
import {
  ADVERTENCIA_ACEPTACION_P8,
  LEYENDAS_FINALES_P8,
  PASOS_POSTERIORES_P8,
  SUBTITULO_P8,
  TITULO_DESPUES_DE_LA_FIRMA_P8,
  TITULO_P8,
} from "@/domain/textos-p8";
import { FirmaP8 } from "./FirmaP8";

/**
 * P8 · Paso 8 de 9 — Revisión y firma final.
 *
 * Fuente de verdad: docs/ESPECIFICACION_PANTALLAS.md → "P8 · Paso 8 de 9 —
 * Revisión y firma final". Respaldo normativo del conjunto: filas 29, 34, 35,
 * 36, 37, 41, 42, 43 y 47 de la matriz de cumplimiento (Ley 6822/21, arts.
 * 38(1), 40, 42(5), 44-46, 61, 66 y 67-69; Res. SS SG. 215/15, anexo 1,
 * numeral 11.15, y punto 14; Ley 4868/13, arts. 7(f), 7(n) y 7(r); Código
 * Civil, arts. 1348 y 1373-1374).
 *
 * La pantalla no firma: pide un enlace. La aceptación contractual ocurre en
 * Code100, con el tercer OTP del flujo, que nunca pasa por acá (reglas
 * inviolables #1, #2 y #3).
 *
 * Todo lo estático se renderiza en el servidor; lo único que baja como
 * componente de cliente son los tres bloques operativos y la barra de plan.
 */

export const metadata: Metadata = {
  title: `Revisión y firma final · ${sufijoTitulo()}`,
  description:
    "Paso 8 de 9: revisión de la Solicitud y el FIPF cerrados y firma de ambos en un único acto de Code100.",
};

export default function PantallaP8Firma() {
  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional indicador={<StepperPasos slug="/firma" />} />

      <main className="mx-auto flex w-full max-w-pantalla flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <BarraPlanDelExpediente
          enlaceTexto="Volver al pago"
          enlaceHref="/pago"
          formatoPremio="premio-anual"
        />

        <header className="flex flex-col gap-1 lg:flex-row lg:items-baseline lg:gap-4">
          <h1 className="shrink-0 text-xl font-bold text-titulo sm:text-2xl">{TITULO_P8}</h1>
          <p className="text-sm text-cuerpo">
            {SUBTITULO_P8}{" "}
            <span className="font-semibold text-naranja-700 dark:text-naranja-300">
              {ADVERTENCIA_ACEPTACION_P8}
            </span>
          </p>
        </header>

        <FirmaP8 firmadorSimuladoDisponible={esModoDemo()} />

        <section
          aria-labelledby="p8-despues"
          className="flex flex-col gap-2 rounded-lg border border-borde-sutil bg-superficie p-3"
        >
          <h2
            id="p8-despues"
            className="text-xs font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200"
          >
            {TITULO_DESPUES_DE_LA_FIRMA_P8}
          </h2>
          <ol className="flex flex-col gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-4">
            {PASOS_POSTERIORES_P8.map((paso, indice) => (
              <li
                key={paso.titulo}
                className="flex flex-col gap-0.5 rounded-lg border border-borde-tenue bg-superficie-suave p-2.5"
              >
                <span className="text-sm font-semibold text-titulo">
                  <span className="text-[11px] font-bold text-etiqueta">{indice + 1} · </span>
                  {paso.titulo}
                </span>
                <span className="text-xs text-cuerpo">{paso.detalle}</span>
              </li>
            ))}
          </ol>
          <ul className="flex list-disc flex-col gap-0.5 pl-5 text-xs text-etiqueta">
            {LEYENDAS_FINALES_P8.map((leyenda) => (
              <li key={leyenda}>{leyenda}</li>
            ))}
          </ul>
        </section>

        <footer className="flex flex-col gap-2 border-t border-borde-tenue pt-3">
          <Link
            href="/pago"
            className="text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500"
          >
            ← Volver a facturación y garantía de pago
          </Link>
        </footer>
      </main>
    </div>
  );
}
