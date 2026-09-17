import type { Metadata } from "next";
import { Pantalla05B } from "@/components/v4/pantallas/Pantalla05B";
import { sufijoTitulo } from "@/domain/entidades";

/**
 * `/confirmacion` — pantalla **05B** · Contratación confirmada (etapa 5).
 *
 * Sin arte aprobado (ver la cabecera de `Pantalla05B.tsx`). Se llega desde el
 * pago, con el documento único firmado, el cobro acreditado y el Certificado
 * de Cobertura Provisional ya emitido (D-12). La pantalla resuelve todo del
 * lado del cliente contra los mismos endpoints de P9.
 *
 * **No se genera Nota de Cobertura** y la póliza no se descarga desde acá: la
 * emite y la envía Alianza Garantía a los canales verificados. Del portal
 * salen cuatro documentos y ninguno más: el paquete firmado, el certificado,
 * el comprobante de pago (D-05) y la constancia del acto de firma (D-27).
 */

export const metadata: Metadata = {
  title: `Contratación aceptada · ${sufijoTitulo()}`,
  description:
    "La solicitud fue aceptada; Alianza Garantía emitirá y enviará la póliza a los canales verificados.",
  // Es el desenlace de un expediente concreto, no una página pública.
  robots: { index: false, follow: false },
};

export default function PantallaConfirmacion() {
  return <Pantalla05B />;
}
