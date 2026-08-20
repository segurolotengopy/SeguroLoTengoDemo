import { sufijoTitulo } from "@/domain/entidades";
import type { Metadata } from "next";
import {
  HeaderInstitucional,
  PieLegal,
  StepperPasos,
  TituloDePantalla,
} from "@/components/shared";
import { NOMBRE_PRODUCTO, PRODUCTOS, REGISTRO_PRODUCTO, urlVideoInformativo } from "@/domain/catalogo";
import {
  BAJADA_VIDEO_PLAN,
  INFORMACION_RELEVANTE,
  ROTULO_PRODUCTO_INSCRITO,
  SUBTITULO_PLAN,
  TITULO_INFORMACION_RELEVANTE,
  TITULO_VIDEO_PLAN,
} from "@/domain/textos-plan";
import { SelectorDePlanes } from "./SelectorDePlanes";

/**
 * Paso 1 · Selección del plan — `/plan`, en el formato de la maqueta
 * (`docs/antecedentes/PantallasDemo2.pdf`, p.1; reformulación explícita en
 * `docs/plan/REFORMULACION_PANTALLAS_MAQUETA.md`).
 *
 * De arriba hacia abajo, como la maqueta: pestañas de producto, título
 * centrado con el botón de video, línea del producto inscrito, las tres
 * tarjetas de plan, la franja `Información relevante`, y al pie la nota legal
 * junto al botón de continuar (dentro del selector, que es quien conoce el
 * estado).
 *
 * Los importes y coberturas NO están acá: viven en la tabla versionada
 * `src/domain/catalogo.ts` (D-04: los montos de la Matriz V4, provisionales;
 * los premios de la maqueta quedaron superados). Todo lo estático se renderiza
 * en el servidor; lo único con estado es el selector.
 */

export const metadata: Metadata = {
  title: `Elegí tu plan · ${sufijoTitulo()}`,
  description:
    "Paso 1: selección del plan del Seguro de Vida Oncológico CONFÍO. Todavía no se contrata ni se firma.",
};

/** Íconos de línea de la maqueta. Decorativos: la información va en el texto. */
function Icono({ trazo, className = "h-4 w-4" }: { trazo: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={trazo} />
    </svg>
  );
}

const TRAZOS = {
  persona: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.6-6 8-6s8 2 8 6",
  corazon: "M12 20s-7-4.6-9-9a5 5 0 019-3 5 5 0 019 3c-2 4.4-9 9-9 9z",
  escudo: "M12 3l7 2.5v5.2c0 4.6-3 8.2-7 10.3-4-2.1-7-5.7-7-10.3V5.5L12 3z",
  calendario: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  reloj: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
} as const;

/** Ícono por producto, como los dibuja la maqueta en cada pestaña. */
const ICONO_PRODUCTO: Readonly<Record<string, string>> = {
  VIDA_ONCOLOGICO: TRAZOS.persona,
  VIDA: TRAZOS.corazon,
  ACCIDENTES_PERSONALES: TRAZOS.persona,
  RESPONSABILIDAD_CIVIL: TRAZOS.escudo,
};

/**
 * Pestañas de producto (maqueta p.1). Absorben las fichas de P0: el
 * oncológico activo y los otros tres productos anunciados. Server-rendered:
 * hoy no hay otro producto al que navegar, así que las inactivas no son
 * botones que finjan serlo.
 */
function PestanasDeProducto() {
  return (
    <div className="flex flex-wrap gap-1 border-b-2 border-naranja-500" role="presentation">
      {PRODUCTOS.map((producto) => (
        <span
          key={producto.id}
          className={`inline-flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-xs font-bold tracking-wide uppercase ${
            producto.disponible
              ? "border-x border-t border-naranja-500 bg-naranja-50 text-naranja-800 dark:bg-naranja-950 dark:text-naranja-200"
              : "border-x border-t border-borde-tenue bg-superficie text-etiqueta"
          }`}
        >
          <Icono trazo={ICONO_PRODUCTO[producto.id] ?? TRAZOS.escudo} />
          {producto.nombre}
          {producto.disponible ? null : (
            <span className="ml-1 text-[9px] font-semibold">PRÓXIMAMENTE</span>
          )}
        </span>
      ))}
    </div>
  );
}

/**
 * Botón de video de la maqueta. Es el mismo material de P0 —un marcador de
 * demostración, sin video real detrás— presentado como la maqueta lo dibuja:
 * recuadro naranja con el play y las dos líneas.
 */
function VideoInformativo() {
  const url = urlVideoInformativo();
  const contenido = (
    <>
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-naranja-500 text-sm text-azul-950"
      >
        ▶
      </span>
      <span className="leading-tight">
        <span className="block text-[11px] font-bold tracking-wide text-naranja-800 uppercase dark:text-naranja-200">
          {TITULO_VIDEO_PLAN}
        </span>
        <span className="block text-[11px] text-naranja-800 dark:text-naranja-200">
          {BAJADA_VIDEO_PLAN}
        </span>
      </span>
    </>
  );
  const clase =
    "flex items-center gap-2.5 rounded-lg border border-naranja-400 bg-naranja-50 px-3 py-2 text-left dark:border-naranja-600 dark:bg-naranja-950";

  // Con URL configurada (`NEXT_PUBLIC_VIDEO_INFORMATIVO_URL`) es un enlace a
  // YouTube; sin ella queda como marcador de demo, sin fingir un video.
  return url ? (
    <a href={url} target="_blank" rel="noreferrer noopener" className={`${clase} hover:bg-naranja-100 dark:hover:bg-naranja-900`}>
      {contenido}
    </a>
  ) : (
    <div className={clase}>{contenido}</div>
  );
}

export default function PantallaSeleccionDePlan() {
  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional indicador={<StepperPasos slug="/plan" />} />

      <main className="mx-auto flex w-full max-w-pantalla flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <PestanasDeProducto />

        <TituloDePantalla
          titulo={NOMBRE_PRODUCTO}
          subtitulo={SUBTITULO_PLAN}
          accesorio={<VideoInformativo />}
        />

        {/* CHG-03 · identificación del producto registrado, centrada bajo el
            título como en la maqueta. Los valores reales los pasa Alianza
            (D-04): un código inventado se leería como real. */}
        <p className="-mt-2 text-center text-xs text-etiqueta">
          <span className="font-semibold text-cuerpo">{ROTULO_PRODUCTO_INSCRITO}</span>{" "}
          <span className="tabular-nums">{REGISTRO_PRODUCTO.codigo}</span> · Res. SS.SG. N.°{" "}
          <span className="tabular-nums">{REGISTRO_PRODUCTO.acto}</span>
          {REGISTRO_PRODUCTO.esProvisional ? (
            <span className="ml-2 rounded-full border border-naranja-300 bg-naranja-50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-naranja-800 uppercase dark:border-naranja-700 dark:bg-naranja-950 dark:text-naranja-200">
              Pendiente de Alianza
            </span>
          ) : null}
        </p>

        {/* La franja `Información relevante` entra por prop: la maqueta la
            dibuja entre las tarjetas y el pie, y el pie vive en el selector. */}
        <SelectorDePlanes
          entreTarjetasYPie={
            <section aria-label="Información relevante" className="flex flex-col gap-1.5">
              <h2 className="text-sm font-bold text-naranja-700 dark:text-naranja-300">
                {TITULO_INFORMACION_RELEVANTE}
              </h2>
              <dl className="grid gap-x-8 gap-y-2 rounded-xl border-2 border-borde-sutil bg-superficie px-4 py-3 sm:grid-cols-3">
                {INFORMACION_RELEVANTE.map(({ rotulo, detalle }, indice) => (
                  <div key={rotulo} className="flex items-start gap-2.5 leading-tight">
                    <Icono
                      trazo={[TRAZOS.persona, TRAZOS.calendario, TRAZOS.reloj][indice] ?? TRAZOS.reloj}
                      className="mt-0.5 h-6 w-6 text-azul-700 dark:text-azul-300"
                    />
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-[11px] font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
                        {rotulo}
                      </dt>
                      <dd className="text-xs text-cuerpo">{detalle}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </section>
          }
        />

      </main>

      <PieLegal />
    </div>
  );
}
