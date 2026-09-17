import type { Metadata } from "next";
import { sufijoTitulo } from "@/domain/entidades";
import { Pantalla01 } from "@/components/v4/pantallas/Pantalla01";

/**
 * La raíz del portal: la portada con el catálogo de productos (arte `01`,
 * D-43), la única pantalla del flujo sin stepper y con dos marcas.
 *
 * Fuente: `docs/recepcion/2026-09-14-interseguros/02-pantallas-v4/ANALISIS_VISUAL_PNG.md`
 * → `01` y sus detalles `01A`–`01E`.
 */

export const metadata: Metadata = {
  title: `SeguroLoTengo · ${sufijoTitulo()}`,
  description:
    "Seguro de Vida Oncológico VIVE: protegé a tu familia desde tu celular, en unos minutos.",
};

export default function Raiz() {
  return <Pantalla01 />;
}
