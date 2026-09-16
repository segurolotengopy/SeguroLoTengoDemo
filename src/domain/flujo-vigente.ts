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

/**
 * `true` cuando este despliegue corre el flujo v4 (D-43).
 *
 * v4 **es la versión del producto**: v2 y v3 dejaron de ser objetivos. El flag
 * existe por una razón operativa y no de diseño — `PASOS_FLUJO`, el grafo de
 * transiciones y la batería E2E se resuelven a import-time desde la versión
 * activa, así que encenderlo antes de que existan las 15 pantallas dejaría la
 * suite en rojo. Cuando estén, el flag se enciende y v2 y v3 **se borran**.
 *
 * Tiene precedencia sobre `FLUJO_V3`: si alguien deja las dos encendidas, la
 * que manda es v4, que es la única que se sigue construyendo.
 */
export function flujoV4Activo(): boolean {
  return process.env.FLUJO_V4 === "true";
}

/** Nombre de la versión de flujo activa. Para evidencias y para la consola. */
export function versionDeFlujo(): "v2" | "v3" | "v4" {
  if (flujoV4Activo()) return "v4";
  return flujoV3Activo() ? "v3" : "v2";
}
