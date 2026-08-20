import type { Metadata } from "next";
import { sufijoTitulo } from "@/domain/entidades";
import {
  ALCANCE_VERIFICACION,
  AVISO_SIN_DATOS_PERSONALES,
  BAJADA_VERIFICACION,
  TITULO_VERIFICACION,
} from "@/domain/textos-verificacion";
import { BuscadorDeCodigo } from "./BuscadorDeCodigo";

/**
 * `/verificar` — la entrada sin código, para tipearlo a mano.
 *
 * La entrada normal es `/verificar/<código>`, que es lo que codifica el QR de
 * cada documento. Esta existe para el caso en que el QR no se pueda escanear
 * —papel gastado, foto reenviada, pantalla chica— y alguien tenga que copiar
 * el código que está impreso al lado.
 *
 * **Es pública y sin sesión**, a propósito: quien verifica un certificado casi
 * nunca es quien lo contrató. Por eso no muestra ningún dato de la persona
 * (ver `src/domain/verificacion-documento.ts`).
 */

export const metadata: Metadata = {
  title: `${TITULO_VERIFICACION} · ${sufijoTitulo()}`,
  description: BAJADA_VERIFICACION,
};

export default function PantallaVerificacion() {
  return (
    <>
      <header className="flex flex-col gap-2 rounded-lg border border-azul-200 bg-azul-50 p-4 dark:border-azul-700 dark:bg-azul-950">
        <h1 className="text-xl font-bold text-azul-900 sm:text-2xl dark:text-azul-100">
          {TITULO_VERIFICACION}
        </h1>
        <p className="text-sm text-azul-900 dark:text-azul-100">{BAJADA_VERIFICACION}</p>
        {/* El límite de esta página, arriba y no al pie: sin esto, "documento
            auténtico" se lee como "cobertura vigente". */}
        <p className="text-sm font-semibold text-azul-900 dark:text-azul-100">
          {ALCANCE_VERIFICACION}
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-lg border border-borde-sutil bg-superficie p-4">
        <BuscadorDeCodigo />
      </section>

      <p className="text-xs text-etiqueta">{AVISO_SIN_DATOS_PERSONALES}</p>
    </>
  );
}
