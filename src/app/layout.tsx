import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { THEME_SCRIPT } from "@/lib/theme";
import { ThemeSync } from "@/components/layout/theme-sync";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Prime HR Innovation",
  description: "Sistema de reclutamiento",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme lo pone el script antes de pintar (sin él rige el tema claro de :root); suppressHydrationWarning deja ganar al DOM.
    <html lang="es-MX" suppressHydrationWarning className={`${plexSans.variable} ${plexMono.variable} h-full`}>
      <head>
        {/* Patrón de la guía de Next (preventing-flash-before-hydration): el script solo corre en el HTML del servidor. */}
        <script type={typeof window === "undefined" ? "text/javascript" : "text/plain"} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
