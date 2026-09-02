"use client";

/**
 * El entorno seguro de Bancard, simulado — la ventana modal del canvas.
 *
 * **Por qué modal y no un bloque debajo.** Bancard, en producción, se abre en
 * su propio entorno: la persona sale del portal, paga y vuelve. Dibujarlo como
 * una sección más de la pantalla —que es lo que había— no solo se ve mal:
 * cuenta mal lo que pasa, porque sugiere que el cobro ocurre acá adentro
 * (observación de Andres, 01-sep).
 *
 * El canvas lo modela como una ventana de navegador simulada: los tres puntos,
 * la barra de dirección con `vpos.bancard.com.py` y el candado, la cabecera
 * «Bancard · vPOS» con el comercio y el importe, y el cuerpo. Está copiado de
 * ahí, incluidos los colores del cromo, que no salen de la paleta del portal
 * porque **no son del portal**.
 *
 * Nada de lo que se tipea acá sale del navegador (regla inviolable #6): el
 * cuerpo lo pone quien lo usa y este componente solo dibuja la ventana.
 */
import { useEffect, useRef, type ReactNode } from "react";

export function ModalBancard({
  importeFormateado,
  alCerrar,
  children,
}: {
  readonly importeFormateado: string;
  /**
   * `null` mientras la operación está abierta y esperando respuesta del banco.
   *
   * No es una comodidad: cerrar la ventana descartaba la operación en el
   * navegador y la pantalla volvía a ofrecer «generar el pago» aunque del otro
   * lado ya hubiera una abierta. La idempotencia del servidor evita el cobro
   * doble, pero la pantalla no puede invitar a intentarlo.
   */
  readonly alCerrar: (() => void) | null;
  readonly children: ReactNode;
}) {
  const cerrarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!alCerrar) return;
    cerrarRef.current?.focus();
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === "Escape") alCerrar?.();
    }
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [alCerrar]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Entorno seguro de Bancard"
      onClick={alCerrar ?? undefined}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(32,30,29,0.68)",
        zIndex: 95,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "20px 14px",
        overflow: "auto",
      }}
    >
      <div
        onClick={(evento) => evento.stopPropagation()}
        style={{
          background: "#20262e",
          borderRadius: "16px",
          maxWidth: "560px",
          width: "100%",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
        }}
      >
        {/* Cromo de la ventana: los tres puntos y la barra de dirección. */}
        <div style={{ padding: "10px 12px", display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "6px", flex: "none" }} aria-hidden="true">
            {["#ff5f57", "#febc2e", "#28c840"].map((color) => (
              <span
                key={color}
                style={{ width: "11px", height: "11px", borderRadius: "50%", background: color, display: "block" }}
              />
            ))}
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              background: "#151a20",
              borderRadius: "8px",
              padding: "6px 10px",
              display: "flex",
              gap: "7px",
              alignItems: "center",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#28c840" strokeWidth="2.5" strokeLinecap="round" style={{ flex: "none" }} aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span
              style={{
                fontSize: "11.5px",
                color: "#cfd6de",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              vpos.bancard.com.py/pago-seguro
            </span>
          </div>
          {alCerrar ? (
            <button
              ref={cerrarRef}
              type="button"
              onClick={alCerrar}
              className="btn btn-ghost"
              style={{ fontSize: "12px", padding: "5px 10px", flex: "none", color: "#cfd6de", borderColor: "#3a434e" }}
            >
              Cerrar ✕
            </button>
          ) : (
            // Sin salida mientras el banco no conteste: cerrar dejaría la
            // operación abierta y la pantalla ofreciendo pagar de nuevo.
            <span
              className="v3-esperando"
              style={{ fontSize: "11.5px", color: "#cfd6de", flex: "none", whiteSpace: "nowrap" }}
            >
              Esperando la respuesta de Bancard…
            </span>
          )}
        </div>

        <div style={{ background: "var(--color-bg)", borderTop: "1px solid #3a434e" }}>
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--color-divider)",
              display: "flex",
              flexWrap: "wrap",
              gap: "10px 16px",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "17px", letterSpacing: "-0.01em" }}>
                Bancard · vPOS
              </div>
              <div style={{ fontSize: "11.5px", color: "var(--color-neutral-500)", marginTop: "2px" }}>
                Comercio: Alianza Garantía Seguros y Reaseguros S.A.
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "10.5px", letterSpacing: "0.09em", fontWeight: 700, color: "var(--color-neutral-500)" }}>
                A PAGAR
              </div>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "19px" }}>
                {importeFormateado}
              </div>
            </div>
          </div>
          <div style={{ padding: "20px" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}
