import type { Metadata } from "next";
import Link from "next/link";
import { HeaderInstitucional, PieLegal, TituloDePantalla } from "@/components/shared";
import { CORREO_RETRACTO_Y_DATOS, sufijoTitulo } from "@/domain/entidades";
import {
  BLOQUES_PRIVACIDAD,
  FALTA_DEFINICION_LEGAL,
  PARRAFOS_COOKIES,
  TITULO_COOKIES,
  TITULO_PRIVACIDAD,
  VERSION_COOKIES,
  VERSION_PRIVACIDAD,
} from "@/domain/textos-legales";

/**
 * Datos personales y cookies — **filas 84 y 85** de la matriz
 * (Ley 4868/13, arts. 6(a), 7(b) y 30(c); Constitución Nacional, arts. 33 y 36).
 *
 * Las dos van en la misma página porque son la misma pregunta desde el lado de
 * quien lee: qué se guarda de mí y qué se hace con eso.
 *
 * **Pendiente de aprobación de Legal**, con un hueco: los plazos de
 * conservación. Ver `docs/plan/PROPUESTAS_TEXTOS_LEGALES_L6.md` (P-03 y P-04).
 */

export const metadata: Metadata = {
  title: `${TITULO_PRIVACIDAD} · ${sufijoTitulo()}`,
  description:
    "Qué datos pedimos, para qué, quién los trata, qué no hacemos con ellos y cómo ejercer tus derechos.",
};

export default function PantallaPrivacidad() {
  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional />

      <main className="mx-auto flex w-full max-w-pantalla flex-1 flex-col gap-4 px-4 py-5 sm:px-6">
        <TituloDePantalla
          titulo={TITULO_PRIVACIDAD}
          subtitulo="Qué pedimos, para qué, y qué no hacemos con lo que nos das."
        />

        <section className="flex flex-col gap-4 rounded-lg border border-borde-sutil bg-superficie p-5">
          {BLOQUES_PRIVACIDAD.map(({ titulo, texto }) => (
            <div key={titulo} className="flex flex-col gap-1">
              <h2 className="text-xs font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
                {titulo}
              </h2>
              <p className="text-sm leading-relaxed text-cuerpo">
                {texto === `${FALTA_DEFINICION_LEGAL}.` ? (
                  <mark className="rounded border border-dashed border-rojo-400 bg-rojo-50 px-1 text-xs font-bold text-rojo-800 dark:bg-rojo-950 dark:text-rojo-200">
                    {FALTA_DEFINICION_LEGAL}
                  </mark>
                ) : (
                  texto
                )}
              </p>
            </div>
          ))}

          <p className="text-sm leading-relaxed text-cuerpo">
            Para ejercer cualquiera de esos derechos, escribinos a{" "}
            <a
              href={`mailto:${CORREO_RETRACTO_Y_DATOS}`}
              className="font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-300 dark:decoration-azul-600"
            >
              {CORREO_RETRACTO_Y_DATOS}
            </a>
            .
          </p>
        </section>

        {/* El ancla la usa el enlace del aviso de cookies. */}
        <section
          id="cookies"
          className="flex scroll-mt-4 flex-col gap-2 rounded-lg border border-borde-sutil bg-superficie p-5"
        >
          <h2 className="text-xs font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            {TITULO_COOKIES}
          </h2>
          {PARRAFOS_COOKIES.map((parrafo) => (
            <p key={parrafo.slice(0, 40)} className="text-sm leading-relaxed text-cuerpo">
              {parrafo}
            </p>
          ))}
        </section>

        <p className="text-[11px] text-etiqueta">
          Textos en revisión de asesoría legal · versiones {VERSION_PRIVACIDAD} y {VERSION_COOKIES}
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
