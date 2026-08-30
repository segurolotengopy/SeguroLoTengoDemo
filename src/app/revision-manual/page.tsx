import { sufijoTitulo } from "@/domain/entidades";
import type { Metadata } from "next";
import { HeaderInstitucional, StepperPasos } from "@/components/shared";
import {
  BAJADA_PANTALLA_A,
  CONTACTOS_PANTALLA_A,
  HITOS_CASO,
  LEYENDA_CORRELATIVO_DISTINTO,
  LEYENDA_NO_ES_RECHAZO,
  PASOS_SIGUIENTES,
  PUNTOS_INFORMACION_ENVIADA,
  PUNTOS_SIN_EMISION,
  REGLA_DEL_SISTEMA_PANTALLA_A,
  ROTULO_BOTON_FINALIZAR,
  ROTULO_MODO_PANTALLA_A,
  ROTULO_PRODUCTO_PANTALLA_A,
  TEXTO_AUTORIZACION_OTORGADA,
  TITULO_AUTORIZACION_OTORGADA,
  TITULO_INFORMACION_ENVIADA,
  TITULO_PANTALLA_A,
  TITULO_QUE_OCURRIRA,
  TITULO_SIN_EMISION,
} from "@/domain/textos-pantalla-a";
import { ResumenDelCaso } from "./ResumenDelCaso";

/**
 * Pantalla A · Emisión no automática (derivación a revisión manual).
 *
 * Fuente de verdad: docs/ESPECIFICACION_PANTALLAS.md → "Pantalla A · Emisión
 * no automática (derivación a revisión manual)". Se llega solo desde P6,
 * cuando una declaración de las 1, 2, 3 u 8 es incompatible (regla de negocio
 * inviolable #5).
 *
 * **Fuera del contador de 9 pasos**: usa la variante `pantalla-a` del stepper
 * y no lleva barra de plan seleccionado — la barra va de P3 a P8, y acá el
 * plan dejó de estar en juego porque no hay contratación en curso.
 *
 * Todo lo estático se renderiza en el servidor. Lo único que baja como
 * componente de cliente es `ResumenDelCaso`, que va a buscar el número de caso
 * y el motivo a `GET /api/expediente/caso`.
 */

export const metadata: Metadata = {
  title: `Tu solicitud requiere una revisión adicional · ${sufijoTitulo()}`,
  description:
    "Pantalla A: la póliza no puede emitirse automáticamente; el caso se derivó a Interseguros y Alianza Garantía.",
};

const ICONO_HITO: Readonly<Record<string, string>> = {
  COMPLETADO: "✓",
  DERIVACION: "⚠",
  PENDIENTE: "⋯",
};

export default function PantallaARevisionManual() {
  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional indicador={<StepperPasos variante="pantalla-a" />} />

      <main className="mx-auto flex w-full max-w-pantalla flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
        {/* ---------------------------------------------------------------- */}
        {/* Encabezado rojo                                                   */}
        {/* ---------------------------------------------------------------- */}
        <header className="flex flex-col gap-3 rounded-xl border border-rojo-300 bg-rojo-50 p-5 sm:flex-row sm:items-start sm:justify-between dark:border-rojo-700 dark:bg-rojo-950">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold text-rojo-900 sm:text-3xl dark:text-rojo-100">
              {TITULO_PANTALLA_A}
            </h1>
            <p className="text-sm text-rojo-900 dark:text-rojo-100">{BAJADA_PANTALLA_A}</p>
          </div>
          <div className="shrink-0 text-left leading-tight sm:text-right">
            <p className="text-[11px] font-semibold tracking-wide text-rojo-700 uppercase dark:text-rojo-300">
              {ROTULO_PRODUCTO_PANTALLA_A}
            </p>
            <p className="text-[11px] font-bold tracking-wide text-rojo-800 uppercase dark:text-rojo-200">
              {ROTULO_MODO_PANTALLA_A}
            </p>
          </div>
        </header>

        {/* En pantallas anchas los recuadros van lado a lado, en angostas
            apilados. */}
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {/* ---------------------------------------------------------------- */}
        {/* ESTADO DEL CASO — cuatro hitos                                    */}
        {/* ---------------------------------------------------------------- */}
        <section className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4">
          <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            Estado del caso
          </h2>
          <ol className="flex flex-col gap-2">
            {HITOS_CASO.map((hito) => (
              <li key={hito.numero} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    hito.estado === "COMPLETADO"
                      ? "bg-verde-600 text-white dark:bg-verde-500"
                      : hito.estado === "DERIVACION"
                        ? "bg-rojo-600 text-white dark:bg-rojo-500"
                        : "border border-borde-sutil bg-superficie-suave text-etiqueta"
                  }`}
                >
                  {ICONO_HITO[hito.estado]}
                </span>
                <div className="flex flex-col">
                  <p className="text-sm font-semibold text-titulo">
                    {hito.numero}. {hito.titulo}
                  </p>
                  <p
                    className={`text-xs ${
                      hito.estado === "DERIVACION"
                        ? "font-semibold text-rojo-700 dark:text-rojo-300"
                        : "text-etiqueta"
                    }`}
                  >
                    {hito.detalle}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* CASO DERIVADO PARA ANÁLISIS                                       */}
        {/* ---------------------------------------------------------------- */}
        <ResumenDelCaso />

        {/* ---------------------------------------------------------------- */}
        {/* NO SE INICIÓ LA EMISIÓN                                           */}
        {/* ---------------------------------------------------------------- */}
        <section className="flex flex-col gap-2 rounded-lg border border-rojo-300 bg-rojo-50 p-4 dark:border-rojo-700 dark:bg-rojo-950">
          <h2 className="text-[11px] font-bold tracking-wide text-rojo-800 uppercase dark:text-rojo-200">
            {TITULO_SIN_EMISION}
          </h2>
          <ul className="flex flex-col gap-1">
            {PUNTOS_SIN_EMISION.map((punto) => (
              <li key={punto} className="flex items-start gap-2 text-sm text-rojo-900 dark:text-rojo-100">
                <span aria-hidden="true" className="mt-0.5 shrink-0 font-bold">
                  ×
                </span>
                {punto}
              </li>
            ))}
          </ul>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* INFORMACIÓN ENVIADA PARA EL ANÁLISIS + AUTORIZACIÓN YA OTORGADA   */}
        {/* ---------------------------------------------------------------- */}
        <section className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4">
          <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            {TITULO_INFORMACION_ENVIADA}
          </h2>
          <ul className="flex flex-col gap-2">
            {PUNTOS_INFORMACION_ENVIADA.map((punto) => (
              <li key={punto} className="flex items-center gap-2 text-sm">
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-verde-600 text-xs font-bold text-white dark:bg-verde-500"
                >
                  ✓
                </span>
                <span className="text-titulo">{punto}</span>
                <span className="sr-only">enviado</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-1 rounded-lg border border-verde-300 bg-verde-50 px-4 py-3 dark:border-verde-700 dark:bg-verde-950">
            <p className="text-[11px] font-bold tracking-wide text-verde-800 uppercase dark:text-verde-200">
              {TITULO_AUTORIZACION_OTORGADA}
            </p>
            <p className="text-sm text-verde-900 dark:text-verde-100">
              {TEXTO_AUTORIZACION_OTORGADA}
            </p>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* ¿QUÉ OCURRIRÁ AHORA?                                              */}
        {/* ---------------------------------------------------------------- */}
        <section className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4">
          <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            {TITULO_QUE_OCURRIRA}
          </h2>
          <ol className="grid gap-3 sm:grid-cols-2">
            {PASOS_SIGUIENTES.map((paso) => (
              <li
                key={paso.numero}
                className="flex flex-col gap-1 rounded-lg border border-borde-tenue bg-superficie-suave p-3"
              >
                <p className="text-sm font-bold text-titulo">
                  {paso.numero}. {paso.titulo}
                </p>
                <p className="text-xs text-cuerpo">{paso.detalle}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Pie: contactos, regla del sistema y salida                        */}
        {/* ---------------------------------------------------------------- */}
        <section className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4">
          <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            Contactos
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {CONTACTOS_PANTALLA_A.map((contacto) => (
              <div key={contacto.organizacion} className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold text-titulo">{contacto.organizacion}</p>
                <p className="text-[11px] font-semibold tracking-wide text-etiqueta uppercase">
                  {contacto.rol}
                </p>
                <p className="text-xs text-cuerpo">Teléfono: {contacto.telefono}</p>
                <p className="text-xs text-cuerpo">Correo: {contacto.correo}</p>
              </div>
            ))}
          </div>

          {/* Cierra el trámite en este navegador antes de volver: si no, la
              selección de plan reconoce el expediente terminado y recibe con
              "Ya tenés un trámite empezado" a quien acaba de terminarlo.
              POST y no enlace porque `next/link` precarga los href. */}
          <form action="/api/flujo/cerrar" method="post" className="shrink-0">
            <button type="submit" className="inline-flex h-12 items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 sm:self-start">
              {ROTULO_BOTON_FINALIZAR}
            </button>
          </form>
        </section>
        </div>

        <footer className="flex flex-col gap-2 border-t border-borde-tenue pt-3">
          <p className="text-sm font-semibold text-verde-700 dark:text-verde-300">
            {LEYENDA_NO_ES_RECHAZO}
          </p>
          <p className="text-xs text-etiqueta">{REGLA_DEL_SISTEMA_PANTALLA_A}</p>
          <p className="text-xs text-etiqueta">{LEYENDA_CORRELATIVO_DISTINTO}</p>
        </footer>
      </main>
    </div>
  );
}
