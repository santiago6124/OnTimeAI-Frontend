"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Cortina de nubes mientras /weather junta el clima de todo el país.
 *
 * La página pide los vuelos del día, arma hasta 150 códigos de aeropuerto y
 * después el METAR de cada uno. Son varios segundos contra una pantalla a
 * medio dibujar con esqueletos grises.
 *
 * ## Dos cosas que la primera versión hizo mal
 *
 * Nubes blancas sobre un fondo casi blanco: `rgba(255,255,255,0.98)` sobre
 * `sky-50`. Estaban dibujadas y no se veían. Por eso el cielo de acá es azul
 * de verdad —de `#7dd3fc` arriba a casi blanco abajo— y las nubes son blancas
 * opacas: el contraste es el punto, no un detalle de gusto.
 *
 * Y cortaba en `--nav-offset`, dejando una línea recta cruzando la pantalla.
 * La barra es una píldora flotante, no una franja, así que ese corte no
 * coincidía con nada. Ahora cubre todo y va en `z-30`, debajo del `z-40` de la
 * barra: se tapa la página entera y la navegación queda encima, usable y sin
 * costura.
 */

/**
 * Cada nube es un racimo de círculos, no una elipse.
 *
 * Una elipse borrosa se lee como una mancha. Tres o cuatro círculos de
 * distinto tamaño pegados dan la silueta de cúmulo que el ojo reconoce.
 */
const NUBES = [
  { x: "-8%", y: "6%", escala: 1.25, velocidad: "34s", izquierda: true },
  { x: "46%", y: "-2%", escala: 1.5, velocidad: "28s", izquierda: false },
  { x: "12%", y: "34%", escala: 1.0, velocidad: "40s", izquierda: true },
  { x: "58%", y: "40%", escala: 1.35, velocidad: "31s", izquierda: false },
  { x: "-4%", y: "66%", escala: 1.15, velocidad: "37s", izquierda: true },
  { x: "52%", y: "72%", escala: 1.45, velocidad: "26s", izquierda: false },
  { x: "26%", y: "16%", escala: 0.85, velocidad: "44s", izquierda: true },
  { x: "72%", y: "22%", escala: 0.95, velocidad: "33s", izquierda: false },
] as const;

/** Los bultos de un cúmulo, en proporción al ancho de la nube. */
const BULTOS = [
  { cx: 18, cy: 62, r: 26 },
  { cx: 42, cy: 42, r: 34 },
  { cx: 68, cy: 56, r: 28 },
  { cx: 86, cy: 68, r: 20 },
] as const;

/** Lo que tarda el despeje. Tiene que coincidir con el CSS. */
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
        // Pantalla entera y por DEBAJO de la barra (`z-40`): sin corte y con
        // la navegación usable.
        "fixed inset-0 z-30 overflow-hidden",
        // El cielo se va DESPUÉS de que las nubes empiezan a abrirse, y tarda
        // casi lo mismo que ellas. Con 700 ms contra los 1100 del despeje, el
        // azul desaparecía con las nubes a mitad de camino.
        "transition-opacity duration-[900ms] delay-200",
        despejando && "pointer-events-none opacity-0",
      )}
      style={{
        background:
          "linear-gradient(180deg,#7dd3fc 0%,#a5d8f3 28%,#cfe8f7 58%,#eef5fa 82%,#f8fafc 100%)",
      }}
      aria-hidden
    >
      {NUBES.map((n, i) => (
        <div
          key={i}
          className={cn(
            "absolute",
            despejando
              ? n.izquierda
                ? "nube-despeja-izq"
                : "nube-despeja-der"
              : "nube",
          )}
          style={
            {
              left: n.x,
              top: n.y,
              width: `${28 * n.escala}%`,
              "--velocidad": n.velocidad,
              // Escalonadas: arrancando juntas se ve el bucle.
              animationDelay: `${i * -5}s`,
            } as React.CSSProperties
          }
        >
          {/* Un desenfoque corto: con los bordes nítidos parece un dibujo,
              y con mucho vuelve a ser una mancha. */}
          <svg viewBox="0 0 104 92" className="w-full blur-[3px] drop-shadow-sm">
            {BULTOS.map((b, j) => (
              <circle
                key={j}
                cx={b.cx}
                cy={b.cy}
                r={b.r}
                fill="white"
                fillOpacity={0.95}
              />
            ))}
          </svg>
        </div>
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
        {/* Sobre el cielo azul el texto necesita su propio fondo: encima de
            una nube se pierde y encima del azul queda flojo. */}
        <span className="inline-flex flex-col rounded-2xl bg-white/80 px-5 py-3 backdrop-blur-sm">
          <span className="text-sm font-medium text-slate-700">
            Despejando el cielo
          </span>
          {detalle ? (
            <span className="mt-0.5 text-xs text-slate-500">{detalle}</span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
