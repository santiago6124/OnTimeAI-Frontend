import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plane } from "lucide-react";
import { getVerifiedSession } from "@/lib/server-auth";

export const metadata = {
  title: "OnTimeAI Lite — Vuelos ATL",
  description:
    "Vista simplificada de predicciones de retrasos para vuelos en ATL. Actualizado cada 15 minutos.",
};

export default async function LiveLayout({ children }: { children: ReactNode }) {
  const user = await getVerifiedSession();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="border-b bg-background sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-primary flex items-center justify-center">
              <Plane className="size-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm tracking-tight">OnTimeAI</span>
          </div>

          {/* Live pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
            <span className="relative flex size-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-1.5 bg-emerald-500" />
            </span>
            EN VIVO · ATL
          </div>

          {/* Mode toggle and login CTA */}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-border bg-muted/40 p-0.5">
              <span className="px-3 py-1 rounded-full bg-background text-xs font-semibold shadow-sm">
                Lite
              </span>
              <Link
                href="/"
                className="px-3 py-1 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Pro
              </Link>
            </div>
            {!user && (
              <Link
                href="/login?from=/live"
                className="text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Iniciar sesión
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="border-b bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-2">
            Hartsfield-Jackson Atlanta International Airport
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            Predicciones de retraso en tiempo real
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            OnTimeAI usa un modelo de machine learning entrenado sobre 4 años de datos de vuelos
            para predecir, con hasta 4 horas de anticipación, qué vuelos de ATL llegarán con más
            de 15 minutos de demora. Actualizado cada 15 minutos.
          </p>
        </div>
      </div>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      <footer className="border-t">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>OnTimeAI — Tesis UCC Grupo 9 · 2026</span>
          <Link href="/" className="hover:text-foreground transition-colors underline underline-offset-2">
            Cambiar a modo Pro →
          </Link>
        </div>
      </footer>
    </div>
  );
}
