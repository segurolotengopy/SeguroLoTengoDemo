"use client";

import { useState } from "react";

/**
 * Botón `TENGO TODO LISTO →` de P3 (docs/ESPECIFICACION_PANTALLAS.md →
 * "P3 · Paso 3 de 9"), con su error y su confirmación de registro.
 *
 * El literal de la autorización (`CUERPO_AUTORIZACION_INICIAL_P3` y su
 * advertencia) lo muestra la página servidor desde el mismo módulo versionado
 * `@/domain/textos-p3` que el servidor persiste como `textoAceptado`, así que
 * lo que la persona lee y lo que queda asentado no pueden divergir.
 *
 * P3 no tiene checkbox: la especificación define el propio botón como el acto
 * de aceptación ("al presionar TENGO TODO LISTO, se autoriza..."), así que el
 * botón arranca habilitado — es el requisito de esta pantalla, no un campo
 * más que completar.
 */

interface RespuestaApi {
  readonly ok?: boolean;
  readonly motivo?: string;
  readonly autorizacion?: {
    readonly aceptadaEn: string;
    readonly ip: string;
    readonly versionAviso: string;
  };
}

const MENSAJES: Readonly<Record<string, string>> = {
  AUTORIZACION_REQUERIDA: "Necesitás autorizar el tratamiento de datos para continuar.",
  EXPEDIENTE_NO_ENCONTRADO: "Se perdió la sesión. Volvé a verificar tu WhatsApp.",
  SESION_INVALIDA: "Se perdió la sesión. Volvé a verificar tu WhatsApp.",
  ESTADO_INVALIDO: "Este proceso ya no está en el paso de autorización inicial.",
  CUERPO_INVALIDO: "No pudimos procesar el pedido. Intentá de nuevo.",
};

export function BotonAutorizacionInicial() {
  const [enProceso, setEnProceso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registro, setRegistro] = useState<RespuestaApi["autorizacion"] | null>(null);

  async function autorizar() {
    setEnProceso(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/p3/autorizacion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ aceptada: true }),
      });
      const datos = (await respuesta.json().catch(() => ({}))) as RespuestaApi;

      if (!datos.ok) {
        setError(
          (datos.motivo && MENSAJES[datos.motivo]) ??
            "No pudimos registrar la autorización. Intentá de nuevo.",
        );
        return;
      }

      setRegistro(datos.autorizacion ?? null);
      window.location.assign("/p4-correo");
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setEnProceso(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={autorizar}
        disabled={enProceso}
        className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:self-start"
      >
        {enProceso ? "Registrando…" : "Tengo todo listo →"}
      </button>

      {error ? (
        <p role="alert" className="text-sm font-semibold text-rojo-700 dark:text-rojo-300">
          {error}
        </p>
      ) : null}

      {registro ? (
        <p role="status" className="text-sm font-semibold text-verde-700 dark:text-verde-300">
          Autorización registrada el {new Date(registro.aceptadaEn).toLocaleString("es-PY")} ·
          versión {registro.versionAviso}
        </p>
      ) : null}
    </div>
  );
}
