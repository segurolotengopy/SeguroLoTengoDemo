import type { Metadata } from "next";
import Link from "next/link";
import { HeaderInstitucional, StepperPasos } from "@/components/shared";
import { LONGITUD_CODIGO_OTP } from "@/domain/reglas-otp";
import { FormularioVerificacionWhatsapp } from "./FormularioVerificacionWhatsapp";

/**
 * P1 · Paso 1 de 9 — Verificación de WhatsApp.
 *
 * Fuente de verdad: docs/ESPECIFICACION_PANTALLAS.md → "P1 · Paso 1 de 9 —
 * Verificación de WhatsApp". Textos, bloques y advertencias salen de ahí.
 *
 * Todo lo estático se renderiza en el servidor; lo único que baja como
 * componente de cliente es el formulario, que es la parte con estado.
 */

export const metadata: Metadata = {
  title: "Verificá tu WhatsApp · SeguroLoTengo",
  description:
    "Paso 1 de 9: verificación del WhatsApp personal. Todavía no es una contratación.",
};

const VALIDACIONES_INDEPENDIENTES = [
  {
    rotulo: "OTP 1 · Pantalla 1",
    detalle: "Verifica tu WhatsApp.",
  },
  {
    rotulo: "OTP 2 · Pantalla 4",
    detalle: "Código diferente para el correo.",
  },
  {
    rotulo: "Firma · más adelante",
    detalle: "Code100 validará y registrará la firma.",
  },
] as const;

function BandaInicioSeguro() {
  return (
    <div className="w-full border-b border-borde-tenue bg-superficie">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
        <div className="leading-tight">
          <p className="text-[11px] font-bold tracking-wide text-verde-700 uppercase dark:text-verde-300">
            Inicio seguro
          </p>
          <p className="text-sm text-cuerpo">
            Verificación inicial de tu WhatsApp personal
          </p>
        </div>
        <p className="max-w-md text-xs font-semibold text-naranja-700 sm:text-right dark:text-naranja-300">
          Todavía no es una contratación — No se selecciona plan, no se firma y no se realiza
          ningún cobro.
        </p>
      </div>
    </div>
  );
}

/** Panel ilustrativo de la izquierda: no es un campo real, no recibe datos. */
function TelefonoIlustrativo() {
  return (
    <aside className="flex flex-col gap-4 rounded-xl border border-borde-sutil bg-superficie p-5">
      <div className="mx-auto w-full max-w-[15rem] rounded-2xl border-4 border-azul-900 bg-superficie-suave p-4 dark:border-azul-600">
        <p className="text-center text-xs font-semibold text-etiqueta">
          Código de verificación
        </p>
        <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
          {Array.from({ length: LONGITUD_CODIGO_OTP }, (_, indice) => (
            <span
              key={indice}
              className="h-8 w-6 rounded border border-borde-sutil bg-superficie"
            />
          ))}
        </div>
        <p className="mt-3 text-center text-[11px] font-semibold text-verde-700 dark:text-verde-300">
          Uso único · No lo compartas
        </p>
      </div>

      <div className="leading-tight">
        <p className="text-[11px] font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
          WhatsApp personal
        </p>
        <p className="text-sm text-cuerpo">
          El mensaje contendrá un código de uso único para esta verificación.
        </p>
      </div>
    </aside>
  );
}

export default function PantallaP1Whatsapp() {
  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional indicador={<StepperPasos pasoActual={1} />} />
      <BandaInicioSeguro />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-titulo sm:text-3xl">
            Verificá tu WhatsApp personal
          </h1>
          <p className="text-base text-azul-700 dark:text-azul-200">
            Va a ser el primer canal verificado y deberá permanecer activo durante todo el proceso.
          </p>
          <p className="text-sm text-cuerpo">
            El código solo valida el canal: no contrata, no firma y no autoriza ningún cobro.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[20rem_1fr] lg:items-start">
          <TelefonoIlustrativo />
          <FormularioVerificacionWhatsapp />
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            Tres validaciones independientes
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {VALIDACIONES_INDEPENDIENTES.map(({ rotulo, detalle }) => (
              <article
                key={rotulo}
                className="flex flex-col gap-1 rounded-xl border border-borde-sutil bg-superficie p-4"
              >
                <p className="text-[11px] font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
                  {rotulo}
                </p>
                <p className="text-sm text-cuerpo">{detalle}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-borde-tenue pt-4">
          <Link
            href="/"
            className="text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500"
          >
            ← Volver a la información
          </Link>
        </footer>
      </main>
    </div>
  );
}
