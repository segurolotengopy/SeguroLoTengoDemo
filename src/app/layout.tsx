import { sufijoTitulo } from "@/domain/entidades";
import type { Metadata } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import { BandaDemo } from "@/components/shared/BandaDemo";
import { AvisoCookies } from "@/components/shared/AvisoCookies";
import { SCRIPT_TEMA_INICIAL } from "@/components/shared/tema";
import "./globals.css";

// DM Sans: la tipografía del sitio institucional interseguros360.com
// (docs/GUIA_DE_ESTILOS.md → "Tipografía").
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: sufijoTitulo(),
  description:
    "Marca y canal digital de Interseguros S.A. — Seguro de Vida Oncológico CONFÍO.",
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
      className={`${dmSans.variable} ${geistMono.variable} h-full antialiased`}
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
        <AvisoCookies />
        {children}
      </body>
    </html>
  );
}
