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
  ENLACE_INFO_COBERTURAS,
  ETIQUETA_PLAN_RECOMENDADO,
  LEYENDA_PREMIO_TARJETA,
  RADIO_ELEGIR_PLAN,
  RADIO_PLAN_SELECCIONADO,
  ROTULO_COBERTURA_ACCIDENTE,
  ROTULO_COBERTURA_CANCER,
  ROTULO_COBERTURA_FALLECIMIENTO,
  ROTULO_COBERTURA_RENTA,
} from "@/domain/textos-plan";
import type { PlanId } from "@/domain/tipos";

/**
 * Las tres tarjetas de plan del Paso 1.
 *
 * **v4** (`PANTALLA_02_SELECCION_PLAN_APROBADA_FINAL.png`, D-28): nombre y
 * radio en la cabecera de la tarjeta, premio en rojo debajo, cuatro filas de
 * cobertura con ícono, y un único enlace «Ver coberturas, exclusiones y
 * condiciones» **debajo de las tres tarjetas** — no uno por tarjeta, que era
 * el formato anterior. `VIVE TOTAL` lleva la etiqueta «PLAN RECOMENDADO»
 * sin quedar elegido por defecto.
 *
 * **v3** (`canvas`): sin cambios — es el dibujo del canvas aprobado de
 * Claude Design («Seguro lo tengo: Flujo de 3 pasos»), con su propio botón
 * declarado en vez del radio.
 *
 * Ningún importe ni cobertura está escrito acá: todo sale de
 * `src/domain/catalogo.ts`, la tabla versionada (producto VIVE, D-28). Este
 * componente solo decide qué tarjeta se ve elegida y manda el `planId` al
 * servidor; el `idVersionOferta` y el hash de la oferta los pone el caso de
 * uso del servidor, nunca el navegador.
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

/** Íconos de fila de cobertura del arte v4. Decorativos: la información va en el texto. */
function IconoCobertura({ trazo }: { trazo: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 text-v4-navy"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={trazo} />
    </svg>
  );
}

const TRAZOS_COBERTURA = {
  // Lazo/cinta de diagnóstico de cáncer.
  cancer: "M9 4a3 3 0 116 0c0 2-3 3-3 5s-3-3-3-5zM12 9v3l-3 8h2l1-4 1 4h2l-3-8",
  // Escudo de fallecimiento.
  escudo: "M12 3l7 2.5v5.2c0 4.6-3 8.2-7 10.3-4-2.1-7-5.7-7-10.3V5.5L12 3z",
  // Cama de renta hospitalaria.
  cama: "M3 19v-7a2 2 0 012-2h14a2 2 0 012 2v7M3 19h18M3 15h18M7 10V6a1 1 0 011-1h3",
  // Botiquín de gastos médicos.
  botiquin: "M4 8a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V8zM12 9v6M9 12h6",
} as const;

/** Filas de cobertura de la tarjeta, con los rótulos, íconos y valores del arte v4. */
const COBERTURAS: readonly { etiqueta: string; trazo: string; valor: (plan: Plan) => string }[] = [
  {
    etiqueta: ROTULO_COBERTURA_CANCER,
    trazo: TRAZOS_COBERTURA.cancer,
    valor: (plan) => formatearGuaranies(plan.indemnizacionCancerGs),
  },
  {
    etiqueta: ROTULO_COBERTURA_FALLECIMIENTO,
    trazo: TRAZOS_COBERTURA.escudo,
    valor: (plan) => formatearGuaranies(plan.muerteCualquierCausaGs),
  },
  {
    // El arte muestra el valor **por día**, con el máximo de días — no el
    // total de la vigencia, que es como lo mostraba el formato anterior.
    etiqueta: ROTULO_COBERTURA_RENTA,
    trazo: TRAZOS_COBERTURA.cama,
    valor: (plan) => `Hasta ${formatearGuaranies(plan.rentaHospitalariaPorDiaGs)}/día · Máx. 15 días`,
  },
  {
    etiqueta: ROTULO_COBERTURA_ACCIDENTE,
    trazo: TRAZOS_COBERTURA.botiquin,
    valor: (plan) => `Hasta ${formatearGuaranies(plan.gastosMedicosAccidenteGs)}`,
  },
];

/** Radio de la tarjeta v4: círculo con punto rojo cuando está elegida. */
function RadioV4({ elegido }: { elegido: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
        elegido ? "border-v4-rojo" : "border-hueso-300"
      }`}
    >
      {elegido ? <span className="h-3 w-3 rounded-full bg-v4-rojo" /> : null}
    </span>
  );
}

function TarjetaPlan({
  plan,
  elegido,
  recomendado,
  onElegir,
  canvas = false,
}: {
  plan: Plan;
  elegido: boolean;
  /** `VIVE TOTAL` lleva la etiqueta del arte, sin quedar elegido por defecto. */
  recomendado?: boolean;
  onElegir: () => void;
  /**
   * Dibujo del canvas del flujo v3: tarjeta con fondo de acento cuando está
   * elegida y un botón declarado («Tocá acá para elegir este plan»), en vez
   * del radio del arte v4, que se lee como un cuadradito. El rol sigue
   * siendo `radio`: la elección es una de tres, y los e2e dependen de esa
   * semántica.
   */
  canvas?: boolean;
}) {
  if (canvas) {
    return (
      <article
        className={`relative flex flex-col gap-2 rounded-2xl border p-5 transition-colors ${
          elegido
            ? "border-borde-sutil bg-naranja-50 dark:bg-naranja-950"
            : "border-borde-sutil bg-white dark:bg-superficie"
        }`}
      >
        <header className="flex flex-col gap-0.5">
          {elegido ? (
            <p className="mb-1 text-[11px] font-bold tracking-[0.08em] text-naranja-700 uppercase dark:text-naranja-300">
              ✓ Seleccionado
            </p>
          ) : null}
          <h3 className="text-xl font-bold text-titulo">{plan.nombre}</h3>
          <p
            className={`text-[26px] font-bold tabular-nums ${
              elegido ? "text-naranja-700 dark:text-naranja-300" : "text-azul-800 dark:text-azul-200"
            }`}
          >
            {formatearGuaranies(plan.premioAnualGs)}
          </p>
          <p className="text-[11px] text-etiqueta">{LEYENDA_PREMIO_TARJETA}</p>
        </header>

        <dl className="grid gap-2 border-t border-borde-tenue pt-3 text-[13px] leading-snug">
          {COBERTURAS.map(({ etiqueta, valor }) => (
            <div key={etiqueta}>
              <dd className="font-bold text-titulo tabular-nums">{valor(plan)}</dd>
              <dt className="text-cuerpo">{etiqueta}</dt>
            </div>
          ))}
        </dl>

        <EnlaceAclaracion
          documento="coberturas"
          className="text-xs font-semibold text-rojo-700 underline decoration-rojo-300 underline-offset-2 hover:text-rojo-900 dark:text-rojo-300 dark:decoration-rojo-600"
        >
          {ENLACE_INFO_COBERTURAS}
        </EnlaceAclaracion>

        <button
          type="button"
          role="radio"
          aria-checked={elegido}
          onClick={onElegir}
          className={`btn ${elegido ? "btn-primary" : "btn-secondary"} mt-auto w-full`}
          style={{ borderRadius: "999px", padding: "11px 18px" }}
        >
          {elegido ? "✓ Plan elegido" : "Tocá acá para elegir este plan"}
        </button>
      </article>
    );
  }

  return (
    <article
      className={`relative flex flex-col gap-3 rounded-2xl border p-4 transition-colors sm:p-5 ${
        elegido ? "border-v4-rojo bg-v4-rojo/5" : "border-hueso-200 bg-white"
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <h3 className="text-xl font-bold text-v4-navy">{plan.nombre}</h3>
        <div className="flex shrink-0 items-center gap-2">
          {recomendado ? (
            <span className="rounded-full border border-v4-azul/30 bg-v4-azul/10 px-2.5 py-1 text-[10px] font-bold tracking-wide text-v4-azul uppercase whitespace-nowrap">
              {ETIQUETA_PLAN_RECOMENDADO}
            </span>
          ) : null}
          <button
            type="button"
            role="radio"
            aria-checked={elegido}
            aria-label={elegido ? RADIO_PLAN_SELECCIONADO : `${RADIO_ELEGIR_PLAN}: ${plan.nombre}`}
            onClick={onElegir}
            className="flex h-8 w-8 items-center justify-center"
          >
            <RadioV4 elegido={elegido} />
          </button>
        </div>
      </header>

      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-2xl font-bold text-v4-rojo tabular-nums">
          {formatearGuaranies(plan.premioAnualGs)}
        </span>
        <span className="text-xs text-etiqueta">{LEYENDA_PREMIO_TARJETA}</span>
      </p>

      <dl className="flex flex-col gap-2.5 border-t border-hueso-100 pt-3">
        {COBERTURAS.map(({ etiqueta, trazo, valor }) => (
          <div key={etiqueta} className="flex items-baseline justify-between gap-3">
            {/* Etiqueta y valor comparten el ancho: con `shrink-0` en el valor,
                «Hasta Gs. 1.000.000/día · Máx. 15 días» se salía de la tarjeta a
                375 px y aplastaba la etiqueta en tres líneas. */}
            <dt className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-cuerpo">
              <IconoCobertura trazo={trazo} />
              {etiqueta}
            </dt>
            <dd className="min-w-0 max-w-[55%] text-right text-xs font-bold text-v4-navy tabular-nums">
              {valor(plan)}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

export function SelectorDePlanes({
  fichas,
  aclaracion,
  entreTarjetasYPie,
  onCompletado,
  canvas = false,
}: {
  /** Fila de tres fichas (edad / carencias / inicio de cobertura). Solo v4. */
  fichas?: React.ReactNode;
  /** Caja de aclaración legal, con ícono. Solo v4. */
  aclaracion?: React.ReactNode;
  /** Compatibilidad con el dibujo del canvas (v3), que no usa `fichas`/`aclaracion`. */
  entreTarjetasYPie?: React.ReactNode;
  /** Dibujo del canvas (flujo v3). v4 es el default. */
  canvas?: boolean;
  /**
   * Al guardar el plan, en vez de navegar al paso siguiente (el default, para
   * la página v4). Lo usa la página del paso 2 del flujo v3 para avanzar el
   * gating de secciones sin recargar (lote F3).
   */
  onCompletado?: () => void;
}) {
  const [planElegido, setPlanElegido] = useState<PlanId | null>(null);
  const [enProceso, setEnProceso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reencaminado, setReencaminado] = useState<RespuestaApi["destino"] | null>(null);

  const plan = planElegido ? OFERTA_VIGENTE.planes.find((p) => p.id === planElegido) : undefined;
  const ultimoPlanId = OFERTA_VIGENTE.planes[OFERTA_VIGENTE.planes.length - 1]?.id;

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
    <div className="flex flex-col gap-5">
      <div
        role="radiogroup"
        aria-label="Planes disponibles"
        className="grid gap-4 pt-2 lg:grid-cols-3 v3-rejilla"
        style={{ "--v3-min": "250px", "--v3-gap": "16px" } as CSSProperties}
      >
        {OFERTA_VIGENTE.planes.map((opcion) => (
          <TarjetaPlan
            key={opcion.id}
            canvas={canvas}
            plan={opcion}
            elegido={opcion.id === planElegido}
            recomendado={!canvas && opcion.id === ultimoPlanId}
            onElegir={() => {
              setPlanElegido(opcion.id);
              setError(null);
            }}
          />
        ))}
      </div>

      {canvas ? (
        // El canvas (v3) conserva el enlace por tarjeta y la franja que le
        // pase la página; v4 lo reemplaza por el enlace único de abajo.
        entreTarjetasYPie
      ) : (
        <>
          {/* Un único enlace debajo de las tres tarjetas, como en el arte v4
              — no uno por tarjeta, que era el formato anterior. */}
          <p className="text-center">
            <EnlaceAclaracion
              documento="coberturas"
              className="text-sm font-semibold text-v4-rojo underline decoration-v4-rojo/40 underline-offset-2 hover:opacity-80"
            >
              {ENLACE_INFO_COBERTURAS}
            </EnlaceAclaracion>
          </p>

          {fichas}
          {aclaracion}
        </>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* CTA: fila con nota + botón en el canvas; botón rojo a todo el ancho */}
      {/* en v4, como en el arte. El botón arranca deshabilitado, como toda   */}
      {/* continuación.                                                      */}
      {/* ------------------------------------------------------------------ */}
      <button
        data-cta="Acá abajo está el botón para pasar al paso 2"
        type="button"
        onClick={continuar}
        disabled={!plan || enProceso}
        className={
          canvas
            ? "inline-flex h-12 shrink-0 items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:cursor-not-allowed disabled:opacity-50 lg:self-end"
            : "inline-flex h-12 w-full items-center justify-center rounded-full bg-v4-rojo px-6 text-sm font-bold tracking-wide text-white uppercase transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:bg-v4-rojo/35"
        }
      >
        {enProceso ? "Guardando…" : BOTON_CONTINUAR_PLAN}
      </button>

      {error ? (
        <div className="flex flex-col gap-3 sm:items-start">
          <p role="alert" className="text-sm font-semibold text-v4-rojo">
            {error}
          </p>
          {/* El servidor sabe dónde quedó el trámite: se ofrece el camino, no
              solo el aviso. */}
          {reencaminado ? (
            <a
              href={reencaminado.ruta}
              className="inline-flex h-11 items-center justify-center rounded-full bg-v4-rojo px-6 text-sm font-bold tracking-wide text-white uppercase transition-colors hover:opacity-90 sm:self-start"
            >
              {reencaminado.rotulo} →
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
