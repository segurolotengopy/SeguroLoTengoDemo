"use client";

/**
 * Las tres superficies que el handoff v4 usa para todo lo que se abre encima
 * de una pantalla: la **hoja** (01A, 01C, 01D, 01E, 02A-C, 03B_02, 03E1), el
 * **panel lateral** (01B menú) y el **diálogo** (01B salida, 03E2A).
 *
 * Están juntas en un archivo porque comparten el velo, el foco y el cierre con
 * Escape, y separarlas invitaba a que cada una implementara su propio manejo
 * de teclado — que es exactamente cómo se llega a un modal del que no se puede
 * salir sin el mouse.
 *
 * **El filete rojo de 3 px es la firma del modal** y ninguna otra superficie
 * del producto lo lleva (`ANALISIS_VISUAL_PNG.md` §0.4).
 */

import { useCallback, useEffect, useId, useRef } from "react";

function useCierreConEscape(alCerrar: () => void) {
  useEffect(() => {
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === "Escape") alCerrar();
    }
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [alCerrar]);
}

/**
 * Devuelve el foco a donde estaba al cerrarse.
 *
 * Sin esto, cerrar el aviso de privacidad desde 03B deja el foco en el `body`
 * y quien navega con teclado tiene que recorrer la pantalla entera otra vez
 * para volver a la casilla que estaba por marcar.
 */
function useFocoDevuelto() {
  const anterior = useRef<HTMLElement | null>(null);
  useEffect(() => {
    anterior.current = document.activeElement as HTMLElement | null;
    return () => anterior.current?.focus?.();
  }, []);
}

/** La ✕ circular con borde azul que llevan todas las superficies. */
export function BotonCerrarV4({
  alCerrar,
  etiqueta = "Cerrar",
  claro = false,
}: {
  readonly alCerrar: () => void;
  readonly etiqueta?: string;
  readonly claro?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={alCerrar}
      aria-label={etiqueta}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors"
      style={{
        borderColor: claro ? "#FFFFFF" : "var(--v4-azul)",
        color: claro ? "#FFFFFF" : "var(--v4-azul)",
        background: claro ? "transparent" : "var(--v4-blanco)",
      }}
    >
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
        <path
          d="M6 6 L18 18 M18 6 L6 18"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}

export interface HojaV4Props {
  readonly titulo: string;
  readonly bajada?: string;
  readonly alCerrar: () => void;
  /** Rótulo del título: versalitas en las hojas de selección, caja normal en los detalles. */
  readonly tituloEnVersalitas?: boolean;
  /** Alto de la hoja como fracción de la pantalla. Los detalles van casi al tope. */
  readonly alto?: "alta" | "media";
  readonly children: React.ReactNode;
}

/**
 * Hoja que sube desde abajo, con filete rojo, título, ✕ y cuerpo desplazable.
 *
 * El arte la dibuja de dos alturas: los detalles legales ocupan casi toda la
 * pantalla (`alta`) y las hojas de selección de 03D y 03E, poco más de la
 * mitad (`media`).
 */
export function HojaV4({
  titulo,
  bajada,
  alCerrar,
  tituloEnVersalitas = false,
  alto = "alta",
  children,
}: HojaV4Props) {
  const idTitulo = useId();
  const cerrar = useCallback(() => alCerrar(), [alCerrar]);
  useCierreConEscape(cerrar);
  useFocoDevuelto();

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={cerrar}
        className="absolute inset-0 cursor-default"
        style={{ background: "rgba(85, 112, 157, 0.35)" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="relative mx-auto flex w-full max-w-[38rem] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl"
        style={{ height: alto === "alta" ? "92vh" : "62vh" }}
      >
        <div className="v4-filete-rojo" />
        {/* Asa: el arte la dibuja en las hojas de selección. */}
        <div className="mx-auto mt-2 h-1 w-10 rounded-full" style={{ background: "var(--v4-gris-borde)" }} />
        <div className="flex items-start justify-between gap-4 px-5 pt-4">
          <div>
            <h2
              id={idTitulo}
              className="font-bold"
              style={{
                color: "var(--v4-navy)",
                fontSize: tituloEnVersalitas ? "1.0625rem" : "1.5rem",
                textTransform: tituloEnVersalitas ? "uppercase" : "none",
                letterSpacing: tituloEnVersalitas ? "0.02em" : "-0.01em",
              }}
            >
              {titulo}
            </h2>
            {bajada ? <p className="v4-bajada mt-1">{bajada}</p> : null}
          </div>
          <BotonCerrarV4 alCerrar={cerrar} />
        </div>
        <div className="mx-5 mt-3 h-px shrink-0" style={{ background: "var(--v4-gris-borde)" }} />
        <div className="v4-scroll-azul flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/**
 * Panel lateral izquierdo del menú (01B).
 *
 * Ocupa ~80 % del ancho, va de borde a borde en vertical y deja ver la
 * pantalla atenuada a la derecha. El filete rojo va **solo sobre el ancho del
 * panel**, no de lado a lado de la pantalla.
 */
export function PanelLateralV4({
  titulo,
  alCerrar,
  children,
}: {
  readonly titulo: string;
  readonly alCerrar: () => void;
  readonly children: React.ReactNode;
}) {
  const idTitulo = useId();
  const cerrar = useCallback(() => alCerrar(), [alCerrar]);
  useCierreConEscape(cerrar);
  useFocoDevuelto();

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="relative flex h-full w-[82%] max-w-[22rem] flex-col overflow-hidden rounded-r-2xl bg-white shadow-2xl"
      >
        <div className="v4-filete-rojo" />
        <div className="flex items-center justify-between gap-4 px-5 pt-5">
          <h2 id={idTitulo} className="text-2xl font-bold" style={{ color: "var(--v4-navy)" }}>
            {titulo}
          </h2>
          <BotonCerrarV4 alCerrar={cerrar} />
        </div>
        <div className="mx-5 mt-4 h-px" style={{ background: "var(--v4-gris-borde)" }} />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
      <button
        type="button"
        aria-label="Cerrar"
        onClick={cerrar}
        className="h-full flex-1 cursor-default"
        style={{ background: "rgba(85, 112, 157, 0.35)" }}
      />
    </div>
  );
}

/**
 * Diálogo centrado con filete rojo (01B · confirmación de salida).
 *
 * Sin ✕: el arte solo ofrece los dos botones, y agregarle un aspa cambiaría
 * cuál es la salida por omisión de una decisión destructiva.
 */
export function DialogoV4({
  titulo,
  alCerrar,
  children,
}: {
  readonly titulo: string;
  readonly alCerrar: () => void;
  readonly children: React.ReactNode;
}) {
  const idTitulo = useId();
  const cerrar = useCallback(() => alCerrar(), [alCerrar]);
  useCierreConEscape(cerrar);
  useFocoDevuelto();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={cerrar}
        className="absolute inset-0 cursor-default"
        style={{ background: "rgba(85, 112, 157, 0.45)" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="relative w-full max-w-[24rem] overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <div className="v4-filete-rojo" />
        <div className="px-5 py-6">
          <h2
            id={idTitulo}
            className="text-center text-xl font-bold"
            style={{ color: "var(--v4-navy)" }}
          >
            {titulo}
          </h2>
          {children}
        </div>
      </div>
    </div>
  );
}
