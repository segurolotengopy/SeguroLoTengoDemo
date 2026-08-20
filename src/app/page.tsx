import { nombrePortal, sufijoTitulo } from "@/domain/entidades";
import { PASOS_FLUJO } from "@/domain/rutas-flujo";
import type { Metadata } from "next";
import Link from "next/link";
import { HeaderInstitucional, StepperPasos } from "@/components/shared";

/**
 * P0 · Información — página pública informativa, fuera del contador de pasos.
 *
 * Fuente de verdad: docs/ESPECIFICACION_PANTALLAS.md → "P0 · Información
 * (fuera del contador)". No solicita datos médicos ni PEP, no genera
 * propuesta, no cobra y no emite póliza: es una pantalla estática, sin
 * formularios, sin captura de dato personal alguno y sin expediente asociado.
 * La contratación empieza recién en P1.
 */

export const metadata: Metadata = {
  title: `${sufijoTitulo()} · Seguro de Vida Oncológico CONFÍO`,
  description:
    "Información pública sobre el Seguro de Vida Oncológico CONFÍO. Marca y canal digital de Interseguros S.A.",
};

/** Ruta de P1; la contratación comienza recién ahí. */
/**
 * A dónde entra quien decide empezar. Sale de la lista de pasos y no de una
 * constante escrita a mano: con CHG-01 el primer paso pasó a ser el catálogo,
 * y un literal acá habría dejado la puerta de entrada apuntando al paso 2.
 */
const RUTA_PRIMER_PASO = PASOS_FLUJO[0].slug;

/**
 * Banda de marca propia de la pantalla (P0 y P2 la usan con distinto texto a
 * la derecha). Queda local hasta que exista una segunda pantalla que la
 * necesite; no es uno de los componentes compartidos del flujo.
 */
function BandaMarca() {
  return (
    <div className="w-full border-b border-borde-tenue bg-superficie">
      <div className="mx-auto flex w-full max-w-pantalla flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm font-bold tracking-wide text-titulo uppercase">
          {nombrePortal()}
        </p>
        <p className="text-xs text-etiqueta">
          Marca y canal digital de Interseguros S.A.
        </p>
      </div>
    </div>
  );
}

const PRODUCTOS = [
  {
    nombre: "Seguro de Vida Oncológico",
    marca: "CONFÍO",
    disponible: true,
  },
  { nombre: "Seguro de Vida", marca: null, disponible: false },
  { nombre: "Accidentes Personales", marca: null, disponible: false },
  { nombre: "Responsabilidad Civil", marca: null, disponible: false },
] as const;

const ANTES_DE_CONTRATAR = [
  {
    titulo: "Coberturas y sumas",
    detalle: null,
  },
  {
    titulo: "Exclusiones y carencias",
    detalle: "Revisá 180, 30 y 1 día según cobertura.",
  },
  {
    titulo: "Siniestros y beneficios",
    detalle: null,
  },
  {
    titulo: "Privacidad y seguridad",
    detalle: null,
  },
] as const;

const AYUDA_Y_CONSULTAS = [
  "Preguntas frecuentes",
  "Contactar a Interseguros",
  "Consultas y reclamos",
] as const;

function TituloSeccion({ children }: { children: string }) {
  return (
    <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
      {children}
    </h2>
  );
}

export default function PantallaP0Informacion() {
  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional indicador={<StepperPasos variante="p0" />} />
      <BandaMarca />

      <main className="mx-auto flex w-full max-w-pantalla flex-col gap-10 px-4 py-8 sm:px-6 sm:py-10">
        {/* Bloque principal + panel de video */}
        <section className="grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-start">
          <div className="flex flex-col gap-4 rounded-xl border border-borde-sutil bg-superficie p-5 sm:p-7">
            <h1 className="text-2xl font-bold text-titulo sm:text-3xl">
              Protegé hoy lo que más importa mañana
            </h1>
            <p className="text-base leading-relaxed text-cuerpo">
              El Seguro de Vida Oncológico CONFÍO te da respaldo económico ante
              un diagnóstico de cáncer, y suma cobertura por fallecimiento,
              renta hospitalaria y gastos médicos por accidente.
            </p>

            <Link
              href={RUTA_PRIMER_PASO}
              // Tinta azul sobre el naranja de acción: hueso sobre naranja-500
              // da 2,8:1 y no llega al 4.5:1 de WCAG AA para texto de 14 px.
              className="inline-flex w-full items-center justify-center rounded-lg bg-naranja-500 px-5 py-3 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 sm:w-auto"
            >
              Elegí tu plan y cotizá →
            </Link>

            <p className="text-sm font-semibold text-verde-700 dark:text-verde-300">
              La contratación comienza recién en el paso 1.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-borde-sutil bg-superficie p-5 sm:p-6">
            <TituloSeccion>Video informativo</TituloSeccion>
            <div
              className="flex aspect-video w-full items-center justify-center rounded-lg border border-azul-200 bg-azul-50 dark:border-azul-700 dark:bg-azul-900"
              role="img"
              aria-label="Reproductor de video informativo"
            >
              <span
                aria-hidden="true"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-azul-800 text-lg text-hueso-50 dark:bg-azul-500"
              >
                ▶
              </span>
            </div>
            <p className="text-xs text-etiqueta">
              Qué cubre · Cómo funciona · Cómo contratar
            </p>
          </div>
        </section>

        {/* Productos disponibles */}
        <section className="flex flex-col gap-3">
          <TituloSeccion>Productos disponibles</TituloSeccion>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PRODUCTOS.map(({ nombre, marca, disponible }) => (
              <article
                key={nombre}
                className="flex flex-col gap-3 rounded-xl border border-borde-sutil bg-superficie p-4"
              >
                <div className="flex flex-col gap-1">
                  {marca ? (
                    <p className="text-[11px] font-bold tracking-wide text-naranja-600 uppercase dark:text-naranja-300">
                      {marca}
                    </p>
                  ) : null}
                  <p className="text-sm font-semibold text-titulo">{nombre}</p>
                </div>

                <span
                  className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ${
                    disponible
                      ? "bg-verde-100 text-verde-700 dark:bg-verde-900 dark:text-verde-200"
                      : "bg-azul-50 text-azul-600 dark:bg-azul-900 dark:text-azul-200"
                  }`}
                >
                  {disponible ? "Disponible" : "Próximamente"}
                </span>

                {disponible ? (
                  <a
                    href="#antes-de-contratar"
                    className="mt-auto inline-flex items-center justify-center rounded-lg border border-azul-700 px-4 py-2 text-xs font-bold tracking-wide text-azul-800 uppercase transition-colors hover:bg-azul-50 dark:border-azul-400 dark:text-azul-200 dark:hover:bg-azul-900"
                  >
                    Conocer
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        {/* Antes de contratar */}
        <section id="antes-de-contratar" className="flex flex-col gap-3">
          <TituloSeccion>Antes de contratar</TituloSeccion>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ANTES_DE_CONTRATAR.map(({ titulo, detalle }) => (
              <article
                key={titulo}
                className="flex flex-col gap-2 rounded-xl border border-borde-sutil bg-superficie p-4"
              >
                <h3 className="text-sm font-semibold text-titulo">{titulo}</h3>
                {detalle ? (
                  <p className="text-sm text-cuerpo">{detalle}</p>
                ) : null}
                <a
                  href="#"
                  className="mt-auto text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500 dark:hover:text-hueso-50"
                >
                  Ver información
                </a>
              </article>
            ))}
          </div>
        </section>

        {/* Ayuda y consultas */}
        <section className="flex flex-col gap-3">
          <TituloSeccion>Ayuda y consultas</TituloSeccion>
          <div className="flex flex-col gap-3 rounded-xl border border-borde-sutil bg-superficie p-5">
            <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-6">
              {AYUDA_Y_CONSULTAS.map((item) => (
                <li key={item}>
                  <a
                    href="#"
                    className="text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500 dark:hover:text-hueso-50"
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-xs text-etiqueta">
              Chat con IA: previsto para la versión 2.
            </p>
          </div>
        </section>

        {/* Banda verde inferior */}
        <p className="rounded-xl border border-verde-200 bg-verde-50 px-4 py-3 text-sm font-semibold text-verde-800 dark:border-verde-800 dark:bg-verde-950 dark:text-verde-200">
          Esta página es informativa: no solicita datos médicos ni condición
          PEP, no genera una propuesta, no realiza ningún cobro y no emite
          póliza.
        </p>
      </main>

      <footer className="mt-auto border-t border-borde-tenue bg-superficie">
        <div className="mx-auto w-full max-w-pantalla px-4 py-4 sm:px-6">
          <p className="text-xs text-etiqueta">
            Información pública · Versión 1 · Sin chat con inteligencia
            artificial
          </p>
        </div>
      </footer>
    </div>
  );
}
