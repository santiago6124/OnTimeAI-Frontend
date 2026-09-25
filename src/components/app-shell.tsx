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
    <div className="flex min-h-svh flex-col">
      <AppNav />
      <main className="safe-bottom mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col gap-4 px-4 pb-10 md:px-6">
        {children}
      </main>
    </div>
  );
}
