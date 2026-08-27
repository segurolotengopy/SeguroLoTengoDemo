import { redirect } from "next/navigation";

/**
 * La pantalla P0 · Información **no existe** (observación de la revisión de
 * gerencia del 20-ago-2026): el recorrido empieza en la selección del plan,
 * que es la página 1 de la maqueta y absorbió lo que P0 mostraba — las fichas
 * de producto (como pestañas) y el video informativo.
 *
 * La raíz se conserva como ruta solo para no romper enlaces guardados
 * (`Volver al inicio`, marcadores): redirige al paso 1.
 */
export default function Raiz(): never {
  redirect("/plan");
}
