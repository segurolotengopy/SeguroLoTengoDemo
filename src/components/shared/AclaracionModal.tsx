"use client";

import { ALIANZA, INTERSEGUROS, nombrePortal } from "@/domain/entidades";
import { useEffect, useId, useState } from "react";
import { DOCUMENTOS_ACLARACION } from "@/domain/textos-aclaraciones";
import type { DocumentoAclaracion, IdDocumentoAclaracion } from "@/domain/textos-aclaraciones";

/**
 * Enlace de aclaración compartido por todas las pantallas: abre el texto
 * explicativo en un modal sobre la pantalla actual (sin navegar) y permite
 * descargarlo como archivo de texto. Los textos viven en
 * `src/domain/textos-aclaraciones.ts`.
 *
 * Es contenido informativo: leerlo o descargarlo no acepta nada ni genera
 * evidencia — la aceptación contractual sigue siendo solo la firma en Code100.
 */

function comoTextoPlano(documento: DocumentoAclaracion): string {
  const lineas: string[] = [
    documento.titulo,
    `${nombrePortal()} · ${INTERSEGUROS.razonSocial} · ${ALIANZA.razonSocial}`,
    `Versión ${documento.version} — documento informativo del canal digital`,
    "",
  ];
  for (const seccion of documento.secciones) {
    if (seccion.titulo) {
      lineas.push(seccion.titulo.toUpperCase(), "");
    }
    for (const parrafo of seccion.parrafos) {
      lineas.push(parrafo, "");
    }
  }
  return lineas.join("\n");
}

function descargar(documento: DocumentoAclaracion) {
  const blob = new Blob([comoTextoPlano(documento)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `${documento.id}.txt`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

export interface EnlaceAclaracionProps {
  documento: IdDocumentoAclaracion;
  /** Texto visible del enlace. */
  children: React.ReactNode;
  className?: string;
}

const CLASE_ENLACE =
  "text-sm font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-200 dark:decoration-azul-500";

export function EnlaceAclaracion({ documento, children, className }: EnlaceAclaracionProps) {
  const [abierto, setAbierto] = useState(false);
  const idTitulo = useId();
  const doc = DOCUMENTOS_ACLARACION[documento];

  useEffect(() => {
    if (!abierto) return;
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAbierto(false);
    }
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className={className ?? CLASE_ENLACE}>
        {children}
      </button>

      {abierto ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={idTitulo}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            aria-hidden="true"
            onClick={() => setAbierto(false)}
            className="absolute inset-0 bg-azul-950/60"
          />
          <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-borde-sutil bg-superficie shadow-xl">
            <header className="flex items-start justify-between gap-4 border-b border-borde-tenue px-5 py-3">
              <div className="leading-tight">
                <h2 id={idTitulo} className="text-base font-bold text-titulo">
                  {doc.titulo}
                </h2>
                <p className="text-xs text-etiqueta">
                  Documento informativo · versión {doc.version} — leerlo no constituye aceptación
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="shrink-0 rounded-lg border border-borde-sutil px-2.5 py-1 text-sm font-bold text-cuerpo hover:bg-superficie-suave"
              >
                ✕
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {doc.secciones.map((seccion, indice) => (
                <section key={indice} className="mb-4 last:mb-0">
                  {seccion.titulo ? (
                    <h3 className="mb-1.5 text-xs font-bold tracking-wide text-azul-800 uppercase dark:text-azul-200">
                      {seccion.titulo}
                    </h3>
                  ) : null}
                  <div className="flex flex-col gap-2">
                    {seccion.parrafos.map((parrafo, i) => (
                      <p key={i} className="text-sm text-cuerpo">
                        {parrafo}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-borde-tenue px-5 py-3">
              <button
                type="button"
                onClick={() => descargar(doc)}
                className="inline-flex h-10 items-center justify-center rounded-lg border-2 border-verde-600 px-4 text-xs font-bold tracking-wide text-verde-700 uppercase transition-colors hover:bg-verde-50 dark:border-verde-400 dark:text-verde-300 dark:hover:bg-verde-950"
              >
                Descargar texto
              </button>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-naranja-500 px-4 text-xs font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400"
              >
                Cerrar
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
