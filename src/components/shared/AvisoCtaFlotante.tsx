"use client";

/**
 * La píldora flotante del canvas: cuando el botón principal de la pantalla
 * quedó fuera de la vista, aparece abajo y al centro diciendo qué hay ahí
 * («Acá abajo está el botón para pasar al paso 3 ↓»), y al tocarla lleva hasta
 * él.
 *
 * **Estaba en el diseño y faltaba entera** (observación de Andres, 01-sep).
 * En pantallas largas —y las tres del flujo lo son— quien no scrollea no
 * encuentra el botón y cree que la pantalla no continúa.
 *
 * No sabe nada de ninguna pantalla: busca los botones con `data-cta`, toma el
 * primero que quedó por debajo del borde inferior y muestra su texto. La
 * pantalla declara el mensaje en el botón, igual que en el canvas.
 */
import { useCallback, useEffect, useRef, useState } from "react";

/** Margen del canvas: un botón a menos de 76 px del borde ya se considera visible. */
const MARGEN_INFERIOR = 76;
const CADA_MS = 400;

export function AvisoCtaFlotante() {
  const [texto, setTexto] = useState("");
  const objetivo = useRef<HTMLElement | null>(null);

  const revisar = useCallback(() => {
    const candidatos = Array.from(
      document.querySelectorAll<HTMLElement>("[data-cta]"),
    ).filter((nodo) => !(nodo as HTMLButtonElement).disabled && nodo.offsetParent !== null);
    const siguiente =
      candidatos.find(
        (nodo) => nodo.getBoundingClientRect().top > window.innerHeight - MARGEN_INFERIOR,
      ) ?? null;
    objetivo.current = siguiente;
    setTexto(siguiente?.getAttribute("data-cta") ?? "");
  }, []);

  useEffect(() => {
    revisar();
    const reloj = window.setInterval(revisar, CADA_MS);
    window.addEventListener("scroll", revisar, true);
    window.addEventListener("resize", revisar);
    return () => {
      window.clearInterval(reloj);
      window.removeEventListener("scroll", revisar, true);
      window.removeEventListener("resize", revisar);
    };
  }, [revisar]);

  if (texto === "") return null;

  return (
    <button
      type="button"
      aria-label="Ir al botón principal"
      onClick={() => objetivo.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
      style={{
        position: "fixed",
        left: "50%",
        bottom: "20px",
        transform: "translateX(-50%)",
        zIndex: 80,
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        border: "1px solid var(--color-accent-600)",
        background: "var(--color-accent-600)",
        color: "#fff",
        borderRadius: "999px",
        padding: "11px 20px",
        fontWeight: 600,
        fontSize: "13.5px",
        lineHeight: 1.2,
        cursor: "pointer",
        boxShadow: "0 8px 24px rgba(32,30,29,0.22)",
        minHeight: "44px",
      }}
    >
      {texto}
      <span aria-hidden="true" className="v3-cta-flecha" style={{ fontSize: "17px" }}>
        ↓
      </span>
    </button>
  );
}
