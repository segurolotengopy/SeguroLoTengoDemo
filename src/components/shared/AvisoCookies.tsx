"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AVISO_COOKIES_BREVE,
  BOTON_ENTENDIDO_COOKIES,
  VERSION_COOKIES,
} from "@/domain/textos-legales";

/**
 * Aviso de cookies (fila 85 · Ley 4868/13, art. 30(c)).
 *
 * **No es un panel de consentimiento, y esa es la decisión.** Las tres cookies
 * del portal son estrictamente necesarias para sostener el trámite y no hay
 * ninguna de analítica, publicidad ni de terceros: no existe una "no
 * necesaria" que se pueda rechazar. Un panel con una sola casilla imposible de
 * desmarcar sería teatro de consentimiento — le pide permiso a la persona para
 * algo que no puede negar, y de paso entrena a aceptar sin leer.
 *
 * Lo que sí corresponde es **informar**, y eso hace: un aviso que se lee, se
 * cierra y no vuelve.
 *
 * ## Por qué es una banda del flujo y no una barra flotante
 *
 * Se escribió primero como barra fija al pie, que es lo habitual, y la batería
 * E2E lo rechazó en la primera corrida: **tapaba los botones**. Seis de siete
 * escenarios se quedaron esperando un control que estaba visible y habilitado,
 * con Playwright informando `subtree intercepts pointer events`. Una persona
 * habría visto el botón, lo habría tocado y no habría pasado nada.
 *
 * Reservar la altura al pie tampoco alcanzó: las vistas de captura no son
 * contenido de flujo normal. Una banda dentro del documento **no puede tapar
 * nada**, y para un aviso que solo hay que leer una vez, empujar la página unos
 * píxeles es un costo menor que superponerse a la interfaz.
 *
 * El día que se incorpore analítica —PostHog está previsto post-piloto—, este
 * componente tiene que convertirse en un panel de verdad **antes** de que
 * cargue nada. Ver `docs/plan/PROPUESTAS_TEXTOS_LEGALES_L6.md`, P-04.
 *
 * ## Por qué `localStorage` y no una cookie
 *
 * Guardar "ya lo leí" en una cookie obligaría a instalar una cookie más para
 * avisar de las cookies, que es absurdo. La clave lleva la **versión del
 * texto**: si el aviso cambia, vuelve a aparecer aunque la persona lo hubiera
 * cerrado antes. Es preferencia de interfaz, no dato del expediente.
 */
const CLAVE = `slt.aviso-cookies.${VERSION_COOKIES}`;

export function AvisoCookies() {
  // Arranca oculto: en el servidor no se sabe si ya se leyó, y mostrarlo para
  // esconderlo un instante después haría parpadear todas las pantallas.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(CLAVE) !== "leido") setVisible(true);
    } catch {
      // Sin `localStorage` —modo privado estricto, o el permiso denegado— el
      // aviso se muestra en cada visita. Es el comportamiento correcto: en la
      // duda, informar de más.
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function cerrar() {
    setVisible(false);
    try {
      localStorage.setItem(CLAVE, "leido");
    } catch {
      // Si no se puede guardar, el aviso reaparece la próxima vez. No se
      // interrumpe nada por eso.
    }
  }

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="border-b border-borde-sutil bg-superficie-suave px-4 py-2.5 sm:px-6"
    >
      <div className="mx-auto flex w-full max-w-pantalla flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p className="text-xs text-cuerpo">
          {AVISO_COOKIES_BREVE}{" "}
          <Link
            href="/privacidad#cookies"
            className="font-semibold text-azul-700 underline decoration-azul-300 underline-offset-2 hover:text-azul-900 dark:text-azul-300 dark:decoration-azul-600"
          >
            Ver el detalle
          </Link>
        </p>

        <button
          type="button"
          onClick={cerrar}
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-naranja-500 px-5 text-xs font-bold tracking-wide text-azul-950 uppercase transition-colors hover:bg-naranja-400 sm:self-auto"
        >
          {BOTON_ENTENDIDO_COOKIES}
        </button>
      </div>
    </div>
  );
}
