/**
 * Marco compartido por las pantallas de acceso y alta.
 *
 * Reemplaza la pila de cuatro bloques que tenían antes —insignia, nombre,
 * bajada, encabezado de tarjeta— donde el nombre del producto y el título de
 * la pantalla competían por el mismo lugar. Ahora la marca abre la pantalla y
 * el título dice qué se hace acá; no hay bajada, porque nadie llega al login
 * necesitando que le expliquen el producto.
 */

import type { ReactNode } from "react";
import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";

export function AuthShell({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col justify-center bg-background px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        {/*
          Encabezado y pie centrados; el formulario se queda alineado a la
          izquierda. Centrar tambien las etiquetas separaria cada una de su
          campo y obligaria a buscar donde empieza lo que hay que escribir.
        */}
        <header className="flex flex-col items-center text-center">
          <BrandMark />
          <h1 className="mt-8 text-2xl font-semibold tracking-tight">{title}</h1>
        </header>

        <div className="mt-8">{children}</div>

        {footer && (
          <div className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        )}

        {/* Antes de dejar un correo, que se pueda leer qué se hace con él.
            Las tiendas también lo buscan acá. */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link href="/privacidad" className="underline underline-offset-4">
            Política de privacidad
          </Link>
        </p>
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
