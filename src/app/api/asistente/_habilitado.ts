/**
 * El asistente se enciende con `ASISTENTE_ENABLED=true`. Apagado, las rutas
 * responden 404 igual que la consola administrativa sin su flag: el widget no
 * se monta y no hay endpoint al que llamar. Existe como flag —y no como
 * presencia del adaptador— para poder apagarlo en producción sin desplegar.
 */
export function asistenteHabilitado(entorno: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return entorno.ASISTENTE_ENABLED === "true";
}
