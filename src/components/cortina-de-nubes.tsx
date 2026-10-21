"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Cortina de nubes mientras /weather junta el clima de todo el país.
 *
 * La página pide los vuelos del día, arma hasta 150 códigos de aeropuerto y
 * después el METAR de cada uno. Son varios segundos contra una pantalla a
 * medio dibujar.
 *
 * ## Por qué ruido fractal y no formas
 *
 * Las dos versiones anteriores dibujaban nubes con geometría: primero una
 * elipse con degradado, después un racimo de cuatro círculos. Las dos se ven
 * mal por el mismo motivo. A pantalla completa, las costuras donde se
 * superponen los círculos quedan a la vista y los bordes del `viewBox`
 * recortan en línea recta: se lee como clipart.
 *
 * Una nube no tiene borde. `feTurbulence` genera ruido fractal —la misma
 * técnica con la que se hacen nubes en cualquier motor gráfico— y una matriz
 * de color lo convierte en densidad: blanco donde el ruido es alto,
 * transparente donde es bajo, con todo el degradé en el medio. No hay forma
 * que recortar ni costura que disimular.
 *
 * Dos capas con frecuencias y velocidades distintas dan profundidad: la de
 * atrás es más difusa y lenta, la de adelante más definida y rápida.
 */

/** Lo que tarda el despeje. Tiene que coincidir con el CSS. */
const MS_DESPEJE = 1200;

/**
 * Las dos capas de ruido.
 *
 * `frecuencia` controla el tamaño de los cúmulos: más bajo, nubes más grandes.
 * Va asimétrica —más baja en X que en Y— porque las nubes reales se estiran en
 * horizontal, y con un valor único salen manchas redondas.
 *
 * `corte` es la pendiente de la matriz de alfa: cuánto más negativo, más
 * marcado el contraste entre nube y cielo. Suave en la capa de atrás para que
 * se lea como bruma.
 */
const CAPAS = [
  { id: "nubes-fondo", frecuencia: "0.007 0.015", octavas: 4, corte: -1.1, base: 0.92, opacidad: 0.55, velocidad: "26s", semilla: 7, entrada: "entra-nube-izq" },
  { id: "nubes-frente", frecuencia: "0.013 0.024", octavas: 5, corte: -1.7, base: 1.05, opacidad: 0.85, velocidad: "17s", semilla: 21, entrada: "entra-nube-der" },
] as const;

/**
 * El lienzo donde se calcula el ruido, en unidades de usuario.
 *
 * `feTurbulence` filtra píxel por píxel, así que a pantalla completa en una
 * pantalla grande son millones. Calculándolo en 600 × 400 y dejando que el
 * navegador lo escale, el costo queda fijo sin importar el tamaño de la
 * ventana: el ruido es continuo y aguanta el estirado sin verse pixelado.
 */
const LIENZO = { ancho: 600, alto: 400 } as const;

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
  // derivado de props en el render es el patrón que React recomienda; en un
  // efecto encadena un render de más y el lint lo rechaza.
  if (cargando !== cargandoAnterior) {
    setCargandoAnterior(cargando);
    if (cargando) {
      setMontada(true);
      setDespejando(false);
    } else if (montada) {
      setDespejando(true);
    }
  }

  React.useEffect(() => {
    if (!despejando) return;
    const t = window.setTimeout(() => setMontada(false), MS_DESPEJE);
    return () => window.clearTimeout(t);
  }, [despejando]);

  if (!montada) return null;

  return (
    <div
      className={cn(
        // Pantalla entera y por DEBAJO de la barra (`z-40`): sin corte y con la
        // navegación usable.
        "fixed inset-0 z-30 overflow-hidden",
        "transition-opacity duration-[900ms] delay-200",
        despejando && "pointer-events-none opacity-0",
      )}
      style={{
        background:
          "linear-gradient(180deg,#5eb8ef 0%,#89cdf2 26%,#b4dff6 54%,#d9edf9 78%,#f1f7fb 100%)",
      }}
      aria-hidden
    >
      {CAPAS.map((capa, i) => (
        <div
          key={capa.id}
          className={cn(
            "absolute -inset-x-1/2 inset-y-0",
            despejando ? (i === 0 ? "nube-despeja-izq" : "nube-despeja-der") : "nube",
          )}
          style={
            {
              opacity: capa.opacidad,
              "--velocidad": capa.velocidad,
              "--entrada": capa.entrada,
            } as React.CSSProperties
          }
        >
          {/* El contenedor va corrido a la izquierda y mide el doble de ancho
              para que la deriva nunca muestre el borde del lienzo. */}
          <svg
            className="h-full w-full"
            viewBox={`0 0 ${LIENZO.ancho} ${LIENZO.alto}`}
            preserveAspectRatio="none"
          >
            <defs>
              <filter
                id={capa.id}
                x="0"
                y="0"
                width={LIENZO.ancho}
                height={LIENZO.alto}
                filterUnits="userSpaceOnUse"
              >
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency={capa.frecuencia}
                  numOctaves={capa.octavas}
                  seed={capa.semilla}
                  stitchTiles="stitch"
                />
                {/* Las tres primeras filas fuerzan blanco. La cuarta convierte
                    el ruido en opacidad: `corte` es la pendiente y `base` el
                    corrimiento, así que juntas deciden cuánto cielo queda
                    entre nube y nube. */}
                <feColorMatrix
                  type="matrix"
                  values={`0 0 0 0 1
                           0 0 0 0 1
                           0 0 0 0 1
                           0 0 0 ${capa.corte} ${capa.base}`}
                />
              </filter>
            </defs>
            <rect
                width={LIENZO.ancho}
                height={LIENZO.alto}
                filter={`url(#${capa.id})`}
              />
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
        {/* Sobre la textura el texto necesita su propio fondo: encima de una
            nube se pierde y encima del azul queda flojo. */}
        <span className="inline-flex flex-col rounded-2xl bg-white/75 px-5 py-3 shadow-sm backdrop-blur-md">
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
