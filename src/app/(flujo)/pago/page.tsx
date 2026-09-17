import type { Metadata } from "next";
import { esModoDemo } from "@/app/demo-panel/_sesion";
import { Pantalla05A } from "@/components/v4/pantallas/Pantalla05A";
import { sufijoTitulo } from "@/domain/entidades";

/**
 * `/pago` — pantalla **05A** · Realizá el pago (etapa 5).
 *
 * Sin arte propio todavía (`ANALISIS_VISUAL_PNG.md` §12): extrapolada del
 * sistema visual del resto del flujo. Contador de 10 minutos contra
 * `plazoPagoVenceEn` (D-32), tres medios de pago con los textos de Bancard ya
 * versionados y la ventana simulada del proveedor en modo demostración.
 *
 * No hay cobro sin firma (D-08): el único estado desde el que se abre una
 * operación en Bancard es `FIRMADO_CLIENTE`. Nunca se persiste PAN ni CVV
 * (regla inviolable #6); la tarjeta se tipea en la ventana del proveedor.
 */

export const metadata: Metadata = {
  title: `Realizá el pago · ${sufijoTitulo()}`,
  description: "Elección del medio de pago y cobro del premio, después de la firma.",
};

export default function PantallaPago() {
  return <Pantalla05A pagoSimuladoDisponible={esModoDemo()} />;
}
