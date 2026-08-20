import { sufijoTitulo } from "@/domain/entidades";
import type { Metadata } from "next";
import Link from "next/link";
import {
  BarraPlanDelExpediente,
  EnlaceAclaracion,
  HeaderInstitucional,
  StepperPasos,
} from "@/components/shared";
import { EDAD_MAXIMA_PERMITIDA, EDAD_MINIMA_PERMITIDA } from "@/domain/tipos";
import {
  ADVERTENCIA_AUTORIZACION_INICIAL_P3,
  CUERPO_AUTORIZACION_INICIAL_P3,
  NOTA_REGISTRO_P3,
} from "@/domain/textos-p3";
import { BotonAutorizacionInicial } from "./BotonAutorizacionInicial";

/**
 * P3 · Paso 3 de 9 — Preparación y autorización inicial.
 *
 * Fuente de verdad: docs/ESPECIFICACION_PANTALLAS.md → "P3 · Paso 3 de 9 —
 * Preparación y autorización inicial".
 *
 * Layout compacto por decisión de producto (2026-08): los cinco elementos y
 * los cuatro requisitos van en un recuadro cada uno, con el botón inmediato;
 * a la derecha, los textos informativos y la autorización, para que en
 * pantallas anchas todo entre sin scroll.
 *
 * Esta pantalla **no solicita ningún dato**: informa qué hay que tener a mano
 * y toma el consentimiento inicial. Lo único que baja como componente de
 * cliente es el botón de autorización y la barra de plan.
 */

export const metadata: Metadata = {
  title: `Prepará lo necesario · ${sufijoTitulo()}`,
  description:
    "Paso 3 de 9: qué tener a mano y autorización inicial para comenzar. No solicita datos, no cobra y no firma documentos.",
};

const ELEMENTOS_NECESARIOS = [
  {
    titulo: "Cédula paraguaya vigente",
    detalle:
      "El documento original, frente y dorso, legible y sin reflejos. No se acepta pasaporte ni cédula extranjera.",
  },
  {
    // CHG-13 · el requisito admite computadora, no solo celular: la captura y
    // la prueba de vida funcionan igual desde una webcam (verificación E2E de
    // escritorio pendiente, PEN-03).
    titulo: "Celular o computadora con cámara y buena iluminación",
    detalle:
      "Para fotografiar la cédula, realizar la selfie en vivo y completar la prueba de vida.",
  },
  {
    titulo: "WhatsApp personal activo",
    detalle:
      "Va a recibir un código propio; tenés que conservar acceso al número durante todo el proceso.",
  },
  {
    titulo: "Correo electrónico activo",
    detalle: "Va a recibir un código diferente; se usa para avisos y documentos electrónicos.",
  },
  {
    titulo: "Medio de pago disponible",
    detalle:
      "QR Bancard: se paga antes de firmar. Tarjeta: según modalidad habilitada. No hay cobro en esta pantalla.",
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
      <HeaderInstitucional indicador={<StepperPasos slug="/preparacion" />} />

      <main className="mx-auto flex w-full max-w-pantalla flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <BarraPlanDelExpediente enlaceTexto="Cambiar plan" enlaceHref="/plan" />

        <header className="flex flex-col gap-1 lg:flex-row lg:items-baseline lg:gap-4">
          <h1 className="shrink-0 text-xl font-bold text-titulo sm:text-2xl">
            Prepará lo necesario
          </h1>
          <p className="text-sm text-cuerpo">
            Antes de empezar, asegurate de tener estos cinco elementos a mano.
          </p>
        </header>

        {/* Dos columnas en pantallas anchas; apilado en angostas. */}
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr] lg:items-start">
          <div className="flex flex-col gap-3">
            {/* Un solo recuadro con los cinco elementos. */}
            <section className="flex flex-col gap-2 rounded-lg border border-borde-sutil bg-superficie p-3">
              <h2 className="text-xs font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
                Tené a mano
              </h2>
              <ol className="flex flex-col gap-1.5">
                {ELEMENTOS_NECESARIOS.map(({ titulo, detalle }, indice) => (
                  <li key={titulo} className="flex gap-2 text-sm leading-snug">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-azul-800 text-[10px] font-bold text-hueso-50 dark:bg-azul-500"
                    >
                      {indice + 1}
                    </span>
                    <p className="text-cuerpo">
                      <span className="font-bold text-titulo">{titulo}:</span> {detalle}
                    </p>
                  </li>
                ))}
              </ol>
            </section>

            {/* Un solo recuadro con los cuatro requisitos. */}
            <section className="flex flex-col gap-2 rounded-lg border border-borde-sutil bg-superficie p-3">
              <h2 className="text-xs font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
                Antes de iniciar: requisitos para la emisión automática
              </h2>
              <ul className="flex flex-col gap-1.5">
                {REQUISITOS_EMISION_AUTOMATICA.map(({ titulo, detalle }) => (
                  <li key={titulo} className="text-sm leading-snug text-cuerpo">
                    <span className="font-bold text-titulo">{titulo}:</span> {detalle}
                  </li>
                ))}
              </ul>
            </section>

            {/* CHG-11 · aviso de titularidad. Va destacado y en su propio
                recuadro, no como una viñeta más: es la regla que la persona
                tiene que entender antes de gastar tiempo en el trámite, porque
                un medio de pago ajeno lo detiene al final, después de firmar. */}
            <section className="flex gap-3 rounded-lg border-2 border-naranja-400 bg-naranja-50 p-3 dark:border-naranja-600 dark:bg-naranja-950">
              <span aria-hidden="true" className="text-xl leading-none">
                👤
              </span>
              <p className="text-sm leading-snug text-cuerpo">
                <span className="font-bold text-naranja-800 dark:text-naranja-200">
                  IMPORTANTE:
                </span>{" "}
                este seguro no puede ser contratado a nombre de otras personas. Por ello, la
                cédula de identidad, el número de WhatsApp, el correo electrónico y el medio de
                pago deberán pertenecer necesariamente{" "}
                <span className="font-bold text-titulo">al mismo asegurado</span>.
              </p>
            </section>

            <div id="autorizacion-inicial" className="scroll-mt-4">
              <BotonAutorizacionInicial />
            </div>
          </div>

          {/* Columna derecha: textos informativos y autorización, sin recuadro. */}
          <aside className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-azul-800 dark:text-azul-200">
              La cobertura comenzará 24 horas después del pago confirmado, una vez completada la
              contratación y la firma del cliente.
            </p>

            <p className="text-sm font-semibold text-verde-700 dark:text-verde-300">
              {ADVERTENCIA_AUTORIZACION_INICIAL_P3}
            </p>

            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <EnlaceAclaracion documento="avisoPrivacidad">Aviso de privacidad</EnlaceAclaracion>
              <EnlaceAclaracion documento="terminosCondiciones">
                Términos y condiciones
              </EnlaceAclaracion>
            </div>

            {/* CHG-12 · el disclaimer de protección de datos gana el candado
                que pidió la reunión (00:04:25: "aquí el disclaimer está sin
                logo, sin un isotipo"). El ícono es decorativo —`aria-hidden`—
                porque el texto ya dice todo: para quien usa lector de pantalla
                sería ruido, no información.

                Las dos partes juntas (cuerpo + advertencia) son, palabra por
                palabra, el literal que el servidor persiste como `textoAceptado`. */}
            <div className="flex gap-3 rounded-lg border border-azul-200 bg-azul-50 p-3 dark:border-azul-700 dark:bg-azul-950">
              <span aria-hidden="true" className="text-lg leading-none">
                🔒
              </span>
              <p className="text-xs leading-snug text-cuerpo">
                {CUERPO_AUTORIZACION_INICIAL_P3}
              </p>
            </div>

            <p className="text-xs text-etiqueta">{NOTA_REGISTRO_P3}</p>
          </aside>
        </div>

        <footer className="flex flex-col gap-2 border-t border-borde-tenue pt-3">
          <Link
            href="/whatsapp"
            className="text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500"
          >
            ← Volver a la verificación de WhatsApp
          </Link>
        </footer>
      </main>
    </div>
  );
}
