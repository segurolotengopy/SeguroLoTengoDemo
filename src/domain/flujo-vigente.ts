/**
 * Qué versión del flujo corre este despliegue.
 *
 * El rediseño de 3 pasos (Plan de importación del diseño, Bloque E de
 * `docs/plan/DECISIONES.md`) entra por lotes detrás del flag `FLUJO_V3`,
 * con el mismo criterio que `DEMO_MODE` y los `INTEGRATION_*`: cada lote se
 * mergea con el flag apagado —producción sigue en el flujo de 8 pasos,
 * intacta— y un PR final lo enciende cuando las tres páginas existan.
 *
 * La versión del flujo es una propiedad del **despliegue**, no del request:
 * por eso puede resolverse al cargar el módulo, y las constantes que dependen
 * de ella (`PASOS_FLUJO`, el grafo de transiciones, los `ESTADO_REQUERIDO_*`)
 * siguen siendo `const` seleccionadas a import-time, sin cambiarle la firma a
 * ningún consumidor.
 *
 * Este es el único lugar que lee la variable de entorno.
 */
export function flujoV3Activo(): boolean {
  return process.env.FLUJO_V3 === "true";
}
