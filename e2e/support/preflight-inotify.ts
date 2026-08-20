/**
 * Chequeo previo del techo de inotify de la máquina.
 *
 * `next dev` vigila el árbol de archivos con inotify. Cuando el usuario llega
 * al tope de `fs.inotify.max_user_instances` —fácil en una máquina de trabajo
 * con editores, servidores de lenguaje y otros servidores de desarrollo
 * abiertos—, el `webServer` de Playwright **arranca igual** pero compila mal:
 * las pantallas llegan sin hidratar, un clic no dispara nada y la aserción de
 * navegación siguiente agota su plazo.
 *
 * Eso produce el peor tipo de rojo: escenarios que fallan en puntos
 * arbitrarios, con mensajes que apuntan al código, y que pasan de a uno en
 * aislamiento. Pasó el 19-ago-2026 y costó dos corridas completas y un
 * worktree entender que la causa no estaba en el repositorio.
 *
 * Este chequeo convierte ese rato en una línea. No arregla nada: avisa antes
 * de empezar, con el número concreto y qué hacer.
 *
 * Deliberadamente **no** sube el límite: `sysctl` es configuración del sistema
 * y esa decisión es del dueño de la máquina.
 */
import { readFileSync, readdirSync, readlinkSync } from "node:fs";

/**
 * Instancias que la corrida necesita tener libres para arrancar.
 *
 * Se mide en cupo libre y no en porcentaje: lo que decide si el servidor
 * compila bien es cuántas instancias quedan disponibles para él, no qué
 * fracción del techo está tomada. Un techo alto con todo ocupado falla igual
 * que uno bajo.
 *
 * `next dev` abre varias (webpack, el watcher del árbol, los chunks) y el
 * navegador de Playwright suma las suyas. Dieciséis deja margen sin ser
 * quisquilloso: con 91 de 128 tomadas —el estado normal de esta máquina con
 * los editores abiertos— la batería corre sin problema.
 */
const LIBRES_NECESARIAS = 16;

function leerEntero(ruta: string): number | null {
  try {
    const valor = Number.parseInt(readFileSync(ruta, "utf8").trim(), 10);
    return Number.isFinite(valor) ? valor : null;
  } catch {
    return null;
  }
}

/**
 * Instancias de inotify abiertas por procesos visibles.
 *
 * Solo cuenta las de los procesos que este usuario puede inspeccionar, que es
 * exactamente el conjunto que comparte el cupo. Los `catch` vacíos son
 * esperables: `/proc` cambia mientras se lo recorre y hay procesos ajenos.
 */
function contarInstanciasInotify(): number | null {
  let total = 0;
  try {
    for (const entrada of readdirSync("/proc")) {
      if (!/^\d+$/.test(entrada)) continue;
      let descriptores: string[];
      try {
        descriptores = readdirSync(`/proc/${entrada}/fd`);
      } catch {
        continue;
      }
      for (const fd of descriptores) {
        try {
          if (readlinkSync(`/proc/${entrada}/fd/${fd}`) === "anon_inode:inotify") total += 1;
        } catch {
          // El descriptor se cerró mientras mirábamos.
        }
      }
    }
  } catch {
    return null;
  }
  return total;
}

/**
 * Aborta la corrida si la máquina está por quedarse sin instancias de inotify.
 *
 * Silencioso en cualquier sistema donde no se pueda medir (no-Linux, `/proc`
 * restringido): un chequeo preventivo no debería impedir correr los tests.
 */
export function verificarCupoInotify(): void {
  const techo = leerEntero("/proc/sys/fs/inotify/max_user_instances");
  if (techo === null) return;

  const enUso = contarInstanciasInotify();
  if (enUso === null) return;

  const libres = techo - enUso;
  if (libres >= LIBRES_NECESARIAS) return;

  throw new Error(
    [
      `Quedan ${libres} instancias de inotify libres de ${techo} (se necesitan ${LIBRES_NECESARIAS}).`,
      "",
      "`next dev` las necesita para vigilar archivos. Sin cupo, el servidor de",
      "Playwright arranca pero compila mal, y la batería falla en puntos",
      "arbitrarios con errores que parecen del código y no lo son.",
      "",
      "Qué hacer, de menos a más invasivo:",
      "  1. Cerrar editores, servidores de lenguaje y servidores de desarrollo",
      "     que no estés usando, y volver a correr.",
      "  2. Si es recurrente, subir el techo (cambia configuración del sistema,",
      "     así que decidilo vos):",
      "       sudo sysctl fs.inotify.max_user_instances=512",
      "     Para que sobreviva a un reinicio, agregalo a /etc/sysctl.conf.",
      "",
      "Medí el estado actual con:",
      "  cat /proc/sys/fs/inotify/max_user_instances",
      "  find /proc/*/fd -lname anon_inode:inotify 2>/dev/null | wc -l",
    ].join("\n"),
  );
}
