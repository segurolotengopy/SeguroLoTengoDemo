"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Las cuatro palancas de "forzar fallos puntuales" del panel de demo.
 *
 * Cada una se arma para **un** intento: se muestra el error, la persona
 * reintenta y el segundo intento funciona. Por eso el rótulo dice "se consume
 * en el próximo intento" — si quedaran pegadas habría que volver acá a
 * apagarlas en medio de la demostración.
 */
export interface FallaVisible {
  readonly id: string;
  readonly rotulo: string;
  readonly donde: string;
  readonly efecto: string;
  readonly armada: boolean;
}

export interface SelectorFallasProps {
  fallas: readonly FallaVisible[];
}

export function SelectorFallas({ fallas }: SelectorFallasProps) {
  const router = useRouter();
  const [enProceso, setEnProceso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(cuerpo: Record<string, unknown>) {
    setEnProceso(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/demo-panel/fallas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      if (!respuesta.ok) {
        setError(
          respuesta.status === 401
            ? "Se venció la sesión del panel. Volvé a ingresar la clave."
            : "No pudimos cambiar la palanca.",
        );
        return;
      }
      router.refresh();
    } catch {
      setError("No pudimos conectarnos.");
    } finally {
      setEnProceso(false);
    }
  }

  const algunaArmada = fallas.some((falla) => falla.armada);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-cuerpo">
        Cada palanca se <strong>consume en el próximo intento</strong> que la encuentre: se ve el
        error una vez y el reintento funciona.
      </p>

      <ul className="flex flex-col gap-2">
        {fallas.map((falla) => (
          <li
            key={falla.id}
            className={`flex flex-col gap-1 rounded-lg border p-3 transition-colors ${
              falla.armada
                ? "border-naranja-500 bg-naranja-50 dark:bg-naranja-950"
                : "border-borde-tenue bg-superficie-suave"
            }`}
          >
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={falla.armada}
                disabled={enProceso}
                onChange={(evento) =>
                  void enviar({ falla: falla.id, activa: evento.target.checked })
                }
                className="size-4 accent-naranja-500"
              />
              <span className="text-sm font-semibold text-titulo">{falla.rotulo}</span>
              <span className="text-xs text-etiqueta">· {falla.donde}</span>
            </label>
            <p className="pl-7 text-xs text-cuerpo">{falla.efecto}</p>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={enProceso || !algunaArmada}
        onClick={() => void enviar({ reiniciar: true })}
        className="inline-flex h-10 items-center justify-center rounded-lg border border-borde-sutil px-4 text-sm font-semibold text-cuerpo transition-colors hover:bg-superficie-suave disabled:opacity-40 sm:self-start"
      >
        Desarmar todas
      </button>

      {error ? (
        <p role="alert" className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
