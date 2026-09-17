"use client";

/**
 * 04D · Consentimientos. Etapa 4 de 5.
 *
 * **Dos casillas y un bloque informativo.** El tercero —intermediario y canal
 * de atención— no lleva casilla: lo fija el manual, que manda sobre el arte
 * (D-28), y se registra al continuar. Los dos textos con casilla son palabra
 * por palabra los de `screens.json`.
 *
 * Es la única pantalla de v4 desde la que el expediente llega a
 * `DECLARACIONES_OK`.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TEXTOS_04D } from "@/domain/v4/textos-consentimientos";
import { MarcoV4 } from "../MarcoV4";
import { BarraPlanV4 } from "../BarraPlanV4";
import { AccionesV4, DisposicionV4 } from "../disposicion";
import {
  AvisoRojoV4,
  BotonPrincipalV4,
  CasillaConsentimientoV4,
  IconoInfo,
} from "../piezas";
import {
  IconoCalendarioReloj,
  IconoEntregaDigital,
  IconoIntermediario,
  IlustracionConsentimientos,
} from "../ilustraciones";

export function Pantalla04D() {
  const router = useRouter();
  const [entregaDigital, setEntregaDigital] = useState(false);
  const [inicioCobertura, setInicioCobertura] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continuar() {
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/v4/consentimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entregaDigital, inicioCobertura }),
      });
      const datos = (await respuesta.json()) as { ok: boolean; motivo?: string };
      if (datos.ok) {
        router.push("/firma");
        return;
      }
      setError("No pudimos registrar tus consentimientos. Intentá nuevamente.");
    } catch {
      setError("No pudimos registrar tus consentimientos. Revisá tu conexión e intentá nuevamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <MarcoV4 codigo="04D">
      <DisposicionV4
        contexto={
          <>
            <div className="flex items-start gap-2 lg:flex-col lg:gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="v4-titular">
                  <em>{TEXTOS_04D.titulo}</em>
                </h1>
                <p className="v4-bajada mt-2">{TEXTOS_04D.bajada}</p>
              </div>
              <IlustracionConsentimientos tamano={108} className="shrink-0" />
            </div>

            <BarraPlanV4 className="mt-4" />
          </>
        }
      >
        <div className="mt-4 space-y-3 lg:mt-0">
          <div className="v4-tarjeta p-4">
            <div className="flex gap-3">
              <CasillaConsentimientoV4
                marcada={entregaDigital}
                alCambiar={setEntregaDigital}
                id="consentimiento-entrega"
              >
                <span className="sr-only">{TEXTOS_04D.entregaDigital.texto}</span>
              </CasillaConsentimientoV4>
              <div className="min-w-0">
                <p className="text-[1.0625rem] font-bold uppercase" style={{ color: "var(--v4-navy)" }}>
                  {TEXTOS_04D.entregaDigital.titulo}
                </p>
                <div className="mt-2 flex items-start gap-3">
                  <IconoEntregaDigital tamano={54} />
                  <p
                    className="text-[0.9375rem] leading-snug lg:max-w-prose"
                    style={{ color: "var(--v4-azul-apagado)" }}
                  >
                    {TEXTOS_04D.entregaDigital.texto}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="v4-tarjeta p-4">
            <div className="flex gap-3">
              <CasillaConsentimientoV4
                marcada={inicioCobertura}
                alCambiar={setInicioCobertura}
                id="consentimiento-cobertura"
              >
                <span className="sr-only">{TEXTOS_04D.inicioCobertura.texto}</span>
              </CasillaConsentimientoV4>
              <div className="min-w-0">
                <p className="text-[1.0625rem] font-bold uppercase leading-tight" style={{ color: "var(--v4-navy)" }}>
                  {TEXTOS_04D.inicioCobertura.titulo}
                </p>
                <div className="mt-2 flex items-start gap-3">
                  <IconoCalendarioReloj tamano={54} />
                  <p
                    className="text-[0.9375rem] leading-snug lg:max-w-prose"
                    style={{ color: "var(--v4-azul-apagado)" }}
                  >
                    {TEXTOS_04D.inicioCobertura.texto}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sin casilla: informativo. Se registra al continuar. */}
          <div className="v4-tarjeta p-4">
            <div className="flex gap-3">
              <span className="shrink-0 pt-0.5">
                <IconoInfo color="var(--v4-rojo)" />
              </span>
              <div className="min-w-0">
                <p className="text-[1.0625rem] font-bold uppercase leading-tight" style={{ color: "var(--v4-navy)" }}>
                  {TEXTOS_04D.intermediario.titulo}
                </p>
                <div className="mt-2 flex items-start gap-3">
                  <IconoIntermediario tamano={54} />
                  <p
                    className="text-[0.9375rem] leading-snug lg:max-w-prose"
                    style={{ color: "var(--v4-azul-apagado)" }}
                  >
                    {TEXTOS_04D.intermediario.texto}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error ? <AvisoRojoV4 className="mt-4">{error}</AvisoRojoV4> : null}

        <AccionesV4 className="mt-5">
          <BotonPrincipalV4
            onClick={continuar}
            disabled={!entregaDigital || !inicioCobertura}
            cargando={enviando}
          >
            {TEXTOS_04D.continuar}
          </BotonPrincipalV4>
        </AccionesV4>
      </DisposicionV4>
    </MarcoV4>
  );
}
