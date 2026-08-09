import type { Metadata } from "next";
import Link from "next/link";
import { BarraPlanDelExpediente, HeaderInstitucional, StepperPasos } from "@/components/shared";
import { EDAD_MAXIMA_PERMITIDA, EDAD_MINIMA_PERMITIDA } from "@/domain/tipos";
import { BotonAutorizacionInicial } from "./BotonAutorizacionInicial";

/**
 * P3 · Paso 3 de 9 — Preparación y autorización inicial.
 *
 * Fuente de verdad: docs/ESPECIFICACION_PANTALLAS.md → "P3 · Paso 3 de 9 —
 * Preparación y autorización inicial".
 *
 * Esta pantalla **no solicita ningún dato**: informa qué hay que tener a mano
 * y toma el consentimiento inicial. Lo único que baja como componente de
 * cliente es el bloque de autorización y la barra de plan.
 */

export const metadata: Metadata = {
  title: "Prepará lo necesario · SeguroLoTengo",
  description:
    "Paso 3 de 9: qué tener a mano y autorización inicial para comenzar. No solicita datos, no cobra y no firma documentos.",
};

const ELEMENTOS_NECESARIOS = [
  {
    titulo: "Cédula paraguaya vigente",
    detalle: "El documento original, frente y dorso, legible y sin reflejos.",
    nota: "No se acepta pasaporte ni cédula extranjera.",
  },
  {
    titulo: "Celular con cámara y buena iluminación",
    detalle:
      "Para fotografiar la cédula, realizar la selfie en vivo y completar la prueba de vida.",
    nota: null,
  },
  {
    titulo: "WhatsApp personal activo",
    detalle:
      "Va a recibir un código propio; tenés que conservar acceso al número durante todo el proceso.",
    nota: null,
  },
  {
    titulo: "Correo electrónico activo",
    detalle: "Va a recibir un código diferente; se usa para avisos y documentos electrónicos.",
    nota: null,
  },
  {
    titulo: "Medio de pago disponible",
    detalle: "QR Bancard: se paga antes de firmar. Tarjeta: según modalidad habilitada.",
    nota: "No hay cobro en esta pantalla.",
  },
] as const;

const REQUISITOS_EMISION_AUTOMATICA = [
  {
    titulo: "Solo para el titular",
    detalle:
      "El seguro únicamente puede contratarse para uno mismo; no se admite contratar para otra persona.",
  },
  {
    titulo: "Edad permitida",
    detalle: `Entre ${EDAD_MINIMA_PERMITIDA} y ${EDAD_MAXIMA_PERMITIDA} años, verificada con la cédula.`,
  },
  {
    titulo: "Salud y condición PEP",
    detalle:
      "Las declaraciones médicas y la condición PEP deben permitir la emisión automática; las preguntas se hacen más adelante.",
  },
  {
    titulo: "Si el caso requiere análisis",
    detalle:
      "Se detiene antes del pago y no se emite; se genera un número de caso distinto y la información se envía a Interseguros y Alianza.",
  },
] as const;

export default function PantallaP3Preparacion() {
  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional indicador={<StepperPasos pasoActual={3} />} />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        <BarraPlanDelExpediente enlaceTexto="Cambiar plan" enlaceHref="/p2-plan" />

        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-titulo sm:text-3xl">Prepará lo necesario</h1>
          <p className="text-base text-azul-700 dark:text-azul-200">
            Antes de empezar, asegurate de tener estos cinco elementos a mano.
          </p>
          <p className="text-sm text-cuerpo">
            Esta pantalla no solicita datos, no realiza ningún cobro y no firma documentos.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ELEMENTOS_NECESARIOS.map(({ titulo, detalle, nota }, indice) => (
            <article
              key={titulo}
              className="flex flex-col gap-2 rounded-xl border border-borde-sutil bg-superficie p-4"
            >
              <span
                aria-hidden="true"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-azul-800 text-xs font-bold text-hueso-50 dark:bg-azul-500"
              >
                {indice + 1}
              </span>
              <h2 className="text-sm font-bold text-titulo">{titulo}</h2>
              <p className="text-sm text-cuerpo">{detalle}</p>
              {nota ? (
                <p className="text-xs font-semibold text-verde-700 dark:text-verde-300">{nota}</p>
              ) : null}
            </article>
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            Antes de iniciar: requisitos para la emisión automática
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {REQUISITOS_EMISION_AUTOMATICA.map(({ titulo, detalle }) => (
              <article
                key={titulo}
                className="flex flex-col gap-1 rounded-xl border border-borde-sutil bg-superficie p-4"
              >
                <h3 className="text-sm font-bold text-titulo">{titulo}</h3>
                <p className="text-sm text-cuerpo">{detalle}</p>
              </article>
            ))}
          </div>
        </section>

        <p className="rounded-xl border border-azul-200 bg-azul-50 px-4 py-3 text-sm font-semibold text-azul-800 dark:border-azul-800 dark:bg-azul-950 dark:text-azul-200">
          La cobertura comenzará 24 horas después del pago confirmado, una vez completada la
          contratación y la firma del cliente.
        </p>

        <div id="autorizacion-inicial" className="scroll-mt-4">
          <BotonAutorizacionInicial />
        </div>

        <footer className="flex flex-col gap-2 border-t border-borde-tenue pt-4">
          <Link
            href="/p2-plan"
            className="text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500"
          >
            ← Volver a la selección de plan
          </Link>
        </footer>
      </main>
    </div>
  );
}
