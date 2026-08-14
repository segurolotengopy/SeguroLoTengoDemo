"use client";

import { useEffect, useState } from "react";

/**
 * Bloque `CASO DE ASISTENCIA`: número de caso y canales verificados
 * enmascarados.
 *
 * Sale de `GET /api/expediente/asistencia-identidad`, que solo responde si el
 * expediente está en `ASISTENCIA_IDENTIDAD`. **No muestra identidad**, porque
 * en este camino no la hay: el expediente llegó acá justamente porque no se
 * pudo verificar. Los canales sí, porque son los que la persona verificó en P1
 * y P4 y por los que un asesor la va a contactar.
 */

interface RespuestaCaso {
  readonly ok?: boolean;
  readonly numeroCaso?: string | null;
  readonly whatsappEnmascarado?: string | null;
  readonly correoEnmascarado?: string | null;
}

export function DatosDelCaso() {
  const [datos, setDatos] = useState<RespuestaCaso | null>(null);

  useEffect(() => {
    let vigente = true;
    void (async () => {
      try {
        const respuesta = await fetch("/api/expediente/asistencia-identidad");
        const cuerpo = (await respuesta.json().catch(() => ({}))) as RespuestaCaso;
        if (vigente && cuerpo.ok) setDatos(cuerpo);
      } catch {
        // Sin datos, el resto de la pantalla sigue diciendo lo esencial: que
        // no es un rechazo y que puede reintentar.
      }
    })();
    return () => {
      vigente = false;
    };
  }, []);

  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      <div>
        <dt className="text-[11px] font-bold tracking-wide text-etiqueta uppercase">
          Número de caso
        </dt>
        <dd className="font-mono text-sm font-bold text-titulo">{datos?.numeroCaso ?? "—"}</dd>
      </div>
      <div>
        <dt className="text-[11px] font-bold tracking-wide text-etiqueta uppercase">
          WhatsApp verificado
        </dt>
        <dd className="text-sm text-cuerpo">{datos?.whatsappEnmascarado ?? "—"}</dd>
      </div>
      <div>
        <dt className="text-[11px] font-bold tracking-wide text-etiqueta uppercase">
          Correo verificado
        </dt>
        <dd className="text-sm text-cuerpo">{datos?.correoEnmascarado ?? "—"}</dd>
      </div>
    </dl>
  );
}
