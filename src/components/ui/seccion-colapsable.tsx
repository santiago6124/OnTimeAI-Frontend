"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Cuerpo que colapsa, con la animación compartida por toda la página.
 *
 * El detalle de vuelo en modo operaciones son cinco bloques —encabezado,
 * predicción, cascada, evolución y clima— y la evolución trae adentro otros
 * tres. Dibujados enteros son varias pantallas de scroll, y lo que uno busca
 * casi siempre es el número de arriba.
 *
 * La animación va con `grid-template-rows` de `0fr` a `1fr` y no con
 * `max-height`: `height: auto` no es animable en CSS, y un máximo fijo recorta
 * el contenido largo o deja un salto al final cuando el contenido es corto.
 * Está en un solo lugar para que las cinco secciones abran igual.
 */
export function CuerpoColapsable({
  abierto,
  children,
  className,
}: {
  abierto: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-out",
        "motion-reduce:transition-none",
        abierto ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
      aria-hidden={!abierto}
    >
      <div className={cn("overflow-hidden", className)}>{children}</div>
    </div>
  );
}

/**
 * El control que abre y cierra.
 *
 * Lleva el resumen al lado del título: colapsado la sección tiene que seguir
 * diciendo lo suyo, porque si no, cerrarla es esconder información en vez de
 * ahorrar espacio.
 */
export function BotonColapsar({
  abierto,
  onToggle,
  titulo,
  resumen,
}: {
  abierto: boolean;
  onToggle: () => void;
  titulo: React.ReactNode;
  /** Lo que la sección dice cuando está cerrada. */
  resumen?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={abierto}
      className="flex w-full items-center justify-between gap-3 text-left"
    >
      <span className="flex min-w-0 items-baseline gap-2">{titulo}</span>
      <span className="flex shrink-0 items-center gap-2">
        {!abierto && resumen ? (
          <span className="text-xs text-muted-foreground">{resumen}</span>
        ) : null}
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform duration-200",
            "motion-reduce:transition-none",
            abierto && "rotate-180",
          )}
          aria-hidden
        />
      </span>
    </button>
  );
}

/** Estado de apertura con un valor inicial. */
export function useColapsable(inicialAbierto = false) {
  const [abierto, setAbierto] = React.useState(inicialAbierto);
  return { abierto, alternar: () => setAbierto((v) => !v) };
}
