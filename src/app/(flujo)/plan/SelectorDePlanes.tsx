"use client";

import type { CSSProperties } from "react";

import { rutaSiguienteDe } from "@/domain/rutas-flujo";
import { useState } from "react";
import type React from "react";
import { EnlaceAclaracion } from "@/components/shared";
import { formatearGuaranies, OFERTA_VIGENTE } from "@/domain/catalogo";
import type { Plan } from "@/domain/catalogo";
import {
  BOTON_CONTINUAR_PLAN,
  CINTA_PLAN_SELECCIONADO,
  ENLACE_INFO_COBERTURAS,
  LEYENDA_PREMIO_TARJETA,
  NOTA_LEGAL_PLAN,
  RADIO_ELEGIR_PLAN,
  RADIO_PLAN_SELECCIONADO,
  ROTULO_COBERTURA_ACCIDENTE,
  ROTULO_COBERTURA_CANCER,
  ROTULO_COBERTURA_FALLECIMIENTO,
  ROTULO_COBERTURA_RENTA,
} from "@/domain/textos-plan";
import type { PlanId } from "@/domain/tipos";

/**
 * Las tres tarjetas de plan del Paso 1, en el formato de la maqueta
 * (`PantallasDemo2.pdf` p.1): premio grande arriba, cuatro filas de cobertura,
 * el enlace rojo a coberturas/exclusiones y el radio `Elegir esta opción` al
 * pie. La elegida lleva borde naranja y la cinta `★ PLAN SELECCIONADO`.
 *
 * Ningún importe ni cobertura está escrito acá: todo sale de
 * `src/domain/catalogo.ts`, la tabla versionada (D-04). Este componente solo
 * decide qué tarjeta se ve elegida y manda el `planId` al servidor; el
 * `idVersionOferta` y el hash de la oferta los pone el caso de uso del
 * servidor, nunca el navegador.
 */

interface RespuestaApi {
  readonly ok?: boolean;
  readonly motivo?: string;
  /**
   * A dónde puede seguir esta persona cuando su expediente ya no está en este
   * paso. Lo calcula el servidor con `destinoDelExpediente`.
   *
   * La pantalla ya se dibuja reencaminada cuando el trámite avanzó (lo
   * resuelve `page.tsx` antes de renderizar), así que esto cubre lo que aquel
   * chequeo no puede ver: el estado que cambió **después** de dibujar —otra
   * pestaña, el panel de demo, una sesión vieja.
   */
  readonly destino?: { readonly ruta: string; readonly rotulo: string; readonly terminal: boolean };
}

const MENSAJES: Readonly<Record<string, string>> = {
  PLAN_INVALIDO: "Ese plan no está disponible. Elegí uno de los tres.",
  EXPEDIENTE_NO_ENCONTRADO: "Se perdió la sesión. Volvé a empezar desde el inicio.",
  SESION_INVALIDA: "Se perdió la sesión. Volvé a empezar desde el inicio.",
  ESTADO_INVALIDO: "Este trámite ya pasó la selección de plan.",
  CUERPO_INVALIDO: "No pudimos procesar el pedido. Intentá de nuevo.",
};

/** Filas de cobertura de la tarjeta, con los rótulos y el orden de la maqueta. */
const COBERTURAS: readonly { etiqueta: string; valor: (plan: Plan) => string }[] = [
  { etiqueta: ROTULO_COBERTURA_CANCER, valor: (plan) => formatearGuaranies(plan.indemnizacionCancerGs) },
  {
    etiqueta: ROTULO_COBERTURA_FALLECIMIENTO,
    valor: (plan) => formatearGuaranies(plan.muerteCualquierCausaGs),
  },
  {
    etiqueta: ROTULO_COBERTURA_RENTA,
    valor: (plan) => `hasta ${formatearGuaranies(plan.rentaHospitalariaTotalGs)}`,
  },
  {
    etiqueta: ROTULO_COBERTURA_ACCIDENTE,
    valor: (plan) => formatearGuaranies(plan.gastosMedicosAccidenteGs),
  },
];

/** Escudo de la tarjeta, como el de la barra de plan. Decorativo. */
function IconoEscudo({ destacado }: { destacado: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`h-9 w-9 shrink-0 ${destacado ? "text-naranja-600 dark:text-naranja-400" : "text-azul-700 dark:text-azul-300"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l7 2.5v5.2c0 4.6-3 8.2-7 10.3-4-2.1-7-5.7-7-10.3V5.5L12 3z" />
      <path d="M12 8v6M9 11h6" />
    </svg>
  );
}

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
      className={`relative flex flex-col gap-2 rounded-xl border-2 p-4 pt-5 transition-colors ${
        elegido
          ? "border-naranja-500 bg-naranja-50/40 dark:border-naranja-400 dark:bg-naranja-950"
          : "border-borde-sutil bg-superficie"
      }`}
    >
      {/* Cinta de la maqueta sobre la tarjeta elegida. */}
      {elegido ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-naranja-500 bg-superficie px-3 py-0.5 text-[10px] font-bold tracking-wide whitespace-nowrap text-naranja-700 uppercase dark:text-naranja-300">
          {CINTA_PLAN_SELECCIONADO}
        </span>
      ) : null}

      {/* Cabecera: escudo, nombre y el premio grande. */}
      <header className="flex flex-col items-center gap-0.5 text-center">
        <IconoEscudo destacado={elegido} />
        <h3 className="text-lg font-bold text-titulo">{plan.nombre}</h3>
        <p
          className={`text-2xl font-bold tabular-nums ${
            elegido ? "text-naranja-700 dark:text-naranja-300" : "text-azul-800 dark:text-azul-200"
          }`}
        >
          {formatearGuaranies(plan.premioAnualGs)}
        </p>
        <p className="text-[11px] text-etiqueta">{LEYENDA_PREMIO_TARJETA}</p>
      </header>

      <dl className="flex flex-col divide-y divide-borde-tenue border-t border-borde-tenue">
        {COBERTURAS.map(({ etiqueta, valor }) => (
          <div key={etiqueta} className="flex items-baseline justify-between gap-3 py-1.5">
            <dt className="text-xs text-cuerpo">{etiqueta}</dt>
            <dd className="shrink-0 text-right text-xs font-bold text-azul-800 tabular-nums dark:text-azul-200">
              {valor(plan)}
            </dd>
          </div>
        ))}
      </dl>

      {/* El enlace rojo de la maqueta. Abre el documento de coberturas (D-15). */}
      <EnlaceAclaracion
        documento="coberturas"
        className="text-xs font-semibold text-rojo-700 underline decoration-rojo-300 underline-offset-2 hover:text-rojo-900 dark:text-rojo-300 dark:decoration-rojo-600"
      >
        {ENLACE_INFO_COBERTURAS}
      </EnlaceAclaracion>

      {/* Radio de la maqueta: `Elegir esta opción` → `Plan seleccionado`. */}
      <button
        type="button"
        role="radio"
        aria-checked={elegido}
        onClick={onElegir}
        className={`mt-auto inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border-t border-borde-tenue pt-2 text-sm font-semibold transition-colors ${
          elegido ? "text-naranja-700 dark:text-naranja-300" : "text-azul-700 hover:text-azul-900 dark:text-azul-300"
        }`}
      >
        <span
          aria-hidden="true"
          className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
            elegido ? "border-naranja-600" : "border-azul-700 dark:border-azul-300"
          }`}
        >
          {elegido ? <span className="h-2 w-2 rounded-full bg-naranja-600" /> : null}
        </span>
        {elegido ? RADIO_PLAN_SELECCIONADO : RADIO_ELEGIR_PLAN}
      </button>
    </article>
  );
}

export function SelectorDePlanes({
  entreTarjetasYPie,
  onCompletado,
}: {
  entreTarjetasYPie?: React.ReactNode;
  /**
   * Al guardar el plan, en vez de navegar al paso siguiente (el default, para
   * la página v2). Lo usa la página del paso 2 del flujo v3 para avanzar el
   * gating de secciones sin recargar (lote F3).
   */
  onCompletado?: () => void;
}) {
  const [planElegido, setPlanElegido] = useState<PlanId | null>(null);
  const [enProceso, setEnProceso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reencaminado, setReencaminado] = useState<RespuestaApi["destino"] | null>(null);

  const plan = planElegido ? OFERTA_VIGENTE.planes.find((p) => p.id === planElegido) : undefined;

  async function continuar() {
    if (!plan) return;
    setEnProceso(true);
    setError(null);
    setReencaminado(null);
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
        setReencaminado(datos.destino ?? null);
        return;
      }

      if (onCompletado) {
        onCompletado();
      } else {
        window.location.assign(rutaSiguienteDe("/plan") ?? "/whatsapp");
      }
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setEnProceso(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Planes disponibles" className="grid gap-4 pt-2 lg:grid-cols-3 v3-rejilla"
          style={{ "--v3-min": "220px" } as CSSProperties}>
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

      {/* La franja `Información relevante` va acá porque la maqueta la dibuja
          entre las tarjetas y el pie; la dibuja el servidor y entra por prop. */}
      {entreTarjetasYPie}

      {/* ------------------------------------------------------------------ */}
      {/* Pie de la maqueta: la nota legal a la izquierda, el botón a la       */}
      {/* derecha. El botón arranca deshabilitado, como toda continuación.    */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <p className="max-w-3xl text-xs leading-relaxed font-semibold text-azul-800 dark:text-azul-200">
          {NOTA_LEGAL_PLAN}
        </p>
        <button
          data-cta="Acá abajo está el botón para pasar al paso 2"
          type="button"
          onClick={continuar}
          disabled={!plan || enProceso}
          className="inline-flex h-12 shrink-0 items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enProceso ? "Guardando…" : BOTON_CONTINUAR_PLAN}
        </button>
      </div>

      {error ? (
        <div className="flex flex-col gap-3 sm:items-start">
          <p role="alert" className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">
            {error}
          </p>
          {/* El servidor sabe dónde quedó el trámite: se ofrece el camino, no
              solo el aviso. */}
          {reencaminado ? (
            <a
              href={reencaminado.ruta}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 sm:self-start"
            >
              {reencaminado.rotulo} →
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
