"use client";

/**
 * Campo de contraseña con botón para revelarla.
 *
 * Escribir una contraseña a ciegas es la causa más común de que un alta falle
 * en el segundo intento, y en un teclado de teléfono es peor. El botón no
 * guarda estado entre campos: cada uno se revela por separado, porque revelar
 * los dos de un formulario de alta a la vez es más exposición de la necesaria.
 */

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentProps<typeof Input>, "type"> & {
  /** Etiqueta del botón para lectores de pantalla. */
  revealLabel?: string;
};

export function PasswordInput({
  className,
  revealLabel = "contraseña",
  ...props
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("pr-10", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // `tabIndex={-1}` para que tabular salte del campo al siguiente y no
        // al botón: quien navega con teclado busca avanzar, no revelar.
        tabIndex={-1}
        aria-label={visible ? `Ocultar ${revealLabel}` : `Mostrar ${revealLabel}`}
        aria-pressed={visible}
        className={cn(
          "absolute right-0 top-0 flex h-full w-10 items-center justify-center",
          "text-muted-foreground transition-colors hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "rounded-r-md disabled:pointer-events-none disabled:opacity-50",
        )}
        disabled={props.disabled}
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
