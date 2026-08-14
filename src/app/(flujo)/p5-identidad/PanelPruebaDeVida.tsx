"use client";

/**
 * Envoltorio de carga diferida del detector de prueba de vida.
 *
 * Existe sólo para aislar el `import()` dinámico: el chunk de Amplify UI pesa
 * ~1,07 MB (289 kB gzip) y así no entra en el First Load JS de P5 ni de
 * ninguna otra pantalla — se descarga recién cuando hay una sesión abierta, o
 * sea cuando la persona ya tocó `INICIAR VERIFICACIÓN`. Medición en §7.8 de
 * `docs/RECOMENDACIONES_ONBOARDING_IDENTIDAD.md`.
 *
 * `ssr: false` porque el componente necesita `navigator.mediaDevices`, que en
 * el servidor no existe.
 */
import dynamic from "next/dynamic";
import type { PruebaDeVidaEnVivoProps } from "./PruebaDeVidaEnVivo";

const PruebaDeVidaEnVivo = dynamic(() => import("./PruebaDeVidaEnVivo"), {
  ssr: false,
  loading: () => (
    <p className="text-sm text-etiqueta" role="status">
      Cargando la verificación…
    </p>
  ),
});

export function PanelPruebaDeVida(props: PruebaDeVidaEnVivoProps) {
  return <PruebaDeVidaEnVivo {...props} />;
}
