"use client";

/**
 * Envoltorio de carga diferida del firmador simulado, con el mismo criterio
 * que `PanelPruebaDeVida` en P5.
 *
 * El modal solo tiene sentido con `DEMO_MODE=true` —fuera de ahí el endpoint
 * que usa ni siquiera se compila— así que no tiene por qué entrar en el First
 * Load JS de P8. Con el `import()` dinámico, su chunk se descarga recién
 * cuando la persona abre la ventana del firmador.
 */
import dynamic from "next/dynamic";
import type { ModalFirmadorSimuladoProps } from "./ModalFirmadorSimulado";

const ModalFirmadorSimulado = dynamic(() => import("./ModalFirmadorSimulado"), {
  loading: () => (
    <p className="text-sm text-etiqueta" role="status">
      Abriendo el firmador…
    </p>
  ),
});

export function PanelFirmadorSimulado(props: ModalFirmadorSimuladoProps) {
  return <ModalFirmadorSimulado {...props} />;
}
