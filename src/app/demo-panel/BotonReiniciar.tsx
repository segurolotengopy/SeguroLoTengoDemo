"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Botón `Reiniciar expediente` del panel de demo.
 *
 * Olvida el expediente de esta sesión del navegador (borra las cookies) para
 * poder volver a recorrer el flujo desde P1. **No modifica el expediente
 * anterior**, que queda en la base tal como estaba: eso está explicado en
 * `src/app/api/demo-panel/reiniciar/route.ts` y es lo que impide que el panel
 * sea una puerta trasera a la regla inviolable #5.
 *
 * Pide confirmación porque la sesión en curso se pierde: si alguien está a
 * mitad de una demostración, un clic distraído lo manda de vuelta a P1.
 */
export function BotonReiniciar({ expedienteId }: { expedienteId: string | null }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [enProceso, setEnProceso] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reiniciar() {
    setEnProceso(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/demo-panel/reiniciar", { method: "POST" });
      if (!respuesta.ok) {
        setError(
          respuesta.status === 401
            ? "Se venció la sesión del panel. Volvé a ingresar la clave."
            : "No pudimos reiniciar.",
        );
        return;
      }
      setConfirmando(false);
      setMensaje("Listo. Andá a /p1-whatsapp para empezar un expediente nuevo.");
      router.refresh();
    } catch {
      setError("No pudimos conectarnos.");
    } finally {
      setEnProceso(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-cuerpo">
        {expedienteId ? (
          <>
            Esta sesión del navegador está atada al expediente{" "}
            <code className="font-mono">{expedienteId}</code>.
          </>
        ) : (
          "Esta sesión del navegador no tiene ningún expediente en curso."
        )}
      </p>

      <p className="rounded-lg border border-azul-200 bg-azul-50 px-3 py-2 text-xs text-azul-900 dark:border-azul-700 dark:bg-azul-950 dark:text-azul-100">
        Reiniciar solo olvida el expediente en <strong>esta sesión del navegador</strong>. El
        expediente anterior queda intacto en la base: no se borra, no cambia de estado y no se le
        agrega evidencia. Para crear un expediente nuevo enlazado al anterior, con justificativo,
        está la consola administrativa.
      </p>

      {confirmando ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={reiniciar}
            disabled={enProceso}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-rojo-600 px-5 text-sm font-bold tracking-wide text-white uppercase transition-colors hover:bg-rojo-500 disabled:opacity-40"
          >
            {enProceso ? "Reiniciando…" : "Sí, reiniciar"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            disabled={enProceso}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-borde-sutil px-5 text-sm font-semibold text-cuerpo transition-colors hover:bg-superficie-suave disabled:opacity-40"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setMensaje(null);
            setConfirmando(true);
          }}
          className="inline-flex h-11 items-center justify-center rounded-lg border-2 border-rojo-500 px-5 text-sm font-bold tracking-wide text-rojo-700 uppercase transition-colors hover:bg-rojo-50 sm:self-start dark:border-rojo-400 dark:text-rojo-300 dark:hover:bg-rojo-950"
        >
          Reiniciar expediente
        </button>
      )}

      {mensaje ? (
        <p role="status" className="text-sm font-semibold text-verde-700 dark:text-verde-300">
          {mensaje}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
