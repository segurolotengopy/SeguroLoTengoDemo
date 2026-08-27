/**
 * Chequeo previo del cupo de inotify de la máquina.
 *
 * `next dev` vigila el árbol de archivos con inotify. Cuando el usuario llega
 * al tope de `fs.inotify.max_user_watches`, el `webServer` de Playwright
 * **arranca igual** pero compila mal: las pantallas llegan sin hidratar, un
 * clic no dispara nada y la aserción de navegación siguiente agota su plazo.
 * Con el cupo del todo agotado ni siquiera arranca, y Playwright reporta un
 * `Timed out waiting from config.webServer` que tampoco dice la causa.
 *
 * Eso produce el peor tipo de rojo: escenarios que fallan en puntos
 * arbitrarios, con mensajes que apuntan al código, y que pasan de a uno en
 * aislamiento. Pasó el 19-ago-2026 y costó varias corridas completas entender
 * que la causa no estaba en el repositorio: **un solo IDE retenía 65090 de los
 * 65536 watches de la máquina**.
 *
 * Este chequeo no arregla nada: avisa antes de empezar, con los números y con
 * el nombre del proceso que se llevó el cupo. Deliberadamente **no** sube el
 * límite ni mata procesos: `sysctl` es configuración del sistema y los
 * procesos son del dueño de la máquina.
 */
import { readFileSync, readdirSync } from "node:fs";

/**
 * Watches que la corrida necesita tener libres.
 *
 * Se mide en cupo libre y no en porcentaje: lo que decide si el servidor
 * compila bien es cuántos watches quedan para él, no qué fracción del techo
 * está tomada. `next dev` necesita uno por directorio vigilado — el árbol del
 * proyecto sin `node_modules` ya son varios cientos.
 */
const WATCHES_NECESARIOS = 2_000;

interface UsoInotify {
  readonly total: number;
  /** Proceso que más watches retiene, para poder nombrarlo en el aviso. */
  readonly mayor: { readonly comando: string; readonly pid: string; readonly watches: number } | null;
}

function leerEntero(ruta: string): number | null {
  try {
    const valor = Number.parseInt(readFileSync(ruta, "utf8").trim(), 10);
    return Number.isFinite(valor) ? valor : null;
  } catch {
    return null;
  }
}

/** Watches de un proceso: cada línea `inotify wd:` de sus `fdinfo` es uno. */
function watchesDelProceso(pid: string): number {
  let total = 0;
  let descriptores: string[];
  try {
    descriptores = readdirSync(`/proc/${pid}/fdinfo`);
  } catch {
    return 0;
  }
  for (const fd of descriptores) {
    try {
      const contenido = readFileSync(`/proc/${pid}/fdinfo/${fd}`, "utf8");
      if (!contenido.startsWith("inotify wd:") && !contenido.includes("\ninotify wd:")) continue;
      for (const linea of contenido.split("\n")) {
        if (linea.startsWith("inotify wd:")) total += 1;
      }
    } catch {
      // El descriptor se cerró mientras lo mirábamos: normal al recorrer /proc.
    }
  }
  return total;
}

/**
 * Watches en uso por los procesos visibles.
 *
 * Solo cuenta los procesos que este usuario puede inspeccionar, que es
 * exactamente el conjunto que comparte el cupo.
 */
function medirUso(): UsoInotify | null {
  let total = 0;
  let mayor: UsoInotify["mayor"] = null;
  try {
    for (const entrada of readdirSync("/proc")) {
      if (!/^\d+$/.test(entrada)) continue;
      const watches = watchesDelProceso(entrada);
      if (watches === 0) continue;
      total += watches;
      if (!mayor || watches > mayor.watches) {
        let comando = "desconocido";
        try {
          comando = readFileSync(`/proc/${entrada}/comm`, "utf8").trim();
        } catch {
          // El proceso terminó mientras lo mirábamos.
        }
        mayor = { comando, pid: entrada, watches };
      }
    }
  } catch {
    return null;
  }
  return { total, mayor };
}

/**
 * Aborta la corrida si la máquina está sin cupo de inotify.
 *
 * Silencioso en cualquier sistema donde no se pueda medir (no-Linux, `/proc`
 * restringido): un chequeo preventivo no debería impedir correr los tests.
 */
export function verificarCupoInotify(): void {
  const techo = leerEntero("/proc/sys/fs/inotify/max_user_watches");
  if (techo === null) return;

  const uso = medirUso();
  if (uso === null) return;

  const libres = techo - uso.total;
  if (libres >= WATCHES_NECESARIOS) return;

  const culpable = uso.mayor
    ? `El que más retiene es ${uso.mayor.comando} (pid ${uso.mayor.pid}) con ${uso.mayor.watches}.`
    : "No se pudo identificar al proceso que los retiene.";

  throw new Error(
    [
      `Quedan ${libres} watches de inotify libres de ${techo} (se necesitan ~${WATCHES_NECESARIOS}).`,
      culpable,
      "",
      "`next dev` los necesita para vigilar archivos. Sin cupo, el servidor de",
      "Playwright arranca pero compila mal, y la batería falla en puntos",
      "arbitrarios con errores que parecen del código y no lo son.",
      "",
      "Qué hacer, de menos a más invasivo:",
      "  1. Cerrar o reiniciar el proceso de arriba —los IDEs suelen vigilar",
      "     árboles enteros— y volver a correr.",
      "  2. Si es recurrente, subir el techo (cambia configuración del sistema,",
      "     así que decidilo vos):",
      "       sudo sysctl fs.inotify.max_user_watches=524288",
      "     Para que sobreviva a un reinicio, agregalo a /etc/sysctl.conf.",
      "",
      "Medí el estado actual con:",
      "  cat /proc/sys/fs/inotify/max_user_watches",
      "  for p in /proc/[0-9]*; do t=0; for f in $p/fdinfo/*; do",
      "    n=$(grep -c '^inotify wd:' \"$f\" 2>/dev/null) || true; t=$((t+${n:-0}));",
      "  done; [ \"$t\" -gt 500 ] && echo \"$t $(cat $p/comm)\"; done | sort -rn",
    ].join("\n"),
  );
}
