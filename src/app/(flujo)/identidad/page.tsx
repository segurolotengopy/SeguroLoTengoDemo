import type { Metadata } from "next";
import { obtenerIdentityProvider } from "@/adapters/registro";
import { Pantalla03C } from "@/components/v4/pantallas/Pantalla03C";
import { sufijoTitulo } from "@/domain/entidades";
import { soportaSesionPruebaDeVida } from "@/ports/identity-provider";

/**
 * `/identidad` — pantalla **03C** · Verificá tu identidad (etapa 2).
 *
 * Respaldo normativo: fila 14 de la matriz de cumplimiento (Res. SEPRELAD
 * 71/19, arts. 25(a-c), 26(1)(a-b) y 29(b)). La carga de archivo del frente y
 * el dorso ya no depende de `DEMO_MODE` (D-46); la selfie sigue siendo solo
 * cámara, y quien lo hace cumplir es `POST /api/p5/captura`, no la pantalla.
 */

export const metadata: Metadata = {
  title: `Verificá tu identidad · ${sufijoTitulo()}`,
  description:
    "Captura de cédula paraguaya, selfie en vivo con prueba de vida y coincidencia facial.",
};

/**
 * Si el proveedor de identidad configurado tiene prueba de vida por streaming.
 *
 * Se resuelve **en el servidor** y baja como prop: la pantalla no tiene por qué
 * adivinar en qué modo corre el backend, y en modo mock el chunk de Amplify UI
 * no se carga siquiera. Se envuelve en try/catch porque `resolverAdaptador`
 * tira si se pide un modo `live` que no existe para otro puerto — un error de
 * configuración no debería dejar la pantalla en blanco, sino caer al camino
 * simulado.
 */
function pruebaDeVidaEnVivoDisponible(): boolean {
  try {
    return soportaSesionPruebaDeVida(obtenerIdentityProvider());
  } catch {
    return false;
  }
}

export default function PantallaIdentidad() {
  return <Pantalla03C pruebaDeVidaEnVivoDisponible={pruebaDeVidaEnVivoDisponible()} />;
}
