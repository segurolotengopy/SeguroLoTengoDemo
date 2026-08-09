"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Puerta del panel de demo. La clave se manda por POST y se canjea por una
 * cookie firmada; no queda en la URL ni en el estado de la página.
 */
export function FormularioClave() {
  const router = useRouter();
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enProceso, setEnProceso] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnProceso(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/demo-panel/sesion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clave }),
      });
      if (!respuesta.ok) {
        setError(respuesta.status === 401 ? "Clave incorrecta." : "No pudimos validar la clave.");
        return;
      }
      setClave("");
      router.refresh();
    } catch {
      setError("No pudimos conectarnos.");
    } finally {
      setEnProceso(false);
    }
  }

  return (
    <form
      onSubmit={enviar}
      className="flex w-full max-w-sm flex-col gap-3 rounded-xl border border-borde-sutil bg-superficie p-5"
    >
      <label htmlFor="clave-panel" className="text-sm font-semibold text-titulo">
        Clave del panel de demo
      </label>
      <input
        id="clave-panel"
        type="password"
        autoComplete="off"
        value={clave}
        onChange={(evento) => setClave(evento.target.value)}
        className="h-11 rounded-lg border border-borde-sutil bg-superficie px-3 text-base text-titulo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja-500"
      />
      <button
        type="submit"
        disabled={!clave || enProceso}
        className="inline-flex h-11 items-center justify-center rounded-lg bg-naranja-500 px-5 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:opacity-40"
      >
        {enProceso ? "Validando…" : "Entrar"}
      </button>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">
          {error}
        </p>
      ) : null}
      <p className="text-xs text-etiqueta">
        La clave está en el secret <code className="font-mono">slt-demo-app-secrets</code>, campo{" "}
        <code className="font-mono">DEMO_PANEL_KEY</code>.
      </p>
    </form>
  );
}
