/**
 * Marco compartido por las pantallas de acceso y alta.
 *
 * Reemplaza la pila de cuatro bloques centrados que tenían antes —insignia,
 * nombre, bajada, encabezado de tarjeta— donde el nombre del producto y el
 * título de la pantalla competían por el mismo lugar. Ahora hay un solo
 * título: la marca queda arriba, chica, como contexto.
 */

import type { ReactNode } from "react";

export function AuthShell({
  title,
  intro,
  children,
  footer,
}: {
  title: string;
  intro: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col justify-center bg-background px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold tracking-tight">OnTimeAI</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            KATL
          </span>
        </div>

        <h1 className="mt-8 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {intro}
        </p>

        <div className="mt-8">{children}</div>

        {footer && (
          <div className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
            {footer}
          </div>
        )}
      </div>
    </main>
  );
}

/** Separador entre el acceso con Google y el formulario de correo. */
export function AuthDivider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-6">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">{children}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
