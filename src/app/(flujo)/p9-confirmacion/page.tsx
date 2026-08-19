import type { Metadata } from "next";
import Link from "next/link";
import {
  HeaderInstitucional,
  IsologoAlianza,
  IsologoInterseguros,
  StepperPasos,
} from "@/components/shared";
import {
  BAJADA_P9,
  CONTACTOS_P9,
  LEYENDA_CIERRE_P9,
  ROTULO_BOTON_FINALIZAR_P9,
  ROTULO_PRODUCTO_P9,
  TITULO_P9,
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

      <main className="mx-auto flex w-full max-w-pantalla flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
        {/* ---------------------------------------------------------------- */}
        {/* Encabezado verde                                                  */}
        {/* ---------------------------------------------------------------- */}
        <header className="flex flex-col gap-2 rounded-lg border border-verde-300 bg-verde-50 p-3 sm:flex-row sm:items-baseline sm:justify-between dark:border-verde-700 dark:bg-verde-950">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
            <h1 className="shrink-0 text-xl font-bold text-verde-900 sm:text-2xl dark:text-verde-100">
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
        {/* Pie: cierre y contactos con isologos, debajo del botón            */}
        {/* ---------------------------------------------------------------- */}
        <footer className="flex flex-col gap-3 border-t border-borde-tenue pt-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 sm:self-start"
          >
            {ROTULO_BOTON_FINALIZAR_P9}
          </Link>

          <p className="text-sm font-semibold text-azul-800 dark:text-azul-200">
            {LEYENDA_CIERRE_P9}
          </p>

          <dl className="grid gap-2 lg:grid-cols-2">
            {CONTACTOS_P9.map((contacto, indice) => (
              <div
                key={contacto.actor}
                className="flex items-center gap-3 rounded-lg border border-borde-tenue bg-superficie-suave p-2.5"
              >
                {indice === 0 ? <IsologoAlianza tamano={32} /> : <IsologoInterseguros tamano={32} />}
                <div className="flex flex-col gap-0.5">
                  <dt className="text-sm font-bold text-titulo">{contacto.actor}</dt>
                  <dd className="text-xs text-cuerpo">
                    {contacto.rol} · {contacto.datos}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </footer>
      </main>
    </div>
  );
}
