"use client";

/**
 * Orquestador del paso 2 (lote F3), patrón de `Inscripcion.tsx`.
 *
 * Dos secciones gateadas por el estado del expediente: el plan
 * (`AUTORIZADO`, o re-abierta por `cambiar plan` — el autobucle
 * `PLAN_SELECCIONADO → PLAN_SELECCIONADO` lo permite) y el bloque de
 * beneficiario + preguntas + aceptación (`PLAN_SELECCIONADO`). Entre las dos,
 * el plan elegido «en claro»: las cuatro coberturas con su carencia.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SelectorDePlanes } from "../plan/SelectorDePlanes";
import type { EstadoExpediente, PlanId } from "@/domain/tipos";
import { PLANES, formatearGuaranies } from "@/domain/catalogo";
import { LEYENDA_EDAD_Y_RENOVACION, coberturasEnClaro } from "@/domain/textos-seguro";
import { FormularioSeguroP2 } from "./FormularioSeguroP2";

export interface SeguroProps {
  readonly estado: EstadoExpediente;
  readonly nombrePila: string | null;
  /** Plan ya elegido en el expediente, si lo hay. */
  readonly planElegido: PlanId | null;
}

export function Seguro(props: SeguroProps) {
  const router = useRouter();
  const [editandoPlan, setEditandoPlan] = useState(false);

  const eligiendoPlan = props.estado === "AUTORIZADO" || editandoPlan || props.planElegido === null;
  const plan = props.planElegido ? PLANES[props.planElegido] : null;
  const con = (frase: string) =>
    props.nombrePila ? `${props.nombrePila}, ${frase}` : frase.charAt(0).toUpperCase() + frase.slice(1);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Sección plan ─────────────────────────────────────────────── */}
      <section
        aria-label="Tu plan"
        className={`flex flex-col gap-3 rounded-xl border bg-superficie p-4 sm:p-5 ${
          eligiendoPlan ? "border-naranja-300" : "border-borde-sutil"
        }`}
      >
        {eligiendoPlan ? (
          <SelectorDePlanes
            onCompletado={() => {
              setEditandoPlan(false);
              router.refresh();
            }}
          />
        ) : plan ? (
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-verde-700 dark:text-verde-300">
              ✓ Plan elegido: {plan.nombre} · {formatearGuaranies(plan.premioAnualGs)} al año ·
              IVA incluido
            </p>
            <button
              type="button"
              onClick={() => setEditandoPlan(true)}
              className="text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 dark:text-azul-200"
            >
              cambiar plan
            </button>
          </div>
        ) : null}
      </section>

      {/* ── Tu plan, en claro ────────────────────────────────────────── */}
      {!eligiendoPlan && plan && props.planElegido ? (
        <section
          aria-label="Qué cubre y desde cuándo"
          className="flex flex-col gap-3 rounded-xl border border-borde-sutil bg-superficie p-4 sm:p-5"
        >
          <p className="text-[11px] font-semibold tracking-wide text-etiqueta uppercase">
            Qué cubre y desde cuándo
          </p>
          <h2 className="text-lg font-bold text-titulo">Tu plan {plan.nombre}, en claro</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {coberturasEnClaro(props.planElegido).map((cobertura) => (
              <div key={cobertura.rotulo} className="rounded-lg border border-borde-tenue p-3">
                <p className="text-sm font-bold text-titulo">{cobertura.rotulo}</p>
                <p className="text-base font-bold text-naranja-700 dark:text-naranja-300">
                  {cobertura.monto}
                </p>
                <p className="text-xs text-cuerpo">{cobertura.detalle}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-etiqueta">{LEYENDA_EDAD_Y_RENOVACION}</p>
        </section>
      ) : null}

      {/* ── Beneficiario + preguntas + aceptación ────────────────────── */}
      <section
        aria-label="Beneficiario y declaraciones"
        className={`flex flex-col gap-3 rounded-xl border bg-superficie p-4 sm:p-5 ${
          !eligiendoPlan ? "border-naranja-300" : "border-borde-sutil"
        }`}
      >
        {eligiendoPlan ? (
          <>
            <h2 className="text-lg font-bold text-titulo">{con("¿a quién protegés?")}</h2>
            <p className="text-sm text-etiqueta">Se habilita cuando elijas tu plan.</p>
          </>
        ) : (
          <FormularioSeguroP2 nombrePila={props.nombrePila} />
        )}
      </section>
    </div>
  );
}
