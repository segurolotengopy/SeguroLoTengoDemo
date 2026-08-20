/**
 * Almacén del límite de tasa, del lado HTTP.
 *
 * La política vive en `src/domain/rate-limit.ts` y es pura; acá está lo único
 * que no puede serlo: dónde se guardan las marcas de tiempo y de dónde sale el
 * reloj.
 *
 * **Es memoria del proceso, anclada en `globalThis`.** Lo primero por la misma
 * razón que `estadoCompartidoDemo`: en `next dev` cada ruta compila como
 * entrypoint con su propia instancia de módulo, así que un `Map` de módulo
 * daría un contador por endpoint en vez de uno por IP. Lo segundo es la
 * limitación conocida: **con más de una instancia de cómputo el límite es por
 * instancia**, y quien tenga suerte con el balanceador consigue el cupo
 * multiplicado. Para el demo alcanza; para producción hay que mover esto a un
 * almacén compartido, y por eso el módulo expone una interfaz y no un `Map`
 * suelto.
 */
import {
  evaluarLimite,
  type PoliticaLimite,
  type RegistroLimite,
} from "@/domain/rate-limit";

const CLAVE = Symbol.for("segurolotengo.limitador");

interface Almacen {
  readonly registros: Map<string, RegistroLimite>;
}

function almacen(): Almacen {
  const global = globalThis as typeof globalThis & { [CLAVE]?: Almacen };
  global[CLAVE] ??= { registros: new Map<string, RegistroLimite>() };
  return global[CLAVE];
}

export interface ResultadoLimitador {
  readonly permitido: boolean;
  readonly reintentarEnSegundos?: number;
}

/**
 * Registra un evento y dice si se admite.
 *
 * `identificador` es lo que el cliente **no** elige —hoy, la IP—: contar por
 * cookie sería contar lo que quien ataca puede tirar y renovar.
 */
export function admitirEvento(
  politica: PoliticaLimite,
  identificador: string,
  ahoraMs: number = Date.now(),
): ResultadoLimitador {
  const clave = `${politica.nombre}|${identificador}`;
  const { registros } = almacen();
  const resultado = evaluarLimite(registros.get(clave) ?? [], politica, ahoraMs);
  registros.set(clave, resultado.registro);

  return resultado.permitido
    ? { permitido: true }
    : { permitido: false, reintentarEnSegundos: resultado.reintentarEnSegundos };
}

/** Para los tests: deja el almacén como recién arrancado. */
export function limpiarLimitador(): void {
  almacen().registros.clear();
}
