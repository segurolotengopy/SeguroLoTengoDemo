import type { Metadata } from "next";
import Link from "next/link";
import { HeaderInstitucional } from "@/components/shared";
import { CONTACTOS_PANTALLA_A } from "@/domain/textos-pantalla-a";
import {
  BAJADA_ASISTENCIA_IDENTIDAD,
  CONSEJOS_REINTENTO,
  HITOS_ASISTENCIA,
  LEYENDA_CASO_DISTINTO,
  LEYENDA_NO_ES_RECHAZO_IDENTIDAD,
  PUNTOS_SIN_CONTRATACION,
  ROTULO_BOTON_INICIO,
  ROTULO_BOTON_REINTENTAR,
  ROTULO_MODO_ASISTENCIA,
  ROTULO_PRODUCTO_ASISTENCIA,
  TEXTO_ASISTENCIA_HUMANA,
  TEXTO_PODES_REINTENTAR,
  TITULO_ASISTENCIA_HUMANA,
  TITULO_ASISTENCIA_IDENTIDAD,
  TITULO_CASO_ASISTENCIA,
  TITULO_PODES_REINTENTAR,
  TITULO_QUE_CONVIENE_REVISAR,
  TITULO_SIN_CONTRATACION,
} from "@/domain/textos-asistencia-identidad";
import { DatosDelCaso } from "./DatosDelCaso";

/**
 * Pantalla de asistencia de identidad.
 *
 * Se llega desde P5 cuando el análisis falla tres veces
 * (`INTENTOS_IDENTIDAD_ANTES_DE_ASISTENCIA`). **No es la Pantalla A**: aquella
 * se llega desde P6 por una declaración incompatible o PEP, y su texto lo dice.
 * Acá no hay nada en contra de la persona y su cédula **no queda bloqueada**.
 *
 * Fuera del contador de 9 pasos y sin barra de plan seleccionado, igual que
 * las pantallas A y B: no hay una contratación en curso.
 *
 * Es **decisión de producto**: no figura en `ESPECIFICACION_PANTALLAS.md` como
 * una de las 12 pantallas originales ni tiene fila en la matriz de
 * cumplimiento. Ver §11 de `docs/RECOMENDACIONES_ONBOARDING_IDENTIDAD.md`.
 */

export const metadata: Metadata = {
  title: "No pudimos verificar tu identidad · SeguroLoTengo",
  description:
    "El sistema no pudo verificar la identidad automáticamente. No es un rechazo: un asesor puede ayudarte a completar la verificación.",
};

const ICONO_HITO: Readonly<Record<string, string>> = {
  COMPLETADO: "✓",
  DERIVACION: "⚠",
  PENDIENTE: "⋯",
};

export default function PantallaAsistenciaIdentidad() {
  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional
        indicador={
          <span className="rounded-full bg-naranja-100 px-3 py-1 text-[11px] font-bold tracking-wide text-naranja-800 uppercase dark:bg-naranja-950 dark:text-naranja-200">
            {ROTULO_MODO_ASISTENCIA}
          </span>
        }
      />

      <main className="mx-auto flex w-full max-w-pantalla flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <header className="flex flex-col gap-2 rounded-lg border border-naranja-300 bg-naranja-50 p-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6 dark:border-naranja-700 dark:bg-naranja-950">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold text-titulo sm:text-2xl">
              {TITULO_ASISTENCIA_IDENTIDAD}
            </h1>
            <p className="text-sm text-cuerpo">{BAJADA_ASISTENCIA_IDENTIDAD}</p>
          </div>
          <p className="shrink-0 text-[11px] font-bold tracking-wide text-etiqueta uppercase">
            {ROTULO_PRODUCTO_ASISTENCIA}
          </p>
        </header>

        <section className="rounded-lg border border-borde-sutil bg-superficie p-4">
          <h2 className="mb-3 text-[11px] font-bold tracking-wide text-etiqueta uppercase">
            Estado del caso
          </h2>
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {HITOS_ASISTENCIA.map((hito) => (
              <li key={hito.numero} className="flex flex-col gap-0.5 rounded-md bg-superficie-suave p-3">
                <span className="text-sm font-bold text-titulo">
                  {ICONO_HITO[hito.estado]} {hito.numero}. {hito.titulo}
                </span>
                <span className="text-xs text-cuerpo">{hito.detalle}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-lg border border-borde-sutil bg-superficie p-4">
          <h2 className="mb-3 text-[11px] font-bold tracking-wide text-etiqueta uppercase">
            {TITULO_CASO_ASISTENCIA}
          </h2>
          <DatosDelCaso />
        </section>

        <section className="rounded-lg border border-verde-300 bg-verde-50 p-4 dark:border-verde-700 dark:bg-verde-950">
          <h2 className="mb-1.5 text-[11px] font-bold tracking-wide text-verde-800 uppercase dark:text-verde-200">
            {TITULO_PODES_REINTENTAR}
          </h2>
          <p className="text-sm text-cuerpo">{TEXTO_PODES_REINTENTAR}</p>
        </section>

        <section className="rounded-lg border border-borde-sutil bg-superficie p-4">
          <h2 className="mb-2 text-[11px] font-bold tracking-wide text-etiqueta uppercase">
            {TITULO_QUE_CONVIENE_REVISAR}
          </h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-cuerpo">
            {CONSEJOS_REINTENTO.map((consejo) => (
              <li key={consejo}>{consejo}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-rojo-300 bg-rojo-50 p-4 dark:border-rojo-700 dark:bg-rojo-950">
          <h2 className="mb-2 text-[11px] font-bold tracking-wide text-rojo-800 uppercase dark:text-rojo-200">
            {TITULO_SIN_CONTRATACION}
          </h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-cuerpo">
            {PUNTOS_SIN_CONTRATACION.map((punto) => (
              <li key={punto}>{punto}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-borde-sutil bg-superficie p-4">
          <h2 className="mb-1.5 text-[11px] font-bold tracking-wide text-etiqueta uppercase">
            {TITULO_ASISTENCIA_HUMANA}
          </h2>
          <p className="mb-3 text-sm text-cuerpo">{TEXTO_ASISTENCIA_HUMANA}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {CONTACTOS_PANTALLA_A.filter((contacto) =>
              contacto.organizacion.startsWith("Interseguros"),
            ).map((contacto) => (
              <li
                key={contacto.organizacion}
                className="rounded-md bg-superficie-suave p-3 text-sm text-cuerpo"
              >
                <p className="font-bold text-titulo">{contacto.organizacion}</p>
                <p className="text-xs text-etiqueta">{contacto.rol}</p>
                <p className="mt-1">{contacto.telefono}</p>
                <p>{contacto.correo}</p>
              </li>
            ))}
          </ul>
        </section>

        <footer className="flex flex-col gap-3 border-t border-borde-tenue pt-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/p1-whatsapp"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-naranja-600 px-4 text-sm font-bold tracking-wide text-white uppercase transition-colors hover:bg-naranja-700 dark:bg-naranja-500 dark:hover:bg-naranja-600"
            >
              {ROTULO_BOTON_REINTENTAR}
            </Link>
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-lg border-2 border-borde-sutil px-4 text-sm font-semibold text-cuerpo transition-colors hover:bg-superficie-suave"
            >
              {ROTULO_BOTON_INICIO}
            </Link>
          </div>
          <p className="text-xs text-etiqueta">{LEYENDA_NO_ES_RECHAZO_IDENTIDAD}</p>
          <p className="text-xs text-etiqueta">{LEYENDA_CASO_DISTINTO}</p>
        </footer>
      </main>
    </div>
  );
}
