"use client";

import { useState } from "react";
import type { EscenarioIdentidadDemo } from "@/adapters/mock/persona-activa";

/**
 * Selector de persona de prueba activa y de desenlace forzado de P5, dentro
 * del panel de demo (CLAUDE.md → "Panel de demo"). No forma parte de las 12
 * pantallas ni del contador de 9 pasos.
 *
 * Las opciones las arma el servidor y bajan por props: este componente no
 * importa `personas.ts` ni el adaptador, solo postea la elección.
 */

export interface OpcionPersona {
  readonly id: string;
  readonly rotulo: string;
  /** Desenlace de P5 que corresponde a esta persona si no se fuerza otro. */
  readonly escenarioPropio: string;
  readonly pantallaFinal: string;
}

export interface OpcionEscenario {
  readonly id: EscenarioIdentidadDemo;
  readonly rotulo: string;
}

export interface SelectorPersonaProps {
  readonly personas: readonly OpcionPersona[];
  readonly escenarios: readonly OpcionEscenario[];
  readonly personaSeleccionada: string;
  readonly escenarioForzado: string;
}

export function SelectorPersona({
  personas,
  escenarios,
  personaSeleccionada,
  escenarioForzado,
}: SelectorPersonaProps) {
  const [personaId, setPersonaId] = useState(personaSeleccionada);
  const [forzado, setForzado] = useState(escenarioForzado);
  const [enProceso, setEnProceso] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const persona = personas.find((opcion) => opcion.id === personaId);

  async function guardar() {
    setEnProceso(true);
    setAviso(null);
    setError(null);
    try {
      const respuesta = await fetch("/api/demo-panel/persona", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personaId, escenarioIdentidadForzado: forzado || null }),
      });
      const datos = (await respuesta.json().catch(() => ({}))) as { ok?: boolean };

      if (!datos.ok) {
        setError("No pudimos guardar la selección. Revisá la sesión del panel.");
        return;
      }
      setAviso("Selección aplicada para las próximas llamadas a los adaptadores mock.");
    } catch {
      setError("No pudimos conectarnos.");
    } finally {
      setEnProceso(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="demo-persona" className="text-xs font-semibold text-etiqueta">
            Persona de prueba
          </label>
          <select
            id="demo-persona"
            value={personaId}
            onChange={(evento) => setPersonaId(evento.target.value)}
            className="h-11 w-full rounded-lg border border-borde-sutil bg-superficie px-3 text-base text-titulo"
          >
            {personas.map((opcion) => (
              <option key={opcion.id} value={opcion.id}>
                {opcion.rotulo} → {opcion.pantallaFinal}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="demo-escenario" className="text-xs font-semibold text-etiqueta">
            Forzar desenlace de identidad (P5)
          </label>
          <select
            id="demo-escenario"
            value={forzado}
            onChange={(evento) => setForzado(evento.target.value)}
            className="h-11 w-full rounded-lg border border-borde-sutil bg-superficie px-3 text-base text-titulo"
          >
            <option value="">
              Sin forzar{persona ? ` — ${persona.escenarioPropio}` : ""}
            </option>
            {escenarios.map((opcion) => (
              <option key={opcion.id} value={opcion.id}>
                {opcion.rotulo}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={guardar}
        disabled={enProceso}
        className="inline-flex h-11 items-center justify-center self-start rounded-lg bg-naranja-500 px-5 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {enProceso ? "Aplicando…" : "Aplicar selección"}
      </button>

      {error ? (
        <p role="alert" className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">
          {error}
        </p>
      ) : null}
      {aviso ? (
        <p role="status" className="text-sm font-semibold text-verde-700 dark:text-verde-300">
          {aviso}
        </p>
      ) : null}

      <p className="text-xs text-etiqueta">
        La persona activa decide qué devuelve el proveedor de identidad simulado en P5. El
        desenlace forzado pisa al de la persona y sirve para mostrar en la demo un rechazo de
        calidad o una edad fuera del rango 18-64 sin inventar personas nuevas.
      </p>
    </div>
  );
}
