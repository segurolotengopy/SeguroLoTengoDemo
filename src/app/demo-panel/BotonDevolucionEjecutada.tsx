"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Última etapa de la Pantalla B: Alianza devolvió el premio al medio de origen
 * (DEVOLUCION_EN_TRAMITE → DEVUELTO).
 *
 * Ocurre presencialmente, en las oficinas de Alianza, contra el formulario
 * firmado. El panel hace de ese actor externo, igual que hace de Bancard y de
 * Code100. En producción esta acción va en la consola administrativa.
 *
 * No pide ningún dato de destino, y no es un descuido: la devolución va
 * únicamente al medio de origen que ya está en el expediente. No hay campo
 * donde escribir otra cuenta.
 */
export function BotonDevolucionEjecutada({ estado }: { estado: string | null }) {
  const router = useRouter();
  const [enProceso, setEnProceso] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enTramite = estado === "DEVOLUCION_EN_TRAMITE";
  const yaDevuelto = estado === "DEVUELTO";

  async function marcar() {
    setEnProceso(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/demo-panel/devolucion", { method: "POST" });
      if (!respuesta.ok) {
        setError(
          respuesta.status === 401
            ? "Se venció la sesión del panel. Volvé a ingresar la clave."
            : "El expediente de esta sesión no está en trámite de devolución.",
        );
        return;
      }
      setMensaje("Listo. El expediente quedó en DEVUELTO.");
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
        {yaDevuelto
          ? "El expediente de esta sesión ya está en DEVUELTO."
          : enTramite
            ? "El expediente de esta sesión está en trámite de devolución. Este botón simula que Alianza la ejecutó."
            : "Disponible cuando el expediente de esta sesión esté en DEVOLUCIÓN EN TRÁMITE (Pantalla B, con QR o débito)."}
      </p>

      <button
        type="button"
        disabled={enProceso || !enTramite}
        onClick={() => void marcar()}
        className="inline-flex h-11 items-center justify-center rounded-lg bg-verde-700 px-5 text-sm font-bold tracking-wide text-white uppercase transition-colors hover:bg-verde-600 disabled:opacity-40 sm:self-start"
      >
        {enProceso ? "Registrando…" : "Alianza ejecutó la devolución"}
      </button>

      <p className="rounded-lg border border-azul-200 bg-azul-50 px-3 py-2 text-xs text-azul-900 dark:border-azul-700 dark:bg-azul-950 dark:text-azul-100">
        La devolución va siempre al <strong>medio de origen</strong>: no hay ningún campo donde
        indicar otra cuenta, ni acá ni en el dominio.
      </p>

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
