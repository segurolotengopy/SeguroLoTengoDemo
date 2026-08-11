/**
 * Banda permanente de entorno de demostración. Se renderiza desde el layout
 * raíz, así que aparece en TODAS las pantallas (flujo, Pantallas A/B, panel de
 * demo, consola, design-system) mientras `DEMO_MODE=true`; con el flag apagado
 * el layout directamente no la monta.
 *
 * Es una decisión de producto del entorno demo, sin fila en la matriz de
 * cumplimiento: su función es que nadie que vea una demostración confunda el
 * entorno con producción (todas las integraciones están simuladas).
 *
 * Componente de servidor sin estado: lee el flag en el servidor y no expone
 * nada más que el texto fijo.
 */
export function BandaDemo() {
  return (
    <div
      role="note"
      className="bg-naranja-500 px-4 py-1 text-center text-[11px] font-bold tracking-widest text-azul-950 uppercase"
    >
      Entorno de demostración — integraciones simuladas
    </div>
  );
}
