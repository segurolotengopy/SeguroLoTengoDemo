/**
 * Estado en memoria compartido entre los adaptadores mock y el panel de demo.
 *
 * ## Por qué existe
 *
 * Los mocks guardan su estado "en memoria del proceso" (la persona activa, las
 * operaciones de Bancard simuladas, las sesiones de firma de Code100, etc.).
 * Un `const registro = new Map()` a nivel de módulo **no alcanza** para eso en
 * Next.js: en `next dev` cada Route Handler se compila como entrypoint separado
 * y puede recibir su **propia instancia** del módulo, con su propio Map vacío.
 * Consecuencia observada en los E2E: `/api/demo-panel/persona` elegía una
 * persona y `/api/p5/analisis` seguía viendo la del arranque; `/api/p7/pago`
 * registraba la operación y `/api/p7/estado` no la encontraba nunca.
 *
 * El arreglo es el patrón estándar de Next.js para singletons de servidor:
 * anclar el estado en `globalThis` bajo una clave del registro global de
 * símbolos (`Symbol.for`), que es único por proceso aunque el módulo se
 * instancie varias veces.
 *
 * ## Límite conocido
 *
 * Esto comparte estado entre módulos **del mismo proceso**. En un despliegue
 * con varias instancias de cómputo (Amplify puede escalar horizontalmente)
 * cada instancia sigue teniendo su propio estado — límite ya documentado en
 * `persona-activa.ts`: es una ayuda de demostración, no parte del flujo ni de
 * la evidencia probatoria. Lo que pertenece al flujo real (expedientes, OTP,
 * evidencia) vive en DynamoDB/S3 vía `src/repositories/`, no acá.
 *
 * En vitest no hace falta ningún tratamiento especial: el pool por defecto
 * (`forks` con `isolate: true`) da un proceso nuevo por archivo de test, así
 * que `globalThis` nace limpio y el aislamiento entre archivos se conserva.
 */

const CLAVE_ALMACEN = Symbol.for("segurolotengo.demo.estado-mocks");

type AlmacenEstadoDemo = Map<string, unknown>;

function almacen(): AlmacenEstadoDemo {
  const contenedor = globalThis as unknown as Record<symbol, AlmacenEstadoDemo | undefined>;
  contenedor[CLAVE_ALMACEN] ??= new Map();
  return contenedor[CLAVE_ALMACEN];
}

/**
 * Devuelve el valor compartido registrado bajo `clave`, creándolo con `crear`
 * la primera vez. Todas las instancias del módulo que pidan la misma clave
 * reciben **el mismo objeto**, así que mutarlo (Map/Set/caja) se ve desde
 * cualquier Route Handler del proceso.
 */
export function estadoCompartidoDemo<T>(clave: string, crear: () => T): T {
  const registro = almacen();
  if (!registro.has(clave)) registro.set(clave, crear());
  return registro.get(clave) as T;
}
