import { sufijoTitulo } from "@/domain/entidades";
import type { Metadata } from "next";
import { Arimo, Geist_Mono } from "next/font/google";
import { BandaDemo } from "@/components/shared/BandaDemo";
import { ChatFlotante } from "@/components/shared/ChatFlotante";
import { asistenteHabilitado } from "@/app/api/asistente/_habilitado";
import { SCRIPT_TEMA_INICIAL } from "@/components/shared/tema";
import "./globals.css";
// El sistema de diseño del handoff v4. Cuelga de `[data-flujo="v4"]`, que el
// <html> lleva siempre: v4 es el único flujo desde el 16-sep-2026 (D-43).
import "./v4.css";

// Arimo (D-39): tipografía del flujo desde el handoff de pantallas v4 —
// libre, gratuita y de métrica parecida a Nimbus Sans (docs/GUIA_DE_ESTILOS.md
// → "Paleta y tipografía v4"). Reemplaza a DM Sans como `--font-sans`.
const arimo = Arimo({
  variable: "--font-arimo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      // Activa `v4.css` (`[data-flujo="v4"]`), el sistema de diseño de las
      // doce pantallas del handoff. Fijo: no hay otra versión del flujo.
      data-flujo="v4"
      className={`${arimo.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }} />
      </head>
      <body className="min-h-full flex flex-col">
        {process.env.DEMO_MODE === "true" ? <BandaDemo /> : null}
        {/* Fila 85 · el aviso de uso de cookies lo trae la portada (`01` y
            su detalle `01A`), anclado al pie y con sus dos botones: no se
            monta uno global además. */}
        {children}
        {/* Asistente conversacional (Terra, ítem 35). Último en el DOM y solo con
            ASISTENTE_ENABLED=true; se oculta solo en las pantallas transaccionales
            (ver `ChatFlotante`). Montado acá y no por pantalla: convención de UI. */}
        {asistenteHabilitado() ? <ChatFlotante /> : null}
      </body>
    </html>
  );
}
