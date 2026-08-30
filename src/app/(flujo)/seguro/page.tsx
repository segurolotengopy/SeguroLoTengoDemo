import { sufijoTitulo } from "@/domain/entidades";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { COOKIE_EXPEDIENTE } from "@/app/api/_http/contexto-peticion";
import { esModoDemo } from "@/app/demo-panel/_sesion";
import {
  HeaderInstitucional,
  PestanasDeProducto,
  PieLegal,
  StepperPasos,
  TramiteEnOtroPaso,
} from "@/components/shared";
import { NOMBRE_PRODUCTO, REGISTRO_PRODUCTO } from "@/domain/catalogo";
import { flujoV3Activo } from "@/domain/flujo-vigente";
import { DETALLE_SEGURO_COMPLETO } from "@/domain/textos-reencaminado";
import type { EstadoExpediente, PlanId } from "@/domain/tipos";
import { crearExpedienteRepository } from "@/repositories";
import { expedienteEnOtroPaso } from "../_reencaminado";
import { Seguro } from "./Seguro";

/**
 * Paso 2 del flujo v3 · Elegí tu seguro — `/seguro` (lote F3).
 *
 * Fuente de verdad: docs/ESPECIFICACION_PANTALLAS.md → "Paso 2 · Elegí tu
 * seguro" y "El mapa 5→8", más el Bloque E de docs/plan/DECISIONES.md.
 * Patrón de `/inscripcion` (F2): existe solo con `FLUJO_V3=true`, el estado
 * del expediente decide qué sección está activa y cada envío refresca el
 * server component.
 */

export const metadata: Metadata = {
  title: `Elegí tu seguro · ${sufijoTitulo()}`,
  description: "Paso 2 de 3: plan, beneficiario y declaraciones.",
};

const ESTADOS_DE_LA_PAGINA: readonly EstadoExpediente[] = ["AUTORIZADO", "PLAN_SELECCIONADO"];

async function expedienteDeLaSesion(): Promise<{
  estado: EstadoExpediente;
  nombrePila: string | null;
  planElegido: PlanId | null;
} | null> {
  const expedienteId = (await cookies()).get(COOKIE_EXPEDIENTE)?.value;
  if (!expedienteId) return null;
  try {
    const expediente = await crearExpedienteRepository().obtenerPorId(expedienteId);
    if (!expediente) return null;
    return {
      estado: expediente.estado,
      nombrePila: expediente.identidad?.nombres.split(" ")[0] ?? null,
      planElegido: expediente.plan?.planId ?? null,
    };
  } catch {
    return null;
  }
}

export default async function PantallaSeguro() {
  if (!flujoV3Activo()) notFound();

  const enOtroPaso = await expedienteEnOtroPaso("/seguro");
  const sesion = await expedienteDeLaSesion();
  const propio = sesion && ESTADOS_DE_LA_PAGINA.includes(sesion.estado) ? sesion : null;

  return (
    <div className="flex flex-1 flex-col bg-fondo">
      <HeaderInstitucional indicador={<StepperPasos slug="/seguro" />} />

      <main className="mx-auto flex w-full max-w-pantalla flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-titulo sm:text-2xl">
            {propio?.nombrePila
              ? `${propio.nombrePila}, elegí el plan que más te convenga`
              : "Elegí el plan que más te convenga"}
          </h1>
        </header>

        <PestanasDeProducto etiquetaProximamente="PRONTO" />
        <p className="text-xs text-etiqueta">
          {NOMBRE_PRODUCTO} · producto inscrito {REGISTRO_PRODUCTO.codigo} · acto{" "}
          {REGISTRO_PRODUCTO.acto}. Los importes son premios anuales finales, IVA incluido.
          Todavía no estás firmando ni pagando.
        </p>

        {enOtroPaso ? (
          <TramiteEnOtroPaso
            destino={enOtroPaso}
            detalle={DETALLE_SEGURO_COMPLETO}
            modoDemo={esModoDemo()}
          />
        ) : propio ? (
          <Seguro
            estado={propio.estado}
            nombrePila={propio.nombrePila}
            planElegido={propio.planElegido}
          />
        ) : (
          <section className="flex flex-col gap-3 rounded-xl border border-borde-sutil bg-superficie p-4 sm:p-5">
            <p className="text-sm text-cuerpo">
              Todavía no tenés una inscripción empezada. El paso 1 verifica tu identidad y tus
              canales; con eso listo, acá elegís tu seguro.
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

      <PieLegal />
    </div>
  );
}
