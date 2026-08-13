"use client";

import { useState } from "react";
import { EnlaceAclaracion } from "@/components/shared";
import {
  formatearGuaranies,
  NOMBRE_PRODUCTO,
  OFERTA_VIGENTE,
  PRODUCTOS,
} from "@/domain/catalogo";
import type { Plan } from "@/domain/catalogo";
import type { PlanId } from "@/domain/tipos";

/**
 * Selector de producto y de plan de P2
 * (docs/ESPECIFICACION_PANTALLAS.md → "P2 · Paso 2 de 9").
 *
 * Ningún importe ni cobertura está escrito acá: todo sale de
 * `src/domain/catalogo.ts`, que es la tabla versionada. Este componente solo
 * decide qué tarjeta se ve elegida y manda el `planId` al servidor.
 *
 * El `idVersionOferta` y el hash SHA-256 no se calculan ni se mandan desde el
 * navegador —serían un dato que el cliente podría falsear—: los pone el caso
 * de uso del servidor a partir de la misma tabla.
 */

interface RespuestaApi {
  readonly ok?: boolean;
  readonly motivo?: string;
}

const MENSAJES: Readonly<Record<string, string>> = {
  PLAN_INVALIDO: "Ese plan no está disponible. Elegí uno de los tres.",
  EXPEDIENTE_NO_ENCONTRADO: "Se perdió la sesión. Volvé a verificar tu WhatsApp.",
  SESION_INVALIDA: "Se perdió la sesión. Volvé a verificar tu WhatsApp.",
  ESTADO_INVALIDO: "Este proceso ya no está en el paso de selección de plan.",
  CUERPO_INVALIDO: "No pudimos procesar el pedido. Intentá de nuevo.",
};

interface FilaCobertura {
  readonly etiqueta: string;
  readonly valor: (plan: Plan) => string;
  readonly destacada?: boolean;
}

const COBERTURAS: readonly FilaCobertura[] = [
  {
    etiqueta: "Muerte por cualquier causa",
    valor: (plan) => formatearGuaranies(plan.muerteCualquierCausaGs),
  },
  {
    etiqueta: "Indemnización por cáncer (pago único)",
    valor: (plan) => formatearGuaranies(plan.indemnizacionCancerGs),
  },
  {
    etiqueta: "Renta hospitalaria (máx. 15 días por vigencia)",
    valor: (plan) =>
      `${formatearGuaranies(plan.rentaHospitalariaTotalGs)} (${formatearGuaranies(
        plan.rentaHospitalariaPorDiaGs,
      )} por día)`,
  },
  {
    etiqueta: "Gastos médicos por accidente (reembolso hasta)",
    valor: (plan) => formatearGuaranies(plan.gastosMedicosAccidenteGs),
  },
  {
    etiqueta: "Premio total anual (IVA incluido)",
    valor: (plan) => formatearGuaranies(plan.premioAnualGs),
    destacada: true,
  },
];

function TarjetaPlan({
  plan,
  elegido,
  onElegir,
}: {
  plan: Plan;
  elegido: boolean;
  onElegir: () => void;
}) {
  return (
    <article
      className={`flex flex-col gap-2 rounded-lg border p-3 ${
        elegido
          ? "border-naranja-500 bg-naranja-50 dark:border-naranja-400 dark:bg-naranja-950"
          : "border-borde-sutil bg-superficie"
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <h3 className="text-base font-bold text-titulo">{plan.nombre}</h3>
        {elegido ? (
          <span className="shrink-0 rounded-full bg-verde-600 px-2.5 py-1 text-[10px] font-bold tracking-wide text-hueso-50 uppercase">
            ✓ Seleccionado
          </span>
        ) : null}
      </header>

      <dl className="flex flex-col gap-1">
        {COBERTURAS.map(({ etiqueta, valor, destacada }) => (
          <div
            key={etiqueta}
            className={`flex items-baseline justify-between gap-3 ${
              destacada ? "border-t border-borde-tenue pt-1.5" : ""
            }`}
          >
            <dt className="text-xs text-etiqueta">{etiqueta}</dt>
            <dd
              className={`shrink-0 text-right ${
                destacada
                  ? "text-sm font-bold text-titulo tabular-nums"
                  : "text-xs font-semibold text-titulo tabular-nums"
              }`}
            >
              {valor(plan)}
            </dd>
          </div>
        ))}
      </dl>

      <EnlaceAclaracion
        documento="coberturas"
        className="text-xs font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500"
      >
        Ver coberturas, exclusiones y condiciones
      </EnlaceAclaracion>

      <button
        type="button"
        onClick={onElegir}
        aria-pressed={elegido}
        className={`inline-flex h-9 w-full items-center justify-center rounded-lg px-5 text-xs font-bold tracking-wide uppercase transition-colors ${
          elegido
            ? "bg-verde-600 text-hueso-50 hover:bg-verde-500"
            : "border-2 border-azul-700 text-azul-700 hover:bg-azul-50 dark:border-azul-300 dark:text-azul-200 dark:hover:bg-azul-950"
        }`}
      >
        {elegido ? "Plan elegido" : "Seleccionar"}
      </button>
    </article>
  );
}

export function SelectorDePlanes() {
  const [planElegido, setPlanElegido] = useState<PlanId | null>(null);
  const [enProceso, setEnProceso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = planElegido ? OFERTA_VIGENTE.planes.find((p) => p.id === planElegido) : undefined;

  async function continuar() {
    if (!plan) return;
    setEnProceso(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/p2/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });
      const datos = (await respuesta.json().catch(() => ({}))) as RespuestaApi;

      if (!datos.ok) {
        setError(
          (datos.motivo && MENSAJES[datos.motivo]) ?? "No pudimos guardar el plan. Intentá de nuevo.",
        );
        return;
      }

      window.location.assign("/p3-preparacion");
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setEnProceso(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ------------------------------------------------------------------ */}
      {/* Selector de producto                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 leading-tight">
          <h2 className="text-lg font-bold text-titulo">¿Qué seguro estás buscando?</h2>
          <p className="text-sm text-cuerpo">Primero elegí el producto.</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {PRODUCTOS.map((producto) => (
            <button
              key={producto.id}
              type="button"
              disabled={!producto.disponible}
              aria-pressed={producto.disponible}
              className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg border px-3 py-2 text-left ${
                producto.disponible
                  ? "border-naranja-500 bg-naranja-50 dark:border-naranja-400 dark:bg-naranja-950"
                  : "cursor-not-allowed border-borde-sutil bg-superficie opacity-60"
              }`}
            >
              <span className="text-sm font-semibold text-titulo">{producto.nombre}</span>
              {producto.disponible ? null : (
                <span className="text-[10px] font-bold tracking-wide text-etiqueta uppercase">
                  Próximamente
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Tres planes                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 leading-tight">
          <h2 className="text-xl font-bold text-titulo">{NOMBRE_PRODUCTO}</h2>
          <p className="text-sm text-cuerpo">
            Elegí uno de los tres planes. Los importes son premios anuales finales con IVA incluido.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {OFERTA_VIGENTE.planes.map((opcion) => (
            <TarjetaPlan
              key={opcion.id}
              plan={opcion}
              elegido={opcion.id === planElegido}
              onElegir={() => {
                setPlanElegido(opcion.id);
                setError(null);
              }}
            />
          ))}
        </div>

        <p className="text-xs text-cuerpo">
          Al continuar se selecciona el plan: todavía no se contrata ni se firma. Antes de la
          firma vas a poder revisar y descargar la Solicitud, el FIPF y las condiciones.
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Acción: el botón aparece recién cuando hay un plan elegido           */}
      {/* ------------------------------------------------------------------ */}
      {plan ? (
        <section className="flex flex-col gap-2">
          <button
            type="button"
            onClick={continuar}
            disabled={enProceso}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:self-start"
          >
            {enProceso ? "Guardando…" : `Seleccionar ${plan.nombre} y continuar →`}
          </button>

          {error ? (
            <p role="alert" className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">
              {error}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
