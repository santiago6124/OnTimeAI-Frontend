import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { PaletteProvider } from "@/components/providers/palette-provider";
import { ProfileProvider } from "@/components/providers/profile-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { NativeSessionGate } from "@/components/providers/native-session-provider";

/**
 * Root layout del bundle empaquetado.
 *
 * Es el mismo que `src/app/layout.tsx` con una sola diferencia de fondo: no
 * llama a `getVerifiedSession()`. Esa función lee la cookie con `next/headers`,
 * y `cookies()` es una de las APIs que `output: 'export'` no admite — no hay
 * request que leer cuando el HTML se escribe en build time.
 *
 * En su lugar la sesión la resuelve `NativeSessionGate` al montar, contra
 * `/auth/me`, con el token del almacenamiento nativo. El resto del árbol de
 * providers queda idéntico, así que todo lo que consume `useSession()` no se
 * entera de la diferencia.
 *
 * Lo copia `scripts/build-mobile.mjs` sobre `src/app/layout.tsx` adentro de
 * `.mobile/`. En el repo el de la web queda intacto.
 */

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OnTimeAI — Predicción de retrasos aéreos",
  description:
    "Dashboard predictivo de retrasos de vuelos en ATL basado en Machine Learning.",
  icons: {
    icon: [{ url: "/icon.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

/**
 * `viewportFit: "cover"` es lo que hace que el WebView ocupe la pantalla
 * completa, incluida el área del notch y la barra de gestos. A partir de ahí el
 * contenido lo separa de los bordes el padding con `env(safe-area-inset-*)` de
 * globals.css. Sin `cover`, iOS deja bandas negras arriba y abajo.
 *
 * `userScalable: false` evita el zoom por doble tap, que en una app nativa se
 * siente como un defecto: el usuario intenta tocar una fila de la tabla de
 * vuelos y la pantalla hace zoom.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <NativeSessionGate>
            <PaletteProvider>
              <ProfileProvider>
                <TooltipProvider>
                  {children}
                  <Toaster richColors position="top-right" />
                </TooltipProvider>
              </ProfileProvider>
            </PaletteProvider>
          </NativeSessionGate>
        </ThemeProvider>
      </body>
    </html>
  );
}
