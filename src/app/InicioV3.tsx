"use client";

/**
 * La casilla de T&C del inicio (lote F5): el acto que crea el expediente
 * (DI-10) mudado desde el bloque provisional de `/inscripcion` a su página
 * definitiva. El endpoint y el caso de uso son los mismos de F2.
 */
import { useState } from "react";
import {
  GUIA_TERMINOS_ACEPTADOS,
  GUIA_TERMINOS_PENDIENTES,
  ROTULO_TERMINOS_INICIO,
} from "@/domain/textos-inicio";

export function AceptacionInicioV3() {
  const [aceptados, setAceptados] = useState(false);
  const [enProceso, setEnProceso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function empezar() {
    setEnProceso(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/inicio/terminos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ aceptada: true }),
      });
      const datos = (await respuesta.json()) as { ok?: boolean; motivo?: string };
      if (!datos.ok && datos.motivo !== "EXPEDIENTE_YA_EXISTE") {
        setError("No pudimos registrar la aceptación. Esperá un momento e intentá de nuevo.");
        setEnProceso(false);
        return;
      }
      // Con trámite ya empezado, la inscripción reencamina sola.
      window.location.assign("/inscripcion");
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
      setEnProceso(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-start gap-2 text-sm text-cuerpo">
        <input
          type="checkbox"
          checked={aceptados}
          onChange={(evento) => setAceptados(evento.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span>{aceptados ? "✓ Términos y condiciones aceptados" : ROTULO_TERMINOS_INICIO}</span>
      </label>
      <button
        type="button"
        disabled={!aceptados || enProceso}
        onClick={() => void empezar()}
        className="h-12 rounded-lg bg-naranja-600 px-5 text-base font-bold text-white disabled:opacity-40"
      >
        Tocá acá para empezar →
      </button>
      <p className="text-xs text-etiqueta">
        {aceptados ? GUIA_TERMINOS_ACEPTADOS : GUIA_TERMINOS_PENDIENTES}
      </p>
      {error ? <p className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">{error}</p> : null}
    </div>
  );
}
