"use client";

import { useEffect, useState } from "react";
import { aplicarTema, CLAVE_TEMA, esTema, type Tema } from "./tema";

/**
 * Botón de día/noche. Vive en `HeaderInstitucional`, así que aparece igual en
 * todas las pantallas (P0–P9, Pantalla A, Pantalla B y consola) sin que cada
 * una lo repita.
 *
 * Solo cambia la presentación: no toca el expediente, no genera evidencia y no
 * envía nada al servidor.
 */

function IconoSol() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  );
}

function IconoLuna() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </svg>
  );
}

export interface ToggleTemaProps {
  className?: string;
}

export function ToggleTema({ className = "" }: ToggleTemaProps) {
  // El servidor no conoce la preferencia del navegador; el script de arranque
  // ya pintó el tema correcto y acá solo sincronizamos el estado del control.
  const [tema, setTema] = useState<Tema>("claro");

  useEffect(() => {
    const aplicado = document.documentElement.dataset.tema;
    if (esTema(aplicado)) setTema(aplicado);
  }, []);

  const esOscuro = tema === "oscuro";

  function alternar() {
    const siguiente: Tema = esOscuro ? "claro" : "oscuro";
    setTema(siguiente);
    aplicarTema(siguiente);
    try {
      localStorage.setItem(CLAVE_TEMA, siguiente);
    } catch {
      // Navegador con almacenamiento bloqueado: el tema vale para esta visita.
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={esOscuro}
      aria-label={esOscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      title={esOscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      onClick={alternar}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-borde-sutil bg-superficie text-etiqueta transition-colors hover:text-titulo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja-500 ${className}`}
    >
      {esOscuro ? <IconoSol /> : <IconoLuna />}
    </button>
  );
}
