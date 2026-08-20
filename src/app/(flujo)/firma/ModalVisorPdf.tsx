"use client";

import { useEffect, useRef } from "react";

import {
  BOTON_CERRAR_VISOR_P8,
  NOTA_SIN_DESCARGA_ANTES_DE_FIRMAR_P8,
  TITULO_VISOR_PDF_P8,
} from "@/domain/textos-p8";

/**
 * Visor del documento cerrado, dentro de la misma pantalla.
 *
 * Antes esto era un enlace con `target="_blank"`: el PDF se abría en una
 * pestaña nueva, con la barra del visor del navegador entera —descargar,
 * imprimir, guardar— y sacando a la persona del flujo justo en el paso donde
 * tiene que decidir si firma. Se lee acá y se vuelve al botón sin perder el
 * lugar.
 *
 * **Qué tan "restringida" está la descarga, dicho sin adornos.** El `#toolbar=0`
 * del fragmento le pide al visor embebido del navegador que no dibuje su barra
 * de herramientas, y la petición sale sin `descargar`, así que el Route Handler
 * responde `content-disposition: inline` en vez de `attachment`. Las dos cosas
 * juntas quitan el camino evidente. Ninguna de las dos es un control de
 * seguridad: quien abra las herramientas de desarrollo tiene la URL del PDF.
 * Por eso `NOTA_SIN_DESCARGA_ANTES_DE_FIRMAR_P8` dice que el visor "no permite
 * descargarlo ni imprimirlo" y **no** dice que el archivo sea inaccesible — es
 * la misma honestidad que ya tenía el texto antes de que existiera este modal.
 *
 * El scroll es del `<iframe>`, no del modal: el documento tiene varias páginas
 * y lo que hay que poder recorrer es el PDF, no la ventana que lo contiene.
 */
export function ModalVisorPdf({
  codigo,
  alCerrar,
}: {
  readonly codigo: string;
  readonly alCerrar: () => void;
}) {
  const cerrarRef = useRef<HTMLButtonElement>(null);

  // Sin `descargar`: el handler responde `inline` y el navegador lo muestra en
  // vez de bajarlo. `#toolbar=0&navpanes=0` esconde la barra del visor embebido.
  const url = `/api/p8/documento?codigo=${encodeURIComponent(codigo)}#toolbar=0&navpanes=0`;

  // Escape cierra, y el foco arranca en el botón de cerrar: quien navega con
  // teclado tiene que poder salir de un modal a pantalla casi completa sin
  // tener que tabular por dentro del PDF, que es un documento y no un
  // formulario.
  useEffect(() => {
    cerrarRef.current?.focus();
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === "Escape") alCerrar();
    }
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [alCerrar]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={TITULO_VISOR_PDF_P8}
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-azul-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div className="flex h-full w-full max-w-4xl flex-col rounded-none border border-borde-sutil bg-superficie shadow-2xl sm:h-[92vh] sm:rounded-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-borde-sutil px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <h2 className="truncate text-sm font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
              {TITULO_VISOR_PDF_P8}
            </h2>
            <code className="truncate font-mono text-[11px] text-etiqueta">{codigo}</code>
          </div>
          <button
            ref={cerrarRef}
            type="button"
            onClick={alCerrar}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-azul-300 px-4 text-xs font-bold tracking-wide text-azul-800 uppercase transition-colors hover:bg-azul-50 dark:border-azul-600 dark:text-azul-200 dark:hover:bg-azul-950"
          >
            {BOTON_CERRAR_VISOR_P8}
          </button>
        </header>

        {/* `flex-1` + `min-h-0` para que el iframe ocupe lo que sobra y su
            propio scroll funcione: sin `min-h-0` el hijo de un flex no baja de
            su altura de contenido y el documento se corta. */}
        <div className="min-h-0 flex-1 bg-superficie-suave">
          <iframe
            src={url}
            title={TITULO_VISOR_PDF_P8}
            className="size-full rounded-b-none sm:rounded-b-2xl"
          />
        </div>

        <p className="border-t border-borde-sutil px-4 py-2.5 text-xs text-etiqueta">
          {NOTA_SIN_DESCARGA_ANTES_DE_FIRMAR_P8}
        </p>
      </div>
    </div>
  );
}
