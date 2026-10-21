"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Cortina de nubes mientras /weather junta el clima de todo el país.
 *
 * La página pide los vuelos del día, arma hasta 150 códigos de aeropuerto y
 * después el METAR de cada uno. Son varios segundos, y lo que había era una
 * pantalla a medio dibujar con esqueletos grises: no dice por qué tarda ni
 * promete que algo va a aparecer.
 *
 * Cubre de la barra para abajo y la deja a la vista: tapar la navegación
 * atrapa a quien se arrepintió y quiere irse a otra pantalla.
 *
 * Al terminar, las nubes se abren hacia los costados en vez de desvanecerse.
 * Esa diferencia es la que hace que se lea como "se despejó" y no como "se
 * apagó la pantalla".
 */

/** Cada nube: dónde está, cuán grande, a qué velocidad deriva y hacia dónde se va. */
const NUBES = [
  { arriba: "-6%", lado: "-10%", ancho: "62%", alto: "48%", velocidad: "30s", opacidad: 0.95, haciaLaIzquierda: true },
  { arriba: "2%", lado: "42%", ancho: "70%", alto: "55%", velocidad: "24s", opacidad: 0.92, haciaLaIzquierda: false },
  { arriba: "28%", lado: "-18%", ancho: "66%", alto: "52%", velocidad: "34s", opacidad: 0.88, haciaLaIzquierda: true },
  { arriba: "34%", lado: "38%", ancho: "74%", alto: "58%", velocidad: "28s", opacidad: 0.9, haciaLaIzquierda: false },
  { arriba: "62%", lado: "-12%", ancho: "58%", alto: "46%", velocidad: "38s", opacidad: 0.85, haciaLaIzquierda: true },
  { arriba: "58%", lado: "46%", ancho: "64%", alto: "50%", velocidad: "26s", opacidad: 0.87, haciaLaIzquierda: false },
] as const;

/** Lo que tarda la animación de despeje. Tiene que coincidir con el CSS. */
const MS_DESPEJE = 1200;

export function CortinaDeNubes({
  cargando,
  detalle,
}: {
  cargando: boolean;
  /** Qué se está esperando. Sin esto la espera es muda. */
  detalle?: string;
}) {
  const [montada, setMontada] = React.useState(cargando);
  const [despejando, setDespejando] = React.useState(false);
  const [cargandoAnterior, setCargandoAnterior] = React.useState(cargando);

  // El cambio se detecta DURANTE el render y no en un efecto. Ajustar estado
  // derivado de props en el render es el patrón que React recomienda; hacerlo
  // en un efecto encadena un render de más y el lint lo rechaza con
  // `set-state-in-effect`.
  if (cargando !== cargandoAnterior) {
    setCargandoAnterior(cargando);
    if (cargando) {
      setMontada(true);
      setDespejando(false);
    } else if (montada) {
      setDespejando(true);
    }
  }

  // Lo único que queda en un efecto es el reloj. Se desmonta DESPUÉS de la
  // transición: quitarla al instante corta el despeje a la mitad.
  React.useEffect(() => {
    if (!despejando) return;
    const t = window.setTimeout(() => setMontada(false), MS_DESPEJE);
    return () => window.clearTimeout(t);
  }, [despejando]);

  if (!montada) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 overflow-hidden",
        // Arranca donde termina la barra: la navegación queda usable.
        "top-[calc(var(--nav-offset)_+_env(safe-area-inset-top))]",
        "bg-gradient-to-b from-sky-50 via-slate-50 to-background",
        despejando && "pointer-events-none",
      )}
      // Es decoración: lo que importa para un lector de pantalla es el estado,
      // que va abajo con `role="status"`.
      aria-hidden={despejando}
    >
      {NUBES.map((n, i) => (
        <div
          key={i}
          className={cn(
            "absolute rounded-[50%] blur-2xl",
            "bg-[radial-gradient(closest-side,rgba(255,255,255,0.98),rgba(255,255,255,0.72)_58%,rgba(255,255,255,0)_100%)]",
            despejando
              ? n.haciaLaIzquierda
                ? "nube-despeja-izq"
                : "nube-despeja-der"
              : "nube",
          )}
          style={
            {
              top: n.arriba,
              left: n.lado,
              width: n.ancho,
              height: n.alto,
              opacity: n.opacidad,
              "--velocidad": n.velocidad,
              // Escalonadas: arrancando todas juntas se ve el bucle.
              animationDelay: `${i * -4}s`,
            } as React.CSSProperties
          }
        />
      ))}

      <div
        role="status"
        aria-live="polite"
        className={cn(
          "absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center",
          "transition-opacity duration-500",
          despejando ? "opacity-0" : "opacity-100",
        )}
      >
        <p className="text-sm font-medium text-slate-600">Despejando el cielo</p>
        {detalle ? (
          <p className="mt-1 text-xs text-slate-500">{detalle}</p>
        ) : null}
      </div>
    </div>
  );
}
