"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Acelerador del plazo para pagar (CLAUDE.md → "Panel de demo").
 *
 * Cambia el plazo que se le va a poner a las **próximas** firmas completadas.
 * Un expediente ya firmado tiene su `plazoPagoVenceEn` congelado desde ese
 * momento: para verlo caducar en segundos hay que fijar el plazo corto
 * **antes** de firmar (D-08/D-10).
 */
export interface SelectorPlazoPagoProps {
  opciones: readonly { readonly ms: number; readonly rotulo: string }[];
  plazoActualMs: number;
}

export function SelectorPlazoPago({ opciones, plazoActualMs }: SelectorPlazoPagoProps) {
  const router = useRouter();
  const [elegido, setElegido] = useState(plazoActualMs);
  const [enProceso, setEnProceso] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function aplicar(plazoMs: number) {
    setElegido(plazoMs);
    setEnProceso(true);
    setError(null);
    setMensaje(null);
    try {
      const respuesta = await fetch("/api/demo-panel/plazo-pago", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plazoMs }),
      });
      if (!respuesta.ok) {
        setError(
          respuesta.status === 401
            ? "Se venció la sesión del panel. Volvé a ingresar la clave."
            : "No pudimos cambiar el plazo.",
        );
        return;
      }
      setMensaje("Listo. Aplica a las firmas que se completen de ahora en más.");
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
        Plazo que se le asigna a un expediente cuando queda firmado. Elegí uno
        corto <strong>antes</strong> de firmar para poder mostrar la caducidad y la Pantalla B.
      </p>

      <div className="flex flex-wrap gap-2">
        {opciones.map((opcion) => (
          <button
            key={opcion.ms}
            type="button"
            disabled={enProceso}
            onClick={() => void aplicar(opcion.ms)}
            className={`inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-semibold transition-colors disabled:opacity-40 ${
              elegido === opcion.ms
                ? "border-naranja-500 bg-naranja-50 text-naranja-900 dark:bg-naranja-950 dark:text-naranja-200"
                : "border-borde-sutil text-cuerpo hover:bg-superficie-suave"
            }`}
          >
            {opcion.rotulo}
          </button>
        ))}
      </div>

      <p className="rounded-lg border border-azul-200 bg-azul-50 px-3 py-2 text-xs text-azul-900 dark:border-azul-700 dark:bg-azul-950 dark:text-azul-100">
        El plazo nunca se alarga por acá, solo se acorta, y con <code className="font-mono">DEMO_MODE</code>{" "}
        apagado vuelven a regir las 24 horas del producto aunque quede otra cosa elegida.
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
