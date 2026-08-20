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
   * Optimizador de imágenes apagado (CVE-2026-27980, Snyk
   * SNYK-JS-NEXT-15674556, MEDIA 6.9).
   *
   * El optimizador de Next cachea en disco una variante por cada
   * combinación de ancho y calidad que le pidan, **sin tope**: quien golpee
   * `/_next/image?url=…&w=…&q=…` variando `q` entre 1 y 100 llena el disco
   * del cómputo y voltea el servicio. El arreglo del proveedor está solo en
   * la línea 16.x, y este proyecto está fijo en Next 15 por el límite de
   * Amplify Hosting (ver "Stack" en CLAUDE.md), así que no hay upgrade
   * disponible: hay que cerrar la superficie.
   *
   * Apagarlo no cuesta nada acá porque **ninguna pantalla usa `next/image`**
   * (la única mención en `src/` es el comentario de `CapturaConCamara.tsx`
   * explicando por qué no lo usa: las capturas son data URLs, que el
   * optimizador no sabe servir). Los logos de `public/marca/` son SVG, que
   * el optimizador pasa de largo de todos modos.
   *
   * Si algún día se agrega un `<Image>` de verdad, esto no lo rompe —
   * sirve el archivo tal cual, sin redimensionar— pero conviene revisitar
   * la decisión junto con la versión de Next.
   *
   * **Ojo con el alcance: esto gobierna la capa de Next, no lo que Amplify
   * sirve en producción.** Amplify Hosting intercepta `/_next/image` con su
   * propio optimizador. Se comprobó contra el sitio desplegado: la respuesta
   * trae la cabecera `x-amplify-optimized: true`, y discrimina según el
   * origen (400 en un SVG, 404 en un archivo inexistente) en vez del 404
   * uniforme que da el build local con esta opción puesta.
   *
   * Consecuencia práctica: el código vulnerable de Next no corre en
   * producción, pero no porque lo apaguemos nosotros —lo reemplaza Amplify—,
   * y el optimizador de Amplify es una implementación distinta que no
   * auditamos. Esta opción sigue valiendo igual: cubre el build local, el
   * `npm run dev` de cualquiera, y cualquier destino que no sea Amplify.
   * Lo que NO hay que hacer es leerla como si cerrara la superficie de
   * producción, porque no la toca.
   */
  images: {
    unoptimized: true,
  },

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
