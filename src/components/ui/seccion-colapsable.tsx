"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Las secciones del detalle de vuelo no esconden: comprimen.
 *
 * Hubo una primitiva `CuerpoColapsable` que animaba el alto de cero a auto y
 * se quitó. Cerrar para ocultar ahorra espacio tirando el contenido, y lo que
 * se busca es que la sección siga diciendo lo suyo, apretada: el mismo dato
 * con menos etiquetas, menos aire y sin las frases que se entienden por
 * contexto. Cada sección trae sus dos versiones y elige cuál dibujar.
 */

/**
 * El control que alterna entre la versión compacta y la detallada de una
 * sección.
 *
 * No es "mostrar y ocultar": las dos versiones dicen lo mismo, una apretada y
 * otra con las etiquetas y el aire completos. El chevron gira para indicar que
 * hay más detalle disponible, no que hay contenido escondido.
 *
 * `resumen` queda para las secciones que además quieran adelantar un dato en
 * el encabezado.
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
