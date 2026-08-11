import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BandaDemo } from "@/components/shared/BandaDemo";
import { SCRIPT_TEMA_INICIAL } from "@/components/shared/tema";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SeguroLoTengo",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }} />
      </head>
      <body className="min-h-full flex flex-col">
        {process.env.DEMO_MODE === "true" ? <BandaDemo /> : null}
        {children}
      </body>
    </html>
  );
}
