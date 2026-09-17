import type { Metadata } from "next";
import { Pantalla02 } from "@/components/v4/pantallas/Pantalla02";
import { sufijoTitulo } from "@/domain/entidades";

/**
 * `/plan` — pantalla **02** · Selección del plan (etapa 1 de 5).
 *
 * Arte `PANTALLA_02_SELECCION_PLAN_APROBADA_FINAL.png`, manual funcional
 * p. 25-26 (D-28). La pantalla se dibuja entera desde el handoff y resuelve
 * su estado contra los mismos endpoints de P2. Los importes y coberturas no
 * están acá: viven en la tabla versionada `src/domain/catalogo.ts`.
 */

export const metadata: Metadata = {
  title: `Elegí tu plan · ${sufijoTitulo()}`,
  description:
    "Selección del plan del Seguro de Vida Oncológico VIVE. Todavía no se contrata ni se firma.",
};

export default function PantallaSeleccionDePlan() {
  return <Pantalla02 />;
}
