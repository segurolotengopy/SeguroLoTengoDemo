/**
 * `globalTeardown` de Playwright: corre una vez, al terminar todo.
 *
 * Dos limpiezas:
 *
 * 1. La clave del panel de demo, que el setup descargó del secret a un archivo
 *    temporal fuera del repo. No puede quedar en disco después de la corrida.
 * 2. La tabla efímera de esta corrida (`support/tabla-efimera.ts`). Es lo que
 *    cierra el ciclo: sin esto, cada batería dejaría una tabla viva y el
 *    problema de acumulación volvería por otro lado — con nombres distintos en
 *    vez de registros distintos.
 */
import { borrarClaveDelPanel } from "./support/secreto-panel";
import { borrarTablaDeLaCorrida } from "./support/tabla-efimera";

export default async function globalTeardown(): Promise<void> {
  await borrarClaveDelPanel();

  const tabla = process.env.DYNAMODB_TABLE;
  // Solo se borra lo que esta batería creó. Una tabla sin el prefijo es una
  // que alguien apuntó a mano para depurar, y no es nuestra para borrarla.
  if (tabla?.startsWith("slt-e2e-")) {
    await borrarTablaDeLaCorrida(tabla);
  }
}
