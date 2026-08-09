import type { Metadata } from "next";
import Link from "next/link";
import { BarraPlanDelExpediente, HeaderInstitucional, StepperPasos } from "@/components/shared";
import { FormularioVerificacionCorreo } from "./FormularioVerificacionCorreo";
import { TarjetaWhatsappVerificado } from "./TarjetaWhatsappVerificado";

/**
 * P4 · Paso 4 de 9 — Verificación de correo.
 *
 * Fuente de verdad: docs/ESPECIFICACION_PANTALLAS.md → "P4 · Paso 4 de 9 —
 * Verificación de correo": *"Estructura idéntica a P1 pero para correo
 * electrónico"*.
 *
 * Todo lo estático se renderiza en el servidor; lo único que baja como
 * componente de cliente es el formulario, la tarjeta de WhatsApp verificado y
 * la barra de plan.
 */

export const metadata: Metadata = {
  title: "Verificá tu correo · SeguroLoTengo",
  description:
    "Paso 4 de 9: verificación del correo electrónico con un código diferente al de WhatsApp.",
};

const VALIDACIONES_DEL_PROCESO = [
  {
    rotulo: "OTP 1 · Completado",
    detalle: "WhatsApp personal verificado.",
    estado: "completado" as const,
  },
  {
    rotulo: "OTP 2 · Ahora",
    detalle: "Verificación independiente del correo.",
    estado: "actual" as const,
  },
  {
    rotulo: "Firma · más adelante",
    detalle: "Code100 validará y registrará la firma.",
    estado: "pendiente" as const,
  },
] as const;

/** Panel ilustrativo de la izquierda: no es un campo real, no recibe datos. */
function CorreoIlustrativo() {
  return (
    <aside className="flex flex-col gap-4 rounded-xl border border-borde-sutil bg-superficie p-5">
      <div className="mx-auto flex w-full max-w-[15rem] flex-col items-center gap-2 rounded-2xl border-4 border-azul-900 bg-superficie-suave p-5 dark:border-azul-600">
        <span aria-hidden="true" className="text-3xl">
          ✉️
        </span>
        <p className="text-center text-xs font-semibold text-etiqueta">
          Código de verificación
        </p>
        <p className="text-center text-[11px] font-semibold text-verde-700 dark:text-verde-300">
          Uso único · No lo compartas
        </p>
      </div>

      <div className="leading-tight">
        <p className="text-[11px] font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
          Correo personal
        </p>
        <p className="text-sm text-cuerpo">
          Debe ser una dirección activa a la que tengas acceso directo.
        </p>
      </div>

      <TarjetaWhatsappVerificado />
    </aside>
  );
}

export default function PantallaP4Correo() {
  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional indicador={<StepperPasos pasoActual={4} />} />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        <BarraPlanDelExpediente enlaceTexto="Cambiar plan" enlaceHref="/p2-plan" />

        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-titulo sm:text-3xl">
            Verificá tu correo electrónico
          </h1>
          <p className="text-base text-azul-700 dark:text-azul-200">
            Se va a usar para los avisos del proceso y la entrega de documentos electrónicos.
          </p>
          <p className="text-sm text-cuerpo">
            Este código es diferente al de WhatsApp: no contrata, no firma y no autoriza ningún
            cobro.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[20rem_1fr] lg:items-start">
          <CorreoIlustrativo />
          <FormularioVerificacionCorreo />
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
            Validaciones del proceso
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {VALIDACIONES_DEL_PROCESO.map(({ rotulo, detalle, estado }) => (
              <article
                key={rotulo}
                className={`flex flex-col gap-1 rounded-xl border p-4 ${
                  estado === "completado"
                    ? "border-verde-200 bg-verde-50 dark:border-verde-800 dark:bg-verde-950"
                    : estado === "actual"
                      ? "border-naranja-500 bg-naranja-50 dark:border-naranja-400 dark:bg-naranja-950"
                      : "border-borde-sutil bg-superficie"
                }`}
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
            href="/p3-preparacion"
            className="text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500"
          >
            ← Volver a la preparación
          </Link>
        </footer>
      </main>
    </div>
  );
}
