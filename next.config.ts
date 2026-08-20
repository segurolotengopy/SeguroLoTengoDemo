import type { NextConfig } from "next";
import { REDIRECCIONES_RUTAS_VIEJAS } from "./src/domain/rutas-flujo";

/**
 * Exclusión del bundle del panel de demo (CLAUDE.md → "Panel de demo":
 * "excluido del bundle cuando el flag está apagado").
 *
 * Los archivos de ruta del panel usan la extensión `page.demo.tsx` /
 * `route.demo.ts`. Con `DEMO_MODE` apagado esas extensiones no figuran en
 * `pageExtensions`, así que App Router ni siquiera las ve: `/demo-panel` y
 * `/api/demo-panel/*` no existen en el build — no es un 404 en runtime, es
 * que la ruta no se compila. Los componentes que solo el panel importa
 * quedan fuera del grafo y no entran al bundle.
 *
 * La decisión es de **tiempo de build**: un despliegue con el flag apagado
 * no contiene el código del panel. Las guardas de runtime (`esModoDemo()` en
 * la página y en cada Route Handler) se conservan igual, como defensa en
 * profundidad para un build hecho con el flag prendido pero servido con el
 * flag apagado.
 */
const esModoDemo = process.env.DEMO_MODE === "true";

const nextConfig: NextConfig = {
  pageExtensions: esModoDemo ? ["demo.tsx", "demo.ts", "tsx", "ts"] : ["tsx", "ts"],

  /**
   * Rutas viejas del wizard (`/p1-whatsapp`, `/p7-pago`, …) hacia las nuevas.
   *
   * Permanentes (308) y no 404: hay enlaces con el formato viejo en mensajes
   * de WhatsApp y correos ya enviados durante las pruebas, y un enlace roto en
   * un canal de contratación termina en una llamada de alguien que cree que
   * perdió su trámite. La tabla vive en el dominio (`rutas-flujo.ts`), junto
   * al orden que la produjo, para que agregar un paso no obligue a acordarse
   * de este archivo.
   */
  async redirects() {
    return Object.entries(REDIRECCIONES_RUTAS_VIEJAS).map(([source, destination]) => ({
      source,
      destination,
      permanent: true,
    }));
  },
};

export default nextConfig;
