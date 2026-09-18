/**
 * Marco de las páginas legales públicas (privacidad, soporte).
 *
 * Son las únicas páginas del sitio que un desconocido lee de arriba a abajo sin
 * sesión: las dos tiendas exigen que abran sin login y el revisor las visita.
 * Por eso no usan `AppShell` (que dibuja la barra lateral y el menú de una
 * cuenta) sino un documento angosto, con la marca arriba y nada más alrededor.
 *
 * El contenido va como `children` con clases de texto propias: no está el
 * plugin de tipografía de Tailwind y traerlo para dos páginas no compensa.
 */

import type { ReactNode } from "react";
import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  /** Fecha ISO de la última revisión; se muestra debajo del título. */
  updated?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <article className="mx-auto w-full max-w-2xl">
        <header className="flex flex-col items-center text-center">
          <Link href="/" aria-label="Ir al inicio">
            <BrandMark />
          </Link>
          <h1 className="mt-8 text-2xl font-semibold tracking-tight">{title}</h1>
          {updated && (
            <p className="mt-2 text-xs text-muted-foreground">
              Última actualización:{" "}
              <time dateTime={updated}>{formatearFecha(updated)}</time>
            </p>
          )}
        </header>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground/90 [&_a]:underline [&_a]:underline-offset-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_li]:mt-1.5 [&_p+p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>

        <footer className="mt-12 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          <Link href="/privacidad">Política de privacidad</Link>
          {" · "}
          <Link href="/soporte">Soporte</Link>
        </footer>
      </article>
    </main>
  );
}

/** "2026-09-18" → "18 de septiembre de 2026", sin depender del huso del lector. */
function formatearFecha(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
