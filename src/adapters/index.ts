/**
 * Resolución de modo de integración por puerto, vía variables de entorno.
 *
 * Este archivo deliberadamente NO importa nada de `src/adapters/mock/` ni
 * de `src/adapters/live/` — esos directorios todavía no existen (son
 * trabajo de los agentes `integraciones-mock` e `integraciones-oficiales`).
 * En su lugar, expone la lógica de resolución de modo y un helper para que
 * el futuro composition root arme el registro de adaptadores sin que este
 * archivo conozca las implementaciones concretas.
 *
 * Lee `INTEGRATION_MODE` (global, default "mock" para la demo) y el flag
 * granular `INTEGRATION_<PUERTO>` si está presente, que tiene prioridad
 * sobre el global.
 */

export type NombrePuerto =
  | "OTP"
  | "IDENTITY"
  | "COMPLIANCE"
  | "PAYMENT"
  | "SIGNATURE"
  | "POLICY"
  | "EVIDENCE"
  // Octavo puerto: consulta al registro civil (ítem 33). Nació del piloto de
  // tres formatos — es lo único que le da salida a la cédula sin MRZ.
  | "REGISTRO_CIVIL"
  // Noveno: entrega de los documentos emitidos por los canales verificados
  // (CHG-44). No es el del OTP aunque comparta proveedor: aquel entrega un
  // código, este entrega archivos a alguien ya identificado.
  | "MESSAGING";

export type ModoIntegracion = "mock" | "live";

/**
 * Solo lo que necesitamos leer de `process.env`: evita acoplarse al tipo
 * `NodeJS.ProcessEnv` (que en algunas versiones de @types/node exige
 * propiedades como `NODE_ENV`), y facilita pasar entornos falsos en tests.
 */
export type EntornoDeVariables = Readonly<Record<string, string | undefined>>;

const MODO_POR_DEFECTO: ModoIntegracion = "mock";

function normalizarModo(valor: string | undefined): ModoIntegracion | null {
  if (valor === "mock" || valor === "live") return valor;
  return null;
}

function nombreVariableGranular(puerto: NombrePuerto): string {
  return `INTEGRATION_${puerto}`;
}

/**
 * Resuelve el modo de integración de un puerto. Prioridad:
 * 1. Flag granular `INTEGRATION_<PUERTO>` (p.ej. `INTEGRATION_OTP`).
 * 2. Flag global `INTEGRATION_MODE`.
 * 3. Default: "mock".
 *
 * Cualquier valor no reconocido en las variables de entorno se ignora (no
 * lanza), y se sigue evaluando la siguiente prioridad.
 */
export function resolverModoIntegracion(
  puerto: NombrePuerto,
  entorno: EntornoDeVariables = process.env,
): ModoIntegracion {
  const granular = normalizarModo(entorno[nombreVariableGranular(puerto)]);
  if (granular) return granular;

  const global = normalizarModo(entorno.INTEGRATION_MODE);
  if (global) return global;

  return MODO_POR_DEFECTO;
}

/**
 * Helper para que el composition root (todavía no existe) resuelva el
 * adaptador de un puerto sin que este archivo importe los adaptadores
 * concretos. `fabricas.mock` y `fabricas.live` son provistas por el
 * llamador (que sí puede importar `src/adapters/mock` y `src/adapters/live`).
 */
export function resolverAdaptador<T>(
  puerto: NombrePuerto,
  fabricas: { mock: () => T; live: () => T },
  entorno: EntornoDeVariables = process.env,
): T {
  const modo = resolverModoIntegracion(puerto, entorno);
  return modo === "live" ? fabricas.live() : fabricas.mock();
}
