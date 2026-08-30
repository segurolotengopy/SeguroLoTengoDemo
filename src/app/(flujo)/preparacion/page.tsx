import { sufijoTitulo } from "@/domain/entidades";
import type { Metadata } from "next";
import {
  BarraPlanDelExpediente,
  HeaderInstitucional,
  PieLegal,
  StepperPasos,
  TituloDePantalla,
  TramiteEnOtroPaso,
} from "@/components/shared";
import { esModoDemo } from "@/app/demo-panel/_sesion";
import { DETALLE_PREPARACION_YA_AUTORIZADA } from "@/domain/textos-reencaminado";
import { expedienteEnOtroPaso } from "../_reencaminado";
import { EDAD_MAXIMA_PERMITIDA, EDAD_MINIMA_PERMITIDA } from "@/domain/tipos";
import {
  ADVERTENCIA_AUTORIZACION_INICIAL_P3,
  CUERPO_AUTORIZACION_INICIAL_P3,
  DERIVACION_AUTORIZACION_INICIAL_P3,
  NOTA_REGISTRO_P3,
} from "@/domain/textos-p3";
import { BotonAutorizacionInicial } from "./BotonAutorizacionInicial";

/**
 * Paso 3 · Prepará lo necesario — `/preparacion`, en el formato de la maqueta
 * (`PantallasDemo2.pdf` p.2; reformulación en
 * `docs/plan/REFORMULACION_PANTALLAS_MAQUETA.md`): cuatro tarjetas numeradas
 * con ilustración, el aviso rojo `IMPORTANTE`, la caja azul del consentimiento
 * con candado y el botón `TENGO TODO LISTO Y CONTINUAR →`.
 *
 * En la maqueta este era el paso 2; el intercambio con la verificación de
 * WhatsApp se acordó en la reunión (00:05:49) y quedó fijado en `PASOS_FLUJO`.
 *
 * Esta pantalla **no solicita ningún dato**: informa qué hay que tener a mano
 * y toma el consentimiento inicial (fila 11 de la matriz de cumplimiento). El
 * acto de aceptación es el botón, con el literal a la vista.
 */

export const metadata: Metadata = {
  title: `Prepará lo necesario · ${sufijoTitulo()}`,
  description:
    "Paso 3: qué tener a mano antes de la validación. No solicita datos, no cobra y no firma documentos.",
};

/** Íconos de línea de las tarjetas. Decorativos: la información va en el texto. */
function Icono({ trazos }: { trazos: readonly string[] }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-12 w-12 shrink-0 text-azul-700 dark:text-azul-300"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {trazos.map((trazo) => (
        <path key={trazo} d={trazo} />
      ))}
    </svg>
  );
}

/**
 * Las cuatro tarjetas de la maqueta, con sus textos. La tercera se adapta al
 * orden definitivo: el WhatsApp ya quedó verificado en el paso 2, así que la
 * tarjeta lo dice en vez de anunciar una verificación que ya pasó.
 */
const TARJETAS: readonly {
  titulo: string;
  detalle: string;
  trazos: readonly string[];
}[] = [
  {
    titulo: "Cédula de identidad vigente",
    detalle:
      "Necesitaremos fotografiar el frente y el dorso. Los datos deben verse completos y sin reflejos.",
    trazos: ["M3 6h18v12H3z", "M6 10a1.6 1.6 0 103.2 0A1.6 1.6 0 006 10zM5.5 14.5c.5-1.4 3.7-1.4 4.2 0", "M13 9.5h5M13 12h5M13 14.5h3"],
  },
  {
    titulo: "Celular o computadora con cámara",
    detalle: "La cámara se utilizará para fotografiar la cédula y realizar una selfie en vivo.",
    trazos: ["M7 3h10v18H7z", "M10 18.5h4", "M9.5 10.5h5v4h-5z", "M12 9v1.5"],
  },
  {
    titulo: "WhatsApp y correo electrónico activos",
    detalle:
      "Tanto el WhatsApp como el correo deben ser de tu propiedad y estar accesibles. Tu número ya quedó verificado con el código.",
    trazos: ["M12 11l-4-1a4.5 4.5 0 112 .6z", "M4 15h16v6H4z", "M4 15l8 4 8-4"],
  },
  {
    titulo: "Medio de pago",
    detalle:
      "Podrás realizar el pago mediante QR Bancard o tarjeta. El cobro se realizará únicamente después de la firma.",
    trazos: ["M3 8h18v11H3z", "M3 11h18", "M6 15.5h4", "M14 14.5h4v2h-4z"],
  },
] as const;

const REQUISITOS_EMISION_AUTOMATICA =
  `Requisitos para la emisión automática: edad de ingreso entre ${EDAD_MINIMA_PERMITIDA} y ` +
  `${EDAD_MAXIMA_PERMITIDA} años, verificada con la cédula · las declaraciones de salud deben ` +
  "permitir la emisión · una condición de Persona Expuesta Políticamente deriva el caso a " +
  "análisis. Si el caso requiere análisis, la solicitud se detiene antes del pago y la " +
  "información se envía a Interseguros y Alianza Garantía.";

const AVISO_IMPORTANTE =
  "Este seguro no puede ser contratado a nombre de otras personas. Por ello, la cédula de " +
  "identidad, el número de WhatsApp, el correo electrónico y el medio de pago deberán " +
  "pertenecer necesariamente al asegurado.";

export default async function PantallaPreparacion() {
  const enOtroPaso = await expedienteEnOtroPaso("/preparacion");
  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional indicador={<StepperPasos slug="/preparacion" />} />

      <main className="mx-auto flex w-full max-w-pantalla flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <BarraPlanDelExpediente enlaceTexto="Cambiar plan" enlaceHref="/plan" />

        <TituloDePantalla
          titulo="Prepará lo necesario"
          subtitulo="Antes de comenzar la validación, asegurate de tener todo a mano."
        />

        {/* ---------------------------------------------------------------- */}
        {/* Las cuatro tarjetas numeradas de la maqueta                        */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {TARJETAS.map(({ titulo, detalle, trazos }, indice) => (
            <article
              key={titulo}
              className="flex flex-col gap-2 rounded-xl border-2 border-borde-sutil bg-superficie p-4"
            >
              <header className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-naranja-500 text-xs font-bold text-azul-950"
                >
                  {indice + 1}
                </span>
                <h2 className="text-sm font-bold text-titulo">{titulo}</h2>
              </header>
              <div className="flex items-start gap-3">
                <Icono trazos={trazos} />
                <p className="text-xs leading-relaxed text-cuerpo">{detalle}</p>
              </div>
            </article>
          ))}
        </div>

        {/* Aviso rojo IMPORTANTE (literal de la maqueta — regla inviolable #9). */}
        <div className="flex items-start gap-3 rounded-xl border-2 border-naranja-500 bg-superficie px-4 py-3">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="mt-0.5 h-8 w-8 shrink-0 text-naranja-600 dark:text-naranja-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM5 20c0-3.5 3.1-5.5 7-5.5s7 2 7 5.5" />
          </svg>
          <div className="flex flex-col gap-1">
            <p className="text-sm leading-relaxed font-semibold text-rojo-800 dark:text-rojo-300">
              <span className="font-bold">IMPORTANTE:</span> {AVISO_IMPORTANTE}
            </p>
            <p className="text-[11px] leading-snug text-rojo-800 dark:text-rojo-300">
              {REQUISITOS_EMISION_AUTOMATICA}
            </p>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Consentimiento (caja azul con candado) + botón, como la maqueta    */}
        {/* ---------------------------------------------------------------- */}
        {/* Con el trámite ya adelantado, el bloque de consentimiento y su botón
            se reemplazan por el reencaminado: pedir de nuevo una autorización
            ya dada, con un botón que el servidor va a rechazar, es la clase de
            callejón que este panel existe para cerrar. */}
        {enOtroPaso ? (
          <TramiteEnOtroPaso
            destino={enOtroPaso}
            detalle={DETALLE_PREPARACION_YA_AUTORIZADA}
            modoDemo={esModoDemo()}
          />
        ) : (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <div className="flex max-w-3xl items-start gap-3 rounded-xl border-2 border-azul-700 bg-superficie px-4 py-3 dark:border-azul-400">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="mt-0.5 h-7 w-7 shrink-0 text-azul-800 dark:text-azul-300"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 017 0v3M12 14.5v2" />
            </svg>
            <div className="flex flex-col gap-1">
              <p className="text-xs leading-relaxed font-semibold text-azul-800 dark:text-azul-200">
                {CUERPO_AUTORIZACION_INICIAL_P3}{" "}
                <span className="font-bold">{ADVERTENCIA_AUTORIZACION_INICIAL_P3}</span>
              </p>
              <p className="text-[11px] leading-snug text-azul-800 dark:text-azul-200">
                {DERIVACION_AUTORIZACION_INICIAL_P3}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-1">
            <BotonAutorizacionInicial />
            <p className="max-w-xs text-[11px] text-etiqueta">{NOTA_REGISTRO_P3}</p>
          </div>
        </div>
        )}
      </main>

      <PieLegal />
    </div>
  );
}
