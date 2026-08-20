import { sufijoTitulo } from "@/domain/entidades";
import type { Metadata } from "next";
import Link from "next/link";
import { HeaderInstitucional, StepperPasos } from "@/components/shared";
import {
  ACTORES_PANTALLA_B,
  EVIDENCIA_CONSERVADA_PANTALLA_B,
  ROTULO_BOTON_FINALIZAR_B,
  ROTULO_MODO_PANTALLA_B,
  ROTULO_PRODUCTO_PANTALLA_B,
  TITULO_ACTORES_Y_REGISTRO,
  TITULO_EVIDENCIA_CONSERVADA,
  TITULO_PANTALLA_B,
} from "@/domain/textos-pantalla-b";
import { CasoVencido } from "./CasoVencido";

/**
 * Pantalla B · QR pagado, firma no completada.
 *
 * Fuente de verdad: docs/ESPECIFICACION_PANTALLAS.md → "Pantalla B · QR pagado,
 * firma no completada". Se llega solo desde el vencimiento del plazo de firma
 * de P8, con el expediente en VENCIDO / DEVOLUCION_EN_TRAMITE / DEVUELTO.
 *
 * **Fuera del contador de 9 pasos**: usa la variante `pantalla-b` del stepper y
 * no lleva barra de plan seleccionado — la barra va de P3 a P8, y acá no hay
 * contratación en curso.
 *
 * Todo lo estático se renderiza en el servidor. Lo que baja como componente de
 * cliente es `CasoVencido`, que abre el trámite de devolución en
 * `GET /api/pantalla-b/caso` y dibuja el seguimiento, el resumen y el
 * procedimiento.
 */

export const metadata: Metadata = {
  title: `Tu solicitud venció · ${sufijoTitulo()}`,
  description:
    "Pantalla B: el plazo de firma venció; se inició el procedimiento de devolución del premio. No existe póliza emitida ni cobertura iniciada.",
  // Es el desenlace de un expediente concreto, no una página pública.
  robots: { index: false, follow: false },
};

export default function PantallaBSolicitudVencida() {
  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional indicador={<StepperPasos variante="pantalla-b" />} />

      <main className="mx-auto flex w-full max-w-pantalla flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
        {/* ---------------------------------------------------------------- */}
        {/* Encabezado rojo                                                   */}
        {/* ---------------------------------------------------------------- */}
        <header className="flex flex-col gap-3 rounded-xl border border-rojo-300 bg-rojo-50 p-5 sm:flex-row sm:items-start sm:justify-between dark:border-rojo-700 dark:bg-rojo-950">
          <h1 className="text-2xl font-bold text-rojo-900 sm:text-3xl dark:text-rojo-100">
            {TITULO_PANTALLA_B}
          </h1>
          <div className="text-left leading-tight sm:shrink-0 sm:text-right">
            <p className="text-sm font-bold text-rojo-900 dark:text-rojo-100">
              {ROTULO_PRODUCTO_PANTALLA_B}
            </p>
            <p className="text-[11px] font-semibold tracking-wide text-rojo-800 uppercase dark:text-rojo-200">
              {ROTULO_MODO_PANTALLA_B}
            </p>
          </div>
        </header>

        <CasoVencido />

        {/* En pantallas anchas: actores y evidencia lado a lado. */}
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {/* ---------------------------------------------------------------- */}
        {/* ACTORES Y REGISTRO                                                */}
        {/* ---------------------------------------------------------------- */}
        <section
          aria-labelledby="b-actores"
          className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4"
        >
          <h2
            id="b-actores"
            className="text-xs font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200"
          >
            {TITULO_ACTORES_Y_REGISTRO}
          </h2>
          <dl className="flex flex-col gap-2">
            {ACTORES_PANTALLA_B.map((actor) => (
              <div
                key={actor.actor}
                className="flex flex-col gap-0.5 rounded-lg border border-borde-tenue bg-superficie-suave p-3 sm:flex-row sm:items-baseline sm:gap-3"
              >
                <dt className="text-sm font-bold text-titulo sm:w-40 sm:shrink-0">{actor.actor}</dt>
                <dd className="text-sm text-cuerpo">{actor.rol}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* EVIDENCIA CONSERVADA                                              */}
        {/* ---------------------------------------------------------------- */}
        <section
          aria-labelledby="b-evidencia"
          className="flex flex-col gap-3 rounded-lg border border-verde-300 bg-verde-50 p-4 dark:border-verde-700 dark:bg-verde-950"
        >
          <h2
            id="b-evidencia"
            className="text-xs font-bold tracking-wide text-verde-800 uppercase dark:text-verde-200"
          >
            {TITULO_EVIDENCIA_CONSERVADA}
          </h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-verde-900 dark:text-verde-100">
            {EVIDENCIA_CONSERVADA_PANTALLA_B.map((linea) => (
              <li key={linea}>{linea}</li>
            ))}
          </ul>
        </section>
        </div>

        <footer className="flex flex-col gap-3 border-t border-borde-tenue pt-3">
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 sm:self-start"
          >
            {ROTULO_BOTON_FINALIZAR_B}
          </Link>
        </footer>
      </main>
    </div>
  );
}
