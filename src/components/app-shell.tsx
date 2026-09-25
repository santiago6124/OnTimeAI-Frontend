"use client";

import * as React from "react";

import { AppNav } from "@/components/app-nav";

export function AppShell({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  /**
   * Las dieciocho pantallas ya venían pasando `title`, y con la barra lateral
   * servía de etiqueta en el header. El navbar circular no tiene dónde
   * ponerla, y las páginas ya encabezan con su propio `<h1>`, así que la
   * etiqueta pasa a alimentar el título de la pestaña —que hasta acá era el
   * mismo string estático en toda la app, así que cualquier pestaña abierta
   * decía lo mismo que las otras—.
   *
   * Va en un efecto y no en `metadata` de Next porque estas pantallas son
   * componentes de cliente; `metadata` solo se exporta desde el servidor.
   */
  React.useEffect(() => {
    if (!title) return;
    document.title = `${title} · OnTimeAI`;
  }, [title]);

  return (
    // `safe-bottom` sube al contenedor, que no lleva `padding-bottom` propio.
    // Estaba en el mismo elemento que `pb-10` y lo anulaba —mismo choque de
    // capas que `safe-top` en app-nav—, así que el contenido terminaba pegado
    // al borde inferior en vez de tener aire para respirar al hacer scroll.
    <div className="safe-bottom flex min-h-svh flex-col">
      <AppNav />
      {/* El navbar es `fixed`, así que no reserva su lugar: este padding es
          el que hace que el contenido arranque despejado. De ahí en adelante
          pasa por debajo de la píldora al hacer scroll, que es la gracia.
          `env()` va sumado acá y no con la clase `safe-top`, que anularía el
          cálculo entero —ver la nota de capas en globals.css—. */}
      <main className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col gap-4 px-4 pt-[calc(var(--nav-offset)_+_env(safe-area-inset-top))] pb-10 md:px-6">
        {children}
      </main>
    </div>
  );
}
