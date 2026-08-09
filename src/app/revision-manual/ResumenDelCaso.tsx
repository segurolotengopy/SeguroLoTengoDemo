"use client";

import { useEffect, useState } from "react";
import { rotuloMotivoDerivacion } from "@/domain/elegibilidad";
import type { MotivoDerivacion } from "@/domain/elegibilidad";

/**
 * Bloque `CASO DERIVADO PARA ANÁLISIS` de la Pantalla A: número de caso,
 * estado, motivo y datos del solicitante con los canales enmascarados.
 *
 * Lo que muestra sale de `GET /api/expediente/caso`, que solo responde si el
 * expediente está en DERIVADO_MANUAL. El motivo que llega es la categoría
 * gruesa (`SALUD` / `PEP` / `SALUD_Y_PEP`): ni esta pantalla ni la API conocen
 * qué se respondió en cada declaración (regla inviolable #7).
 */

interface RespuestaCaso {
  readonly ok?: boolean;
  readonly caso?: {
    readonly numeroCaso: string;
    readonly motivo: MotivoDerivacion;
    readonly derivadoEn: string;
  };
  readonly solicitante?: { readonly nombre: string; readonly documento: string } | null;
  readonly canales?: { readonly whatsapp: string | null; readonly correo: string | null };
}

export function ResumenDelCaso() {
  const [datos, setDatos] = useState<RespuestaCaso | null>(null);

  useEffect(() => {
    let vigente = true;
    void (async () => {
      try {
        const respuesta = await fetch("/api/expediente/caso");
        const cuerpo = (await respuesta.json().catch(() => ({}))) as RespuestaCaso;
        if (vigente && cuerpo.ok) setDatos(cuerpo);
      } catch {
        // Sin datos: el resto de la pantalla sigue diciendo lo esencial.
      }
    })();
    return () => {
      vigente = false;
    };
  }, []);

  const caso = datos?.caso;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-borde-sutil bg-superficie p-5">
      <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
        Caso derivado para análisis
      </h2>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold text-etiqueta">Número de caso</dt>
          <dd className="font-mono text-base font-bold text-titulo">{caso?.numeroCaso ?? "—"}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold text-etiqueta">Estado</dt>
          <dd className="text-base font-bold text-rojo-700 dark:text-rojo-300">EN ANÁLISIS</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold text-etiqueta">Motivo</dt>
          <dd className="text-base font-semibold text-titulo">
            {caso ? rotuloMotivoDerivacion(caso.motivo) : "—"}
          </dd>
        </div>
      </dl>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 border-t border-borde-tenue pt-4 text-sm sm:grid-cols-2">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold text-etiqueta">Solicitante</dt>
          <dd className="text-titulo">{datos?.solicitante?.nombre ?? "—"}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold text-etiqueta">Documento</dt>
          <dd className="text-titulo tabular-nums">{datos?.solicitante?.documento ?? "—"}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold text-etiqueta">WhatsApp verificado</dt>
          <dd className="text-titulo tabular-nums">{datos?.canales?.whatsapp ?? "—"}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold text-etiqueta">Correo verificado</dt>
          <dd className="text-titulo">{datos?.canales?.correo ?? "—"}</dd>
        </div>
      </dl>
    </section>
  );
}
