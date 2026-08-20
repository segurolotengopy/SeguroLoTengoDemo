"use client";

import { useState } from "react";
import {
  BAJADA_COMPARAR,
  RESULTADO_COMPARACION_COINCIDE,
  RESULTADO_COMPARACION_NO_COINCIDE,
  RESULTADO_COMPARACION_SIN_SOPORTE,
  ROTULO_BOTON_ARCHIVO,
  TITULO_COMPARAR,
} from "@/domain/textos-verificacion";

/**
 * Compara el PDF que tiene quien consulta contra la huella registrada.
 *
 * **El archivo no sale del dispositivo.** El SHA-256 se calcula con
 * `crypto.subtle` en el navegador y lo único que ocurre es una comparación de
 * cadenas; no hay `fetch`, no hay subida, no hay nada que guardar. Es lo que
 * hace que esta comprobación se pueda ofrecer en una página pública sin pedirle
 * a nadie que nos confíe un documento con sus datos personales adentro.
 *
 * `crypto.subtle` solo existe en contextos seguros (HTTPS o `localhost`). Si no
 * está, la pantalla no se rompe: muestra la huella registrada y dice que hay
 * que compararla a mano, que es exactamente lo que se podía hacer antes de que
 * este bloque existiera.
 */
export function ComparadorDeHuella({ huellaEsperada }: { huellaEsperada: string }) {
  const [estado, setEstado] = useState<"INICIAL" | "CALCULANDO" | "COINCIDE" | "NO_COINCIDE" | "SIN_SOPORTE">(
    "INICIAL",
  );
  const [huellaDelArchivo, setHuellaDelArchivo] = useState<string | null>(null);

  async function comparar(archivo: File | undefined): Promise<void> {
    if (!archivo) return;

    if (typeof crypto === "undefined" || !crypto.subtle) {
      setEstado("SIN_SOPORTE");
      return;
    }

    setEstado("CALCULANDO");
    setHuellaDelArchivo(null);
    try {
      const bytes = await archivo.arrayBuffer();
      const resumen = await crypto.subtle.digest("SHA-256", bytes);
      const hash = [...new Uint8Array(resumen)]
        .map((octeto) => octeto.toString(16).padStart(2, "0"))
        .join("");
      setHuellaDelArchivo(hash);
      setEstado(hash === huellaEsperada ? "COINCIDE" : "NO_COINCIDE");
    } catch {
      setEstado("SIN_SOPORTE");
    }
  }

  return (
    <section
      aria-labelledby="verificar-comparar"
      className="flex flex-col gap-2 rounded-lg border border-borde-sutil bg-superficie p-4"
    >
      <h2
        id="verificar-comparar"
        className="text-xs font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200"
      >
        {TITULO_COMPARAR}
      </h2>
      <p className="text-sm text-cuerpo">{BAJADA_COMPARAR}</p>

      <label className="inline-flex h-10 w-fit cursor-pointer items-center justify-center rounded-lg border border-azul-300 px-4 text-xs font-bold tracking-wide text-azul-800 uppercase transition-colors hover:bg-azul-50 dark:border-azul-600 dark:text-azul-200 dark:hover:bg-azul-950">
        {ROTULO_BOTON_ARCHIVO}
        <input
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={(evento) => void comparar(evento.target.files?.[0])}
        />
      </label>

      {estado === "COINCIDE" ? (
        <p
          role="status"
          className="rounded-lg border border-verde-300 bg-verde-50 px-3 py-2 text-sm font-bold text-verde-900 dark:border-verde-700 dark:bg-verde-950 dark:text-verde-100"
        >
          ✓ {RESULTADO_COMPARACION_COINCIDE}
        </p>
      ) : null}

      {estado === "NO_COINCIDE" ? (
        <div
          role="status"
          className="flex flex-col gap-1 rounded-lg border border-rojo-300 bg-rojo-50 px-3 py-2 dark:border-rojo-700 dark:bg-rojo-950"
        >
          <p className="text-sm font-bold text-rojo-900 dark:text-rojo-100">
            {RESULTADO_COMPARACION_NO_COINCIDE}
          </p>
          {/* La huella del archivo se muestra para que la diferencia sea
              comprobable y no haya que creernos. */}
          <p className="font-mono text-[11px] break-all text-rojo-900 dark:text-rojo-100">
            {huellaDelArchivo}
          </p>
        </div>
      ) : null}

      {estado === "SIN_SOPORTE" ? (
        <p role="status" className="text-sm text-cuerpo">
          {RESULTADO_COMPARACION_SIN_SOPORTE}
        </p>
      ) : null}
    </section>
  );
}
