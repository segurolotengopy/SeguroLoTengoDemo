"use client";

import { useEffect, useState } from "react";

/**
 * Tarjeta verde `✓ WhatsApp verificado · +595 ••• ••• 000` del panel
 * izquierdo de P4 (docs/ESPECIFICACION_PANTALLAS.md → "P4 · Paso 4 de 9").
 *
 * Lee el dato de `GET /api/expediente/canales`, que solo devuelve el número
 * ya enmascarado: el número completo no sale del servidor.
 *
 * Si todavía no hay sesión, no dibuja nada — es contexto, no un error.
 */
interface RespuestaCanales {
  readonly ok?: boolean;
  readonly whatsapp?: { readonly enmascarado: string } | null;
}

export function TarjetaWhatsappVerificado() {
  const [enmascarado, setEnmascarado] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    void (async () => {
      try {
        const respuesta = await fetch("/api/expediente/canales");
        const datos = (await respuesta.json().catch(() => ({}))) as RespuestaCanales;
        if (vigente && datos.ok && datos.whatsapp) setEnmascarado(datos.whatsapp.enmascarado);
      } catch {
        // Sin tarjeta: la pantalla funciona igual.
      }
    })();
    return () => {
      vigente = false;
    };
  }, []);

  if (!enmascarado) return null;

  return (
    <p className="flex items-center gap-2 rounded-lg border border-verde-200 bg-verde-50 px-3 py-2 text-sm font-semibold text-verde-800 dark:border-verde-800 dark:bg-verde-950 dark:text-verde-200">
      <span aria-hidden="true">✓</span>
      <span>WhatsApp verificado · {enmascarado}</span>
    </p>
  );
}
