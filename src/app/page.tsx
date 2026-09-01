import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_EXPEDIENTE } from "@/app/api/_http/contexto-peticion";
import { HeaderInstitucional, PieLegal } from "@/components/shared";
import { sufijoTitulo } from "@/domain/entidades";
import { flujoV3Activo } from "@/domain/flujo-vigente";
import { destinoDelExpediente } from "@/domain/rutas-flujo";
import { crearExpedienteRepository } from "@/repositories";
import { AceptacionInicioV3 } from "./InicioV3";

/**
 * La raíz del portal.
 *
 * **v2**: la pantalla P0 · Información no existe (gerencia, 20-ago-2026) y la
 * raíz redirige al paso 1 (`/plan`), conservada solo para no romper enlaces
 * guardados.
 *
 * **v3 (lote F5)**: la raíz ES el inicio del canvas — la página informativa
 * con los 3 pasos explicados y la casilla de T&C que crea el expediente
 * (DI-10, mudada desde el bloque provisional de `/inscripcion`). Fuente:
 * docs/ESPECIFICACION_PANTALLAS.md → "Inicio".
 */

export const metadata: Metadata = {
  title: `SeguroLoTengo · ${sufijoTitulo()}`,
  description:
    "Seguro de Vida Oncológico CONFÍO: protegé a tu familia en 3 pasos, desde tu celular.",
};

/**
 * Las cuatro fotos del carrusel, en el orden del canvas y con el rótulo que
 * el diseño imprime sobre cada una.
 */
const FOTOS_DEL_INICIO = [
  { archivo: "hero-inscribite.jpg", rotulo: "Inscribite con nosotros" },
  { archivo: "hero-seguro.jpg", rotulo: "Elegí tu seguro" },
  { archivo: "hero-paga-firma.jpg", rotulo: "Pagá y firmá" },
  { archivo: "hero-protege.jpg", rotulo: "Protege a tu familia" },
] as const;

const PASOS_EXPLICADOS = [
  {
    numero: "1",
    titulo: "Inscribite con nosotros",
    detalle: "Fotografiás tu cédula, leemos tus datos y vos los confirmás.",
  },
  {
    numero: "2",
    titulo: "Elegí tu seguro",
    detalle: "Compará los tres planes y respondé cuatro preguntas.",
  },
  {
    numero: "3",
    titulo: "Pagá y firmá",
    detalle: "Firma electrónica y pago seguro por Bancard.",
  },
] as const;

async function tramiteEmpezado(): Promise<{ ruta: string; rotulo: string } | null> {
  const expedienteId = (await cookies()).get(COOKIE_EXPEDIENTE)?.value;
  if (!expedienteId) return null;
  try {
    const expediente = await crearExpedienteRepository().obtenerPorId(expedienteId);
    if (!expediente) return null;
    const destino = destinoDelExpediente(expediente.estado);
    return { ruta: destino.ruta, rotulo: destino.rotulo };
  } catch {
    return null;
  }
}

export default async function Raiz() {
  if (!flujoV3Activo()) {
    redirect("/plan");
  }

  const tramite = await tramiteEmpezado();

  return (
    <div className="flex flex-1 flex-col bg-fondo">
      {/* Sin indicador de paso: el canvas no dibuja stepper en la bienvenida
          —empieza en el paso 1— y «P0 · INFORMACIÓN / FUERA DEL CONTADOR»
          es nomenclatura de v2, donde esa pantalla existía. */}
      <HeaderInstitucional />

      <main className="mx-auto flex w-full max-w-pantalla flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid items-center gap-6 lg:grid-cols-2">
          <header className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold text-titulo sm:text-3xl">
              Protege a tu familia, consigue su tranquilidad en 3 pasos
            </h1>
            <p className="text-base text-cuerpo">
              Todo desde tu celular, en unos minutos. Respaldado por Alianza Garantía e
              intermediado por Interseguros.
            </p>
          </header>
          {/* Las cuatro fotos del canvas con su rótulo, rotando en crossfade
              cada 3 s y en el orden del diseño (globals.css). */}
          <div className="v3-hero aspect-[16/10] w-full" aria-hidden="true">
            {FOTOS_DEL_INICIO.map((foto) => (
              <figure key={foto.archivo}>
                <img src={`/v3/${foto.archivo}`} alt="" />
                <figcaption>{foto.rotulo}</figcaption>
              </figure>
            ))}
          </div>
        </div>

        <section aria-label="Los tres pasos" className="v3-rejilla" style={{ "--v3-min": "220px" } as CSSProperties}>
          {PASOS_EXPLICADOS.map((paso) => (
            <div
              key={paso.numero}
              className="flex flex-col gap-1 rounded-xl border border-borde-sutil bg-superficie p-4"
            >
              <p className="text-2xl font-bold text-naranja-600">{paso.numero}</p>
              <p className="text-base font-bold text-titulo">{paso.titulo}</p>
              <p className="text-sm text-cuerpo">{paso.detalle}</p>
            </div>
          ))}
        </section>

        <section
          aria-label="Antes de empezar"
          className="flex flex-col gap-3 rounded-xl border border-borde-sutil bg-superficie p-4 sm:p-5"
        >
          <p className="text-[11px] font-semibold tracking-wide text-etiqueta uppercase">
            Antes de empezar
          </p>
          <p className="text-sm text-cuerpo">
            Usamos tu WhatsApp y tu correo solo para esta contratación: verificación, firma y
            entrega de documentos. Los datos quedan entre Interseguros S.A. y Alianza Garantía y
            no se ceden a terceros con fines comerciales.
          </p>
          {tramite ? (
            <Link
              href={tramite.ruta}
              className="inline-flex h-12 w-fit items-center rounded-lg bg-naranja-600 px-5 text-base font-bold text-white"
            >
              {tramite.rotulo} →
            </Link>
          ) : (
            <AceptacionInicioV3 />
          )}
        </section>

        <p className="text-xs text-etiqueta">
          Esta página es informativa. La contratación comienza recién en el paso 1 y la
          aceptación contractual ocurre al firmar.
        </p>
      </main>

      <PieLegal />
    </div>
  );
}
