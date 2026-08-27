"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AYUDA_CAMPO_CODIGO,
  BOTON_VERIFICAR,
  EJEMPLO_CODIGO,
  ROTULO_CAMPO_CODIGO,
} from "@/domain/textos-verificacion";

/**
 * Campo para tipear el código a mano, cuando no se llegó por el QR.
 *
 * Navega a `/verificar/<código>` en vez de resolver acá: así el resultado tiene
 * una URL propia, que es lo que hace que se pueda compartir, guardar en
 * favoritos y —sobre todo— que la URL del QR y la de una búsqueda manual sean
 * la misma página.
 *
 * No valida la forma del código: eso lo hace el dominio
 * (`interpretarCodigo`), y la página de resultado explica qué pasó. Validar
 * dos veces con dos criterios distintos es cómo se llega a que el buscador
 * rechace algo que el sistema sí conoce.
 */
export function BuscadorDeCodigo({ inicial = "" }: { inicial?: string }) {
  const router = useRouter();
  const [codigo, setCodigo] = useState(inicial);

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(evento) => {
        evento.preventDefault();
        const limpio = codigo.trim();
        if (limpio !== "") router.push(`/verificar/${encodeURIComponent(limpio)}`);
      }}
    >
      <label htmlFor="codigo-documento" className="text-sm font-semibold text-titulo">
        {ROTULO_CAMPO_CODIGO}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="codigo-documento"
          name="codigo"
          value={codigo}
          onChange={(evento) => setCodigo(evento.target.value)}
          placeholder={EJEMPLO_CODIGO}
          autoComplete="off"
          spellCheck={false}
          className="h-11 flex-1 rounded-lg border border-borde-sutil bg-superficie px-3 font-mono text-sm text-titulo uppercase placeholder:normal-case placeholder:text-etiqueta focus:border-azul-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={codigo.trim() === ""}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-naranja-500 px-6 text-sm font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {BOTON_VERIFICAR}
        </button>
      </div>
      <p className="text-xs text-etiqueta">{AYUDA_CAMPO_CODIGO}</p>
    </form>
  );
}
