import { sufijoTitulo } from "@/domain/entidades";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { COOKIE_EXPEDIENTE } from "@/app/api/_http/contexto-peticion";
import { esModoDemo } from "@/app/demo-panel/_sesion";
import {
  BarraPlanDelExpediente,
  AvisoCtaFlotante,
  BandaPasosV3,
  HeaderInstitucional,
  PieLegal,
  TramiteEnOtroPaso,
} from "@/components/shared";
import { flujoV3Activo } from "@/domain/flujo-vigente";
import { ENCABEZADO_PASO_3 } from "@/domain/textos-pago-firma";
import { DETALLE_PAGO_Y_FIRMA } from "@/domain/textos-reencaminado";
import type { EstadoExpediente } from "@/domain/tipos";
import { crearExpedienteRepository } from "@/repositories";
import { expedienteEnOtroPaso } from "../_reencaminado";
import { PagoYFirma } from "./PagoYFirma";

/**
 * Paso 3 del flujo v3 · Pagá y firmá — `/pago-y-firma` (lote F4b).
 *
 * Fuente de verdad: docs/ESPECIFICACION_PANTALLAS.md → "Paso 3 · Pagá y
 * firmá" y el Bloque E. La firma del cliente es el acto INTERNO
 * (`firma-cliente.ts`, D1 ratificada el 30-ago-2026); las institucionales las
 * aplica el sondeo de siempre (mock de Code100, cualificadas). El pago es el
 * formulario v2 montado como sección, gated por `FIRMADO` (regla 6-bis).
 */

export const metadata: Metadata = {
  title: `Pagá y firmá · ${sufijoTitulo()}`,
  description: "Paso 3 de 3: firma electrónica y pago seguro por Bancard.",
};

const ESTADOS_DE_LA_PAGINA: readonly EstadoExpediente[] = [
  "DECLARACIONES_OK",
  "PAQUETE_GENERADO",
  "FIRMADO_CLIENTE",
  "FIRMADO",
];

async function expedienteDeLaSesion(): Promise<{
  estado: EstadoExpediente;
  nombrePila: string | null;
} | null> {
  const expedienteId = (await cookies()).get(COOKIE_EXPEDIENTE)?.value;
  if (!expedienteId) return null;
  try {
    const expediente = await crearExpedienteRepository().obtenerPorId(expedienteId);
    if (!expediente) return null;
    return {
      estado: expediente.estado,
      nombrePila: expediente.identidad?.nombres.split(" ")[0] ?? null,
    };
  } catch {
    return null;
  }
}

export default async function PantallaPagoYFirma() {
  if (!flujoV3Activo()) notFound();

  // FIRMADO es propio de esta página aunque el mapa lo diga igual: el
  // reencaminado no debe echar a quien está por pagar (mismo criterio que la
  // página v2 de pago con `tambienPropios`).
  const enOtroPaso = await expedienteEnOtroPaso("/pago-y-firma", ["FIRMADO"]);
  const sesion = await expedienteDeLaSesion();
  const propio = sesion && ESTADOS_DE_LA_PAGINA.includes(sesion.estado) ? sesion : null;

  return (
    <div className="flex flex-1 flex-col bg-fondo">
      {/* El canvas pone el progreso en una banda a lo ancho debajo de la
          cabecera, no como rótulo dentro de ella. */}
      <HeaderInstitucional />
      <BandaPasosV3 slug="/pago-y-firma" />

      <main className="mx-auto flex w-full max-w-pantalla flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <div className="overflow-hidden border border-borde-sutil bg-superficie" aria-hidden="true">
          {/* Foto del canvas para este paso (lote F5b). */}
          <img
            src="/v3/familia-paso-3.jpg"
            alt="Familia paraguaya reunida"
            className="v3-foto-paso w-full"
            style={{ height: "clamp(140px, 20vw, 210px)" }}
          />
        </div>

        {/* El canvas pone la barra del plan debajo de la foto, no encima. */}
        <BarraPlanDelExpediente enlaceTexto="cambiar plan" enlaceHref="/seguro" />

        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-titulo sm:text-2xl">
            {propio?.nombrePila
              ? `${propio.nombrePila}, pagá y firmá tu contrato`
              : "Pagá y firmá tu contrato"}
          </h1>
          <p className="text-sm text-cuerpo">{ENCABEZADO_PASO_3}</p>
        </header>

        {enOtroPaso ? (
          <TramiteEnOtroPaso
            destino={enOtroPaso}
            detalle={DETALLE_PAGO_Y_FIRMA}
            modoDemo={esModoDemo()}
          />
        ) : propio ? (
          <PagoYFirma
            estado={propio.estado}
            nombrePila={propio.nombrePila}
            pagoSimuladoDisponible={esModoDemo()}
          />
        ) : (
          <section className="flex flex-col gap-3 rounded-xl border border-borde-sutil bg-superficie p-4 sm:p-5">
            <p className="text-sm text-cuerpo">
              Todavía no tenés un trámite listo para firmar. El paso 1 verifica tu identidad y el
              paso 2 arma tu propuesta; con eso cerrado, acá firmás y pagás.
            </p>
            <Link
              href="/inscripcion"
              className="inline-flex h-11 w-fit items-center rounded-lg bg-naranja-600 px-4 text-sm font-bold text-white"
            >
              Empezá tu inscripción →
            </Link>
          </section>
        )}
      </main>

      {/* La píldora del canvas que avisa dónde está el botón principal. */}
      <AvisoCtaFlotante />
      <PieLegal />
    </div>
  );
}
