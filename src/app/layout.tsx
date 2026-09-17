import { sufijoTitulo } from "@/domain/entidades";
import type { Metadata } from "next";
import { Archivo, Arimo, DM_Sans, Geist_Mono } from "next/font/google";
import { BandaDemo } from "@/components/shared/BandaDemo";
import { AvisoCookies } from "@/components/shared/AvisoCookies";
import { ChatFlotante } from "@/components/shared/ChatFlotante";
import { asistenteHabilitado } from "@/app/api/asistente/_habilitado";
import { SCRIPT_TEMA_INICIAL } from "@/components/shared/tema";
import { flujoV3Activo, flujoV4Activo } from "@/domain/flujo-vigente";
import "./globals.css";
// El sistema de diseño del canvas, portado tal cual y scopeado a v3.
import "./canvas-v3.css";
// El sistema de diseño del handoff v4, scopeado a `[data-flujo="v4"]`.
import "./v4.css";

// Arimo (D-39): tipografía del flujo desde el handoff de pantallas v4 —
// libre, gratuita y de métrica parecida a Nimbus Sans (docs/GUIA_DE_ESTILOS.md
// → "Paleta y tipografía v4"). Reemplaza a DM Sans como `--font-sans`.
const arimo = Arimo({
  variable: "--font-arimo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// DM Sans: la tipografía del sitio institucional interseguros360.com que
// usaba el flujo antes del handoff v4. Se sigue cargando porque
// `[data-flujo="v3"]` (canvas-v3.css) la sigue nombrando explícitamente; el
// flujo vigente ya no la usa como `--font-sans` (ver globals.css).
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Archivo: la tipografía del flujo v3 (canvas aprobado de Claude Design,
// lote F5b). Se carga siempre —next/font no es condicional— pero solo la
// aplica el bloque `[data-flujo="v3"]` de globals.css; en v2 no cambia nada.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: sufijoTitulo(),
  description:
    "Marca y canal digital de Interseguros S.A. — Seguro de Vida Oncológico VIVE.",
};

/**
 * Props declaradas a mano y no con el `LayoutProps<"/">` que genera Next en
 * `.next/types`: ese tipo solo existe después de un build, así que usarlo
 * deja `npm run typecheck` roto en cualquier checkout limpio — CI y el build
 * de Amplify corren el typecheck antes de compilar.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `suppressHydrationWarning` porque el script de abajo escribe
    // `data-tema` en <html> antes de que React hidrate.
    <html
      lang="es-PY"
      suppressHydrationWarning
      // La piel del canvas (paleta, Archivo, esquinas rectas) se activa por
      // tokens bajo este atributo — ver el bloque v3 de globals.css.
      // `v4` activa `v4.css` (`[data-flujo="v4"]`) para las doce pantallas
      // del handoff; sin flag, la base visual v4 de globals.css ya aplica.
      data-flujo={flujoV4Activo() ? "v4" : flujoV3Activo() ? "v3" : undefined}
      className={`${arimo.variable} ${dmSans.variable} ${geistMono.variable} ${archivo.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }} />
      </head>
      <body className="min-h-full flex flex-col">
        {process.env.DEMO_MODE === "true" ? <BandaDemo /> : null}
        {/* Fila 85 · informa el uso de cookies. No es un panel de opciones:
            las tres del portal son necesarias y no hay ninguna que se pueda
            rechazar. Va arriba y dentro del flujo, no flotando: una barra fija
            tapaba los botones (ver `AvisoCookies`). */}
        {/* v4 trae su propio banner de cookies, anclado al pie de la portada
            y con sus dos botones (`01` y su detalle `01A`): montar también el
            de v2 mostraría dos avisos de cookies en la misma pantalla. */}
        {flujoV4Activo() ? null : <AvisoCookies />}
        {children}
        {/* Asistente conversacional (Terra, ítem 35). Último en el DOM y solo con
            ASISTENTE_ENABLED=true; se oculta solo en las pantallas transaccionales
            (ver `ChatFlotante`). Montado acá y no por pantalla: convención de UI. */}
        {asistenteHabilitado() ? <ChatFlotante /> : null}
      </body>
    </html>
  );
}
