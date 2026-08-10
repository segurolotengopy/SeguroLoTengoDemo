/**
 * `globalSetup` de Playwright: corre una sola vez, antes de cualquier test.
 *
 * Dos cosas, en orden:
 *
 * 1. Descarga `DEMO_PANEL_KEY` desde el secret real (`slt-demo-app-secrets`,
 *    ver `secreto-panel.ts`) y la deja en un archivo temporal fuera del repo.
 *    Es necesario porque el panel de demo no tiene puerta de entrada por
 *    variable de entorno: la clave vive exclusivamente en Secrets Manager
 *    (`src/repositories/secrets-client.ts`), tanto para la app como para
 *    cualquier cliente que quiera entrar al panel — nosotros incluidos.
 *
 * 2. **"Calienta" las rutas del flujo contra el `webServer` de `next dev`.**
 *    Hallazgo empírico corriendo esta batería: la primera navegación de
 *    cualquier corrida (típicamente P0 → P1, con `next/link`) puede quedarse
 *    pegada en la URL de origen, porque el prefetch de `next/link` dispara la
 *    primera compilación on-demand de la ruta de destino y esa primera
 *    compilación no siempre termina dentro de la ventana de la navegación.
 *    Es una característica de `next dev` (compilación perezosa por ruta), no
 *    un bug de la app ni del test: `next build && next start` no lo tiene
 *    porque compila todo de antemano. Pedir cada ruta una vez por HTTP plano
 *    antes de que el primer test toque un botón evita la carrera sin inflar
 *    los timeouts de cada aserción.
 */
import { liberarCedulasDePrueba } from "./support/liberar-cedulas";
import { descargarClaveDelPanel } from "./support/secreto-panel";

const BASE_URL = "http://127.0.0.1:3100";

const RUTAS_A_CALENTAR = [
  "/",
  "/p1-whatsapp",
  "/p2-plan",
  "/p3-preparacion",
  "/p4-correo",
  "/p5-identidad",
  "/p6-declaraciones",
  "/p7-pago",
  "/p8-firma",
  "/p9-confirmacion",
  "/revision-manual",
  "/solicitud-vencida",
  "/demo-panel",
];

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

/** Reintenta hasta que el `webServer` responda algo (200 o no) o se agote el plazo. */
async function esperarServidorListo(timeoutMs: number): Promise<void> {
  const limite = Date.now() + timeoutMs;
  for (;;) {
    try {
      // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request -- webServer local de Playwright en loopback (127.0.0.1); no hay TLS ni tráfico fuera de la máquina.
      await fetch(BASE_URL, { method: "GET" });
      return;
    } catch {
      if (Date.now() > limite) {
        throw new Error(`El webServer de Playwright no respondió en ${BASE_URL} dentro de ${timeoutMs} ms.`);
      }
      await esperar(500);
    }
  }
}

export default async function globalSetup(): Promise<void> {
  await descargarClaveDelPanel();

  await esperarServidorListo(90_000);

  // Los escenarios 2, 3 y 6 dejan —por diseño— cédulas de prueba en estados
  // bloqueantes (regla #11) en la tabla real compartida. Antes de correr se
  // liberan por el único camino legítimo: el reinicio de la consola
  // administrativa. Ver `support/liberar-cedulas.ts`.
  await liberarCedulasDePrueba();

  for (const ruta of RUTAS_A_CALENTAR) {
    // Best-effort: si una ruta individual falla al calentar, que se note en
    // el propio test que la use — acá no vale la pena abortar toda la corrida.
    await fetch(`${BASE_URL}${ruta}`).catch(() => undefined);
  }
}
