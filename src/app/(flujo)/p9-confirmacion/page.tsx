import type { Metadata } from "next";
import Link from "next/link";
import { HeaderInstitucional, StepperPasos } from "@/components/shared";
import {
  BAJADA_P9,
  CONTACTOS_P9,
  PASOS_QUE_OCURRIRA_P9,
  ROTULO_BOTON_FINALIZAR_P9,
  ROTULO_PRODUCTO_P9,
  TITULO_P9,
  TITULO_QUE_OCURRIRA_P9,
} from "@/domain/textos-p9";
import { ContratacionAceptada } from "./ContratacionAceptada";

/**
 * P9 · Paso 9 de 9 — Contratación aceptada.
 *
 * Fuente de verdad: docs/ESPECIFICACION_PANTALLAS.md → "P9 · Paso 9 de 9 —
 * Contratación aceptada". Se llega solo desde P8, con los dos documentos
 * firmados en un mismo acto y la garantía de pago resuelta.
 *
 * Respaldo normativo del conjunto: filas 39, 40, 43, 47 y 50 de la matriz de
 * cumplimiento (Res. SS SG. 215/15, art. 1, punto 14 y Anexo 1 numeral 6.13.14;
 * Ley 6822/21, arts. 38(2), 43 y 44-46; Ley 4868/13, arts. 31-32; Ley 125/91,
 * art. 85; Código Civil, arts. 1348, 1373 y 1374).
 *
 * **No se genera Nota de Cobertura** y la póliza no se descarga desde acá: la
 * emite y la envía Alianza Garantía a los canales verificados. Del portal solo
 * salen la Solicitud y el FIPF firmados.
 *
 * Sin barra de plan seleccionado: la barra va de P3 a P8, y acá la contratación
 * ya está cerrada.
 */

export const metadata: Metadata = {
  title: "Contratación aceptada · SeguroLoTengo",
  description:
    "Paso 9 de 9: la solicitud fue aceptada; Alianza Garantía emitirá y enviará la póliza a los canales verificados.",
  // Es el desenlace de un expediente concreto, no una página pública.
  robots: { index: false, follow: false },
};

export default function PantallaP9Confirmacion() {
  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional indicador={<StepperPasos pasoActual={9} />} />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        {/* ---------------------------------------------------------------- */}
        {/* Encabezado verde                                                  */}
        {/* ---------------------------------------------------------------- */}
        <header className="flex flex-col gap-3 rounded-xl border border-verde-300 bg-verde-50 p-5 sm:flex-row sm:items-start sm:justify-between dark:border-verde-700 dark:bg-verde-950">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold text-verde-900 sm:text-3xl dark:text-verde-100">
              {TITULO_P9}
            </h1>
            <p className="text-sm text-verde-900 dark:text-verde-100">{BAJADA_P9}</p>
          </div>
          <p className="text-left text-sm font-bold text-verde-900 sm:shrink-0 sm:text-right dark:text-verde-100">
            {ROTULO_PRODUCTO_P9}
          </p>
        </header>

        <ContratacionAceptada />

        {/* ---------------------------------------------------------------- */}
        {/* ¿QUÉ OCURRIRÁ AHORA?                                              */}
        {/* ---------------------------------------------------------------- */}
        <section
          aria-labelledby="p9-que-ocurrira"
          className="flex flex-col gap-3 rounded-xl border border-borde-sutil bg-superficie p-5"
        >
          <h2
            id="p9-que-ocurrira"
            className="text-xs font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200"
          >
            {TITULO_QUE_OCURRIRA_P9}
          </h2>
          <ol className="flex flex-col gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-4">
            {PASOS_QUE_OCURRIRA_P9.map((paso, indice) => (
              <li
                key={paso}
                className="flex flex-col gap-1 rounded-lg border border-borde-tenue bg-superficie-suave p-3"
              >
                <span className="text-[11px] font-bold text-etiqueta">{indice + 1}</span>
                <span className="text-sm text-cuerpo">{paso}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Pie: contactos y cierre                                           */}
        {/* ---------------------------------------------------------------- */}
        <footer className="flex flex-col gap-4 border-t border-borde-tenue pt-4">
          <dl className="flex flex-col gap-2">
            {CONTACTOS_P9.map((contacto) => (
              <div
                key={contacto.actor}
                className="flex flex-col gap-0.5 rounded-lg border border-borde-tenue bg-superficie-suave p-3"
              >
                <dt className="text-sm font-bold text-titulo">{contacto.actor}</dt>
                <dd className="text-xs text-cuerpo">
                  {contacto.rol} · {contacto.datos}
                </dd>
              </div>
            ))}
          </dl>

          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 sm:self-start"
          >
            {ROTULO_BOTON_FINALIZAR_P9}
          </Link>
        </footer>
      </main>
    </div>
  );
}
