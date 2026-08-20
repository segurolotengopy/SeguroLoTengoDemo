import type { Metadata } from "next";
import Link from "next/link";
import { HeaderInstitucional, PieLegal, TituloDePantalla } from "@/components/shared";
import { CORREO_RETRACTO_Y_DATOS, sufijoTitulo } from "@/domain/entidades";
import {
  FALTA_DEFINICION_LEGAL,
  PARRAFOS_RETRACTO,
  TITULO_RETRACTO,
  VERSION_RETRACTO,
} from "@/domain/textos-legales";

/**
 * Derecho de retracto — **fila 64** de la matriz de cumplimiento
 * (Ley 4868/13, arts. 30(b) y 26(f); Ley 1334/98, arts. 26-27).
 *
 * Página informativa, fuera del contador de 8 pasos: se llega desde el pie de
 * cualquier pantalla y no forma parte del flujo de contratación.
 *
 * **Está pendiente de aprobación de Legal**, y dos datos faltan: el plazo y
 * desde cuándo se cuenta. La fila manda informar el derecho y no fija ninguno
 * de los dos, así que van como marcador visible en vez de un número inventado.
 * Detalle en `docs/plan/PROPUESTAS_TEXTOS_LEGALES_L6.md` (P-02).
 */

export const metadata: Metadata = {
  title: `${TITULO_RETRACTO} · ${sufijoTitulo()}`,
  description:
    "Cómo retractarse de una contratación celebrada por medios electrónicos, y a dónde comunicarlo.",
};

/** Resalta el marcador para que nadie lo lea como un dato definido. */
function ParrafoConMarcador({ texto }: { texto: string }) {
  const partes = texto.split(FALTA_DEFINICION_LEGAL);
  return (
    <p className="text-sm leading-relaxed text-cuerpo">
      {partes.map((parte, indice) => (
        <span key={indice}>
          {parte}
          {indice < partes.length - 1 ? (
            <mark className="rounded border border-dashed border-rojo-400 bg-rojo-50 px-1 text-xs font-bold text-rojo-800 dark:bg-rojo-950 dark:text-rojo-200">
              {FALTA_DEFINICION_LEGAL}
            </mark>
          ) : null}
        </span>
      ))}
    </p>
  );
}

export default function PantallaRetracto() {
  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional />

      <main className="mx-auto flex w-full max-w-pantalla flex-1 flex-col gap-4 px-4 py-5 sm:px-6">
        <TituloDePantalla
          titulo={TITULO_RETRACTO}
          subtitulo="Podés dejar sin efecto la contratación, y así se hace."
        />

        <section className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-5">
          {PARRAFOS_RETRACTO.map((parrafo) => (
            <ParrafoConMarcador key={parrafo.slice(0, 40)} texto={parrafo} />
          ))}

          <p className="text-sm leading-relaxed text-cuerpo">
            Escribinos a{" "}
            <a
              href={`mailto:${CORREO_RETRACTO_Y_DATOS}`}
              className="font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-300 dark:decoration-azul-600"
            >
              {CORREO_RETRACTO_Y_DATOS}
            </a>
            .
          </p>
        </section>

        <p className="text-[11px] text-etiqueta">
          Texto en revisión de asesoría legal · versión {VERSION_RETRACTO}
        </p>

        <Link
          href="/plan"
          className="text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-300 dark:decoration-azul-600"
        >
          ← Volver
        </Link>
      </main>

      <PieLegal />
    </div>
  );
}
