"use client";

import { useState } from "react";
// Desde `textos-p3` y no desde el caso de uso: este es un componente de
// cliente, e importar el caso de uso arrastraría `node:crypto` al bundle.
import {
  ADVERTENCIA_AUTORIZACION_INICIAL_P3,
  CUERPO_AUTORIZACION_INICIAL_P3,
  NOTA_REGISTRO_P3,
} from "@/domain/textos-p3";

/**
 * Bloque `AUTORIZACIÓN INICIAL PARA COMENZAR` y botón `TENGO TODO LISTO →`
 * de P3 (docs/ESPECIFICACION_PANTALLAS.md → "P3 · Paso 3 de 9").
 *
 * El literal que se muestra es el mismo módulo versionado que el servidor
 * persiste como `textoAceptado`, así que lo que la persona lee y lo que queda
 * asentado no pueden divergir.
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
    <section className="flex flex-col gap-4 rounded-xl border border-borde-sutil bg-superficie p-5">
      <h2 className="text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
        Autorización inicial para comenzar
      </h2>

      {/* Las dos partes juntas son, palabra por palabra, el literal que el
          servidor persiste como `textoAceptado`. */}
      <p className="text-sm text-cuerpo">{CUERPO_AUTORIZACION_INICIAL_P3}</p>

      <p className="rounded-lg border border-verde-200 bg-verde-50 px-3 py-2 text-sm font-semibold text-verde-800 dark:border-verde-800 dark:bg-verde-950 dark:text-verde-200">
        {ADVERTENCIA_AUTORIZACION_INICIAL_P3}
      </p>

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <a
          href="#autorizacion-inicial"
          className="text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500"
        >
          Aviso de privacidad
        </a>
        <a
          href="#autorizacion-inicial"
          className="text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500"
        >
          Términos y condiciones
        </a>
      </div>

      <button
        type="button"
        onClick={autorizar}
        disabled={enProceso}
        className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:self-start"
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

      <p className="text-xs text-etiqueta">{NOTA_REGISTRO_P3}</p>
    </section>
  );
}
