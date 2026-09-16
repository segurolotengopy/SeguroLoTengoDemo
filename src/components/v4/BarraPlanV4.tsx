"use client";

/**
 * Barra de plan seleccionado, presente desde 03A hasta el final del flujo.
 *
 * Lee el plan **del expediente**, no del catálogo de hoy: si mañana sube el
 * tarifario, quien está a mitad de trámite tiene que seguir viendo el importe
 * que eligió. Eso ya lo garantiza `GET /api/expediente/plan`, que devuelve lo
 * persistido; acá solo se lo dibuja.
 *
 * Mientras la respuesta no llega, la barra **no se dibuja**. Un esqueleto gris
 * del tamaño de la barra sería más prolijo y también más mentiroso: la barra
 * afirma qué plan se está contratando, y hasta que el servidor lo diga no lo
 * sabemos.
 */

import { useEffect, useState } from "react";
import { PLANES, formatearGuaranies } from "@/domain/catalogo";
import { esPlanId } from "@/domain/catalogo";

export function BarraPlanV4({ className = "" }: { readonly className?: string }) {
  const [plan, setPlan] = useState<{ nombre: string; premio: number } | null>(null);

  useEffect(() => {
    let vigente = true;
    void (async () => {
      try {
        const respuesta = await fetch("/api/expediente/plan");
        const datos = (await respuesta.json()) as {
          ok: boolean;
          plan?: { planId: string; premioAnualGs: number };
        };
        if (!vigente || !datos.ok || !datos.plan) return;
        if (!esPlanId(datos.plan.planId)) return;
        setPlan({
          nombre: PLANES[datos.plan.planId].nombre,
          premio: datos.plan.premioAnualGs,
        });
      } catch {
        // Sin plan visible la pantalla sigue siendo usable: es información de
        // contexto, no un requisito para completar el paso.
      }
    })();
    return () => {
      vigente = false;
    };
  }, []);

  if (!plan) return null;

  return (
    <div className={`v4-tarjeta-azul px-4 py-3 ${className}`}>
      <p className="text-[0.75rem] font-bold uppercase tracking-wide" style={{ color: "var(--v4-azul-apagado)" }}>
        Plan seleccionado
      </p>
      <p className="mt-0.5">
        <span className="text-[1.125rem] font-bold" style={{ color: "var(--v4-navy)" }}>
          {plan.nombre} · {formatearGuaranies(plan.premio)}
        </span>{" "}
        <span className="text-[0.875rem]" style={{ color: "var(--v4-azul-apagado)" }}>
          al año · IVA incluido
        </span>
      </p>
    </div>
  );
}
