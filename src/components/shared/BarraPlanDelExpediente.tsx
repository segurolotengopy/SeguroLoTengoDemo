"use client";

import { useEffect, useState } from "react";
import { PLANES, formatearGuaranies } from "@/domain/catalogo";
import type { PlanId } from "@/domain/tipos";
import { BarraPlanSeleccionado } from "./BarraPlanSeleccionado";

/**
 * Barra de plan seleccionado conectada al expediente, para las pantallas P3 a
 * P8 (docs/ESPECIFICACION_PANTALLAS.md → "Elementos comunes a todas las
 * pantallas").
 *
 * `BarraPlanSeleccionado` sigue siendo puramente presentacional; este
 * envoltorio es el que va a buscar el dato a `GET /api/expediente/plan`.
 *
 * El importe que muestra es el **persistido en el expediente**, no el del
 * catálogo actual: es lo que la persona eligió y lo que respalda el
 * `idVersionOferta`. Del catálogo sale únicamente el nombre comercial.
 *
 * Si todavía no hay sesión o plan, no dibuja nada: es un elemento de
 * contexto, no un error que haya que mostrarle a nadie.
 */
export interface BarraPlanDelExpedienteProps {
  /** Ej.: "Cambiar plan" (P8: "Volver al pago"). */
  enlaceTexto: string;
  enlaceHref: string;
  /** P7 y P8 dicen "premio anual · IVA incluido" en vez de "al año · IVA incluido". */
  formatoPremio?: "al-anio" | "premio-anual";
}

interface RespuestaPlan {
  readonly ok?: boolean;
  readonly plan?: { readonly planId: PlanId; readonly premioAnualGs: number };
}

export function BarraPlanDelExpediente({
  enlaceTexto,
  enlaceHref,
  formatoPremio = "al-anio",
}: BarraPlanDelExpedienteProps) {
  const [plan, setPlan] = useState<RespuestaPlan["plan"] | null>(null);

  useEffect(() => {
    let vigente = true;
    void (async () => {
      try {
        const respuesta = await fetch("/api/expediente/plan");
        const datos = (await respuesta.json().catch(() => ({}))) as RespuestaPlan;
        if (vigente && datos.ok && datos.plan) setPlan(datos.plan);
      } catch {
        // Sin barra: la pantalla funciona igual, no hay nada que avisar.
      }
    })();
    return () => {
      vigente = false;
    };
  }, []);

  if (!plan) return null;

  const importe = formatearGuaranies(plan.premioAnualGs);

  return (
    <BarraPlanSeleccionado
      planNombre={`Seguro de Vida Oncológico · ${PLANES[plan.planId].nombre}`}
      premioTexto={
        formatoPremio === "premio-anual"
          ? `${importe} · premio anual · IVA incluido`
          : `${importe} al año · IVA incluido`
      }
      enlaceTexto={enlaceTexto}
      enlaceHref={enlaceHref}
    />
  );
}
