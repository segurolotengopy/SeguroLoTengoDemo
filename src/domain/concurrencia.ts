/**
 * Conflictos de escritura concurrente sobre el expediente.
 *
 * `ExpedienteRepository.guardar` acepta un `actualizadoEnEsperado` opcional
 * (bloqueo optimista, ver `src/repositories/expediente-repository.ts`): si otra
 * petición escribió el expediente entre la lectura y el guardado, la escritura
 * falla en vez de pisar lo que el caller no vio. Esa carrera es **esperable**,
 * no un error de programación: P7 y P8 sondean su `/estado` —que puede
 * escribir— a la vez que la misma pantalla dispara otras operaciones sobre el
 * mismo expediente (el vencimiento del plazo, el envío del enlace de firma).
 * Por eso el conflicto tiene un tipo propio: los casos de uso lo atajan y lo
 * convierten en una respuesta controlada (`CONFLICTO_CONCURRENCIA`, HTTP 409),
 * nunca en un 500 con stack en los logs.
 *
 * `conReintentoPorConflicto` es la política de manejo para las operaciones
 * **convergentes**: las que, releído el expediente, vuelven a decidir desde
 * cero y no repiten efectos en proveedores externos — los sondeos de P7 y P8 y
 * el vencimiento del plazo, que tienen rama idempotente para el estado ya
 * alcanzado. Perder la carrera y reintentar con una lectura fresca converge al
 * mismo resultado que habría visto un sondeo posterior.
 *
 * Las operaciones que **abren algo en un proveedor** (`iniciarPagoP7` abre una
 * operación en Bancard, `iniciarFirmaP8` un acto en Code100) no se reintentan:
 * reintentarlas podría duplicar ese efecto externo. Atajan el conflicto una
 * sola vez, devuelven `CONFLICTO_CONCURRENCIA`, y es la pantalla la que decide
 * volver a intentar.
 */
export class ErrorEscrituraConcurrente extends Error {
  readonly expedienteId: string;

  constructor(expedienteId: string) {
    super(
      `El expediente ${expedienteId} fue modificado por otra escritura entre la lectura y este guardado ` +
        "(actualizadoEn ya no coincide).",
    );
    this.name = "ErrorEscrituraConcurrente";
    this.expedienteId = expedienteId;
  }
}

/**
 * Intentos totales (el primero incluido) antes de rendirse. Con dos escritores
 * por expediente —que es lo máximo que genera una pantalla sondeando— el
 * segundo intento ya alcanza; el tercero es margen, no espera activa.
 */
export const INTENTOS_ANTE_CONFLICTO = 3;

/**
 * Ejecuta `operacion` y, si pierde la carrera de escritura, la vuelve a correr
 * entera (la operación relee el expediente al entrar, así que el reintento ve
 * la versión que la ganó). Si el conflicto persiste tras
 * `INTENTOS_ANTE_CONFLICTO` intentos, devuelve `conflictoPersistente()` en vez
 * de lanzar. Cualquier otro error sube sin tocar.
 */
export async function conReintentoPorConflicto<T>(
  operacion: () => Promise<T>,
  conflictoPersistente: () => T,
): Promise<T> {
  for (let intento = 1; intento <= INTENTOS_ANTE_CONFLICTO; intento += 1) {
    try {
      return await operacion();
    } catch (error) {
      if (!(error instanceof ErrorEscrituraConcurrente)) throw error;
    }
  }
  return conflictoPersistente();
}
