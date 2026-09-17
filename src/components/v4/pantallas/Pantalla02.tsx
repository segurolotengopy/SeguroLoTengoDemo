"use client";

/**
 * 02 · Selección de plan. Etapa 1 de 5.
 *
 * Arte: `PANTALLA_02_SELECCION_PLAN_APROBADA_FINAL.png`, descrito en
 * `ANALISIS_VISUAL_PNG.md` §2.2. Los tres detalles (02A, 02B, 02C) viven en
 * `DetalleProducto02`.
 *
 * Los importes y las coberturas salen de `catalogo.ts` —la oferta versionada
 * que se hashea al elegir—, nunca de esta pantalla: lo que la persona ve y lo
 * que se le cobra tienen que venir de la misma tabla.
 *
 * **La CTA arranca deshabilitada.** El arte la dibuja roja con ningún plan
 * elegido; el manual prohíbe avanzar sin la selección, y manda el manual
 * (D-28).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  NOMBRE_PRODUCTO,
  ORDEN_PLANES,
  PLANES,
  PLAN_RECOMENDADO,
  REGISTRO_PRODUCTO,
  formatearGuaranies,
  urlVideoInformativo,
} from "@/domain/catalogo";
import type { PlanId } from "@/domain/tipos";
import { TEXTOS_02 } from "@/domain/v4/textos-plan";
import { MarcoV4 } from "../MarcoV4";
import {
  AvisoAzulV4,
  AvisoRojoV4,
  BotonPrincipalV4,
  IconoChevronDerecha,
} from "../piezas";
import { IconoCama, IconoEscudo, IconoLazo, IconoMaletinMedico, IlustracionPlanes } from "../ilustraciones";
import { DetalleProducto02 } from "./DetalleProducto02";

function FilaCobertura({
  Icono,
  concepto,
  valor,
  detalle,
}: {
  readonly Icono: React.ComponentType<{ tamano?: number }>;
  readonly concepto: string;
  readonly valor: string;
  readonly detalle?: string;
}) {
  return (
    <div className="flex items-center gap-3 border-t py-2.5" style={{ borderColor: "var(--v4-gris-borde)" }}>
      <Icono tamano={22} />
      <span className="min-w-0 flex-1 text-[0.875rem]" style={{ color: "var(--v4-azul-apagado)" }}>
        {concepto}
      </span>
      <span className="shrink-0 text-right text-[0.875rem] font-bold" style={{ color: "var(--v4-navy)" }}>
        {valor}
        {detalle ? (
          <span className="block text-[0.75rem] font-normal" style={{ color: "var(--v4-azul-apagado)" }}>
            {detalle}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function TarjetaPlan({
  planId,
  elegido,
  alElegir,
}: {
  readonly planId: PlanId;
  readonly elegido: boolean;
  readonly alElegir: () => void;
}) {
  const plan = PLANES[planId];
  const recomendado = planId === PLAN_RECOMENDADO;

  return (
    <label
      className="block cursor-pointer rounded-xl border p-4 transition-colors"
      style={{
        borderColor: elegido ? "var(--v4-azul)" : "var(--v4-azul-borde)",
        background: elegido ? "var(--v4-azul-fondo)" : "var(--v4-blanco)",
        boxShadow: elegido ? "0 0 0 1px var(--v4-azul)" : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[1.5rem] font-bold" style={{ color: "var(--v4-navy)" }}>
              {plan.nombre}
            </span>
            {recomendado ? (
              <span
                className="rounded-full px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide"
                style={{ background: "var(--v4-azul-fondo)", color: "var(--v4-azul)" }}
              >
                {TEXTOS_02.planRecomendado}
              </span>
            ) : null}
          </div>
          <p className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className="text-[1.5rem] font-bold" style={{ color: "var(--v4-rojo)" }}>
              {formatearGuaranies(plan.premioAnualGs)}
            </span>
            <span className="text-[0.8125rem]" style={{ color: "var(--v4-azul-apagado)" }}>
              {TEXTOS_02.premioPie}
            </span>
          </p>
        </div>

        <input
          type="radio"
          name="plan"
          value={planId}
          checked={elegido}
          onChange={alElegir}
          aria-label={`Elegir el plan ${plan.nombre}`}
          className="mt-1 h-8 w-8 shrink-0 cursor-pointer"
          style={{ accentColor: "var(--v4-azul)" }}
        />
      </div>

      <div className="mt-3">
        <FilaCobertura
          Icono={IconoLazo}
          concepto={TEXTOS_02.coberturas.cancer}
          valor={formatearGuaranies(plan.indemnizacionCancerGs)}
        />
        <FilaCobertura
          Icono={IconoEscudo}
          concepto={TEXTOS_02.coberturas.fallecimiento}
          valor={formatearGuaranies(plan.muerteCualquierCausaGs)}
        />
        <FilaCobertura
          Icono={IconoCama}
          concepto={TEXTOS_02.coberturas.renta}
          valor={`Hasta ${formatearGuaranies(plan.rentaHospitalariaPorDiaGs)}/día`}
          detalle={TEXTOS_02.maximoDias}
        />
        <FilaCobertura
          Icono={IconoMaletinMedico}
          concepto={TEXTOS_02.coberturas.gastos}
          valor={`Hasta ${formatearGuaranies(plan.gastosMedicosAccidenteGs)}`}
        />
      </div>
    </label>
  );
}

export function Pantalla02() {
  const router = useRouter();
  const [elegido, setElegido] = useState<PlanId | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const video = urlVideoInformativo();

  async function continuar() {
    if (!elegido) return;
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/p2/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: elegido }),
      });
      const datos = (await respuesta.json()) as {
        ok: boolean;
        destino?: { ruta: string };
      };
      if (datos.ok) {
        router.push("/whatsapp");
        return;
      }
      // El expediente ya avanzó: se lo lleva a donde corresponde en vez de
      // solo avisar (regla de `rutas-flujo.ts`).
      if (datos.destino?.ruta) {
        router.push(datos.destino.ruta);
        return;
      }
      setError("No pudimos guardar el plan elegido. Intentá nuevamente.");
    } catch {
      setError("No pudimos guardar el plan elegido. Revisá tu conexión e intentá nuevamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <MarcoV4 codigo="02">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="v4-titular">
            {TEXTOS_02.titulo}
            <br />
            <em>{TEXTOS_02.tituloAcento}</em>
          </h1>
          <p className="v4-bajada mt-2">{TEXTOS_02.bajada}</p>
        </div>
        <IlustracionPlanes tamano={112} className="shrink-0" />
      </div>

      {/* Video informativo. Sin `NEXT_PUBLIC_VIDEO_INFORMATIVO_URL` la tarjeta
          queda como marcador y no enlaza a ningún lado: no se inventa un video. */}
      <div className="v4-tarjeta-azul mt-4 flex items-center gap-3 p-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--v4-rojo)" }}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M8 5 L19 12 L8 19 Z" fill="#FFFFFF" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.8125rem] font-bold uppercase tracking-wide" style={{ color: "var(--v4-navy)" }}>
            {TEXTOS_02.video.rotulo}
          </span>
          <span className="block text-[0.875rem]" style={{ color: "var(--v4-azul-apagado)" }}>
            {TEXTOS_02.video.pie}
          </span>
        </span>
        {video ? (
          <a href={video} target="_blank" rel="noreferrer" aria-label={TEXTOS_02.video.pie}>
            <IconoChevronDerecha color="var(--v4-azul)" />
          </a>
        ) : null}
      </div>

      <p className="mt-3 text-center text-[0.6875rem] leading-snug" style={{ color: "var(--v4-azul-apagado)" }}>
        Producto inscrito: {REGISTRO_PRODUCTO.denominacionRegistral} · Código de Registro N.º{" "}
        {REGISTRO_PRODUCTO.codigo} · {REGISTRO_PRODUCTO.acto}.
      </p>

      <fieldset className="mt-4 space-y-3">
        <legend className="sr-only">{NOMBRE_PRODUCTO}: elegí un plan</legend>
        {ORDEN_PLANES.map((planId) => (
          <TarjetaPlan
            key={planId}
            planId={planId}
            elegido={elegido === planId}
            alElegir={() => setElegido(planId)}
          />
        ))}
      </fieldset>

      <div className="mt-4 text-center">
        <button type="button" className="v4-enlace text-[0.9375rem]" onClick={() => setDetalleAbierto(true)}>
          {TEXTOS_02.enlaceDetalle}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {TEXTOS_02.fichas.map((ficha, indice) => (
          <div key={ficha.titulo} className="v4-tarjeta flex gap-3 p-3">
            <span className="shrink-0">
              {indice === 0 ? <IconoEscudo tamano={24} /> : indice === 1 ? <IconoCama tamano={24} /> : <IconoLazo tamano={24} />}
            </span>
            <span className="min-w-0">
              <span className="block text-[0.75rem] font-bold uppercase tracking-wide" style={{ color: "var(--v4-navy)" }}>
                {ficha.titulo}
              </span>
              {ficha.lineas.map((linea) => (
                <span key={linea} className="block text-[0.8125rem]" style={{ color: "var(--v4-azul-apagado)" }}>
                  {linea}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>

      <AvisoAzulV4 className="mt-4">
        <p>
          <strong style={{ color: "var(--v4-azul)" }}>{TEXTOS_02.aclaracionRotulo}</strong>{" "}
          {TEXTOS_02.aclaracion[0]}
        </p>
        <p className="mt-2">{TEXTOS_02.aclaracion[1]}</p>
      </AvisoAzulV4>

      {error ? <AvisoRojoV4 className="mt-4">{error}</AvisoRojoV4> : null}

      <div className="mt-5">
        <BotonPrincipalV4 onClick={continuar} disabled={!elegido} cargando={enviando}>
          {TEXTOS_02.continuar}
        </BotonPrincipalV4>
      </div>

      {detalleAbierto ? <DetalleProducto02 alCerrar={() => setDetalleAbierto(false)} /> : null}
    </MarcoV4>
  );
}
