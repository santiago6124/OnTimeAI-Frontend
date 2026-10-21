"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  BORDE_VW,
  CICLO_MS,
  DESTELLOS,
  HORIZONTE_PCT,
  bordesDelAsfalto,
  tramosDePista,
} from "@/lib/perspectiva-pista";

/**
 * Cortina de pista mientras /flights trae los vuelos del día.
 *
 * Son 379 vuelos y 240 KB de JSON —1,7 s medidos contra producción— más el
 * montaje del mapa. No es una eternidad, y justamente por eso la escena tiene
 * que estar en movimiento desde el primer fotograma: una entrada lenta se
 * comería la espera entera y lo único que se vería es una imagen puesta.
 *
 * ## Qué se ve
 *
 * Una aproximación nocturna a Hartsfield-Jackson. El eje de pista y las luces
 * de borde vienen hacia la cámara, los destellos secuenciados suben por el eje
 * como el ALSF-2 de verdad, la torre y los concourses quedan en silueta contra
 * el resplandor sodio de la ciudad, y el faro del aeródromo da su vuelta de
 * verde y blanco. Al llegar los datos, el suelo pasa de largo y se levanta la
 * cortina: toma de contacto.
 *
 * De noche y no de día a propósito: la cortina de meteorología es un cielo
 * azul de mediodía, y dos pantallas de carga con el mismo cielo se leen como
 * la misma pantalla.
 *
 * La geometría vive en `lib/perspectiva-pista.ts`, incluido el por qué la
 * curva no es una proyección de cámara real.
 */

/** Lo que tarda el aterrizaje. Tiene que coincidir con el CSS. */
const MS_ATERRIZAJE = 1100;

const TRAMOS = tramosDePista();
const ASFALTO = bordesDelAsfalto();

export function CortinaDePista({
  cargando,
  detalle,
}: {
  cargando: boolean;
  /** Qué se está esperando. Sin esto la espera es muda. */
  detalle?: string;
}) {
  const [montada, setMontada] = React.useState(cargando);
  const [aterrizando, setAterrizando] = React.useState(false);
  const [cargandoAnterior, setCargandoAnterior] = React.useState(cargando);

  // Igual que en la cortina de nubes: el cambio se detecta DURANTE el render.
  // En un efecto encadena un render de más y el lint lo rechaza.
  if (cargando !== cargandoAnterior) {
    setCargandoAnterior(cargando);
    if (cargando) {
      setMontada(true);
      setAterrizando(false);
    } else if (montada) {
      setAterrizando(true);
    }
  }

  React.useEffect(() => {
    if (!aterrizando) return;
    const t = window.setTimeout(() => setMontada(false), MS_ATERRIZAJE);
    return () => window.clearTimeout(t);
  }, [aterrizando]);

  if (!montada) return null;

  return (
    <div
      className={cn(
        // Pantalla entera y por DEBAJO de la barra (`z-40`): sin corte y con
        // la navegación usable.
        "fixed inset-0 z-30 overflow-hidden",
        "transition-opacity duration-[900ms] delay-200",
        aterrizando && "pointer-events-none opacity-0",
      )}
      style={{
        background:
          `linear-gradient(180deg,#01040c 0%,#050e22 22%,#0a1a38 38%,#132a52 48%,#2a3d63 ${HORIZONTE_PCT}%,#05080f ${HORIZONTE_PCT}%,#02040a 100%)`,
      }}
      // La cortina se hace cargo ella misma de "reducir movimiento": el
      // barrido global de `globals.css` apaga toda animación con `!important`,
      // y acá eso dejaría los tramos apilados en el punto de fuga, o sea una
      // pista vacía. El bloque `prefers-reduced-motion` los deja quietos pero
      // repartidos; sin este atributo no llega a aplicarse.
      data-movimiento-propio
      aria-hidden
    >
      {/* Tres capas y no una, porque tres animaciones distintas quieren la misma
          propiedad: el descenso de entrada, la toma de contacto y el balanceo
          son todas `transform`, y dos animaciones sobre `transform` no se
          suman —la última de la lista gana— ni una animación corriendo deja
          pasar una transición sobre lo mismo. Apiladas, se multiplican. */}
      <div className="pista-camara absolute inset-0">
        <div className={cn("absolute inset-0", aterrizando && "pista-aterriza")}>
          <div className="pista-escena absolute inset-0">
            {/* El resplandor de la ciudad sobre el horizonte. Es lo que hace que
                la silueta se lea como silueta y no como un recorte negro. */}
            <div
              className="absolute inset-x-0"
              style={{
                top: `${HORIZONTE_PCT - 16}%`,
                height: "16%",
                background:
                  "radial-gradient(70% 100% at 50% 100%, rgba(226,150,78,0.42) 0%, rgba(196,118,60,0.16) 45%, rgba(120,90,70,0) 100%)",
              }}
            />

            <Horizonte />
            <FaroDeAerodromo />

            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {/* El asfalto. Más claro que el pasto de los costados, que es lo
                  que lo hace leerse como pista y no como carretera. */}
              <defs>
                {/* Los `offset` van sobre el bounding box del polígono, no sobre la
                    pantalla: 0% es el extremo lejano y 100% el cercano. Con el
                    horizonte acá el degradado arrancaba a mitad de pista. Lejos
                    más claro, que es lo que hace la bruma. */}
                <linearGradient id="asfalto-pista" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#223049" />
                  <stop offset="45%" stopColor="#172034" />
                  <stop offset="100%" stopColor="#0a1020" />
                </linearGradient>
              </defs>
              <polygon points={ASFALTO} fill="url(#asfalto-pista)" />
            </svg>

            {/* Los tramos: eje y luces de borde, acercándose juntos. Que vengan
                en el mismo elemento es lo que mantiene las luces apoyadas en el
                borde del asfalto a cualquier distancia. */}
            {TRAMOS.map((tramo) => (
              <div
                key={tramo.indice}
                className="pista-tramo absolute"
                style={
                  {
                    left: "50%",
                    top: `${HORIZONTE_PCT}%`,
                    width: 0,
                    height: 0,
                    "--retraso": `${tramo.retrasoMs}ms`,
                    "--ciclo": `${CICLO_MS}ms`,
                    "--y": tramo.y,
                    "--escala": tramo.escala,
                  } as React.CSSProperties
                }
              >
                {/* La raya del eje. */}
                <span
                  className="absolute rounded-[1px] bg-slate-100"
                  style={{ left: "-1.3vw", width: "2.6vw", height: "9vh" }}
                />
                {/* Las luces de borde: blancas, con su halo. */}
                <LuzDeBorde lado={-1} />
                <LuzDeBorde lado={1} />
              </div>
            ))}

            {/* Los destellos secuenciados del eje, corriendo de lejos a cerca. */}
            {DESTELLOS.map((d) => (
              <span
                key={d.indice}
                className="pista-destello absolute rounded-full bg-[#eaf4ff]"
                style={
                  {
                    left: "50%",
                    top: `${HORIZONTE_PCT + d.y}%`,
                    width: `${Math.max(0.18, 2.2 * d.escala)}vw`,
                    height: `${Math.max(0.18, 2.2 * d.escala)}vw`,
                    transform: "translate(-50%,-50%)",
                    boxShadow: "0 0 0.7vw 0.18vw rgba(214,236,255,0.75)",
                    "--retraso": `${d.retrasoMs}ms`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        </div>
      </div>

      {/* Viñeta: sin esto el texto compite con las luces del fondo. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(58% 42% at 50% 46%, rgba(2,6,16,0.62) 0%, rgba(2,6,16,0.12) 58%, rgba(2,6,16,0) 100%)",
        }}
      />

      <div
        role="status"
        aria-live="polite"
        className={cn(
          "absolute inset-x-0 top-[38%] -translate-y-1/2 px-6 text-center",
          "transition-opacity duration-500",
          aterrizando ? "opacity-0" : "opacity-100",
        )}
      >
        <span className="inline-flex flex-col rounded-2xl border border-white/10 bg-slate-950/55 px-5 py-3 shadow-lg backdrop-blur-md">
          <span className="text-sm font-medium text-slate-100">
            Aterrizando en Hartsfield-Jackson
          </span>
          {detalle ? (
            <span className="mt-0.5 text-xs text-slate-400">{detalle}</span>
          ) : null}
        </span>
      </div>
    </div>
  );
}

/**
 * Una luz de borde. El halo va en `box-shadow` y no en un filtro: un `blur`
 * sobre ocho tramos a la vez obliga al navegador a rasterizar la capa en cada
 * fotograma, y la cortina corre mientras el hilo principal está ocupado.
 */
function LuzDeBorde({ lado }: { lado: -1 | 1 }) {
  return (
    <span
      className="absolute rounded-full bg-[#fdfdfb]"
      style={{
        left: `${lado * BORDE_VW}vw`,
        width: "1.5vw",
        height: "1.5vw",
        transform: "translate(-50%,-50%)",
        boxShadow: "0 0 1.1vw 0.3vw rgba(255,246,222,0.6)",
      }}
    />
  );
}

/**
 * La silueta del aeropuerto contra el resplandor: los concourses, la torre de
 * control y el faro.
 *
 * Va corrida a la derecha del eje porque centrada se come el punto de fuga, y
 * el punto de fuga es lo único de esta pantalla que tiene que quedar limpio.
 */
function Horizonte() {
  const base = HORIZONTE_PCT;
  return (
    <svg
      className="absolute inset-x-0"
      style={{ top: `${base - 9}%`, height: "9.2%" }}
      viewBox="0 0 200 20"
      preserveAspectRatio="none"
      aria-hidden
    >
      {/* Concourses: largos y bajos, como son. */}
      <path
        d="M0 20 L0 16.4 L26 16.4 L30 15.2 L62 15.2 L66 16.6 L104 16.6 L108 15.4 L140 15.4 L144 16.8 L176 16.8 L180 15.8 L200 15.8 L200 20 Z"
        fill="#01050d"
      />
      {/* Torre de control: fuste, cabina y mástil. */}
      <path d="M121 20 L121 7.2 L124.4 7.2 L124.4 20 Z" fill="#01050d" />
      <path d="M118.6 7.6 L126.8 7.6 L125.4 3.6 L120 3.6 Z" fill="#01050d" />
      <rect x="122.4" y="0.6" width="0.7" height="3" fill="#01050d" />
      {/* La luz roja de obstrucción del mástil, que es lo que tiene arriba una
          torre de verdad. */}
      <circle cx="122.75" cy="0.6" r="0.55" fill="#f87171" opacity="0.9" />
      {/* Ventanas de la cabina, encendidas: la torre trabaja de noche. */}
      <rect x="120.4" y="4.6" width="5.4" height="1.5" fill="#f2c87a" opacity="0.5" />
      {/* Luces de los concourses. Irregulares a propósito: una grilla perfecta
          se lee como un gráfico de barras. */}
      {[8, 14, 21, 35, 41, 48, 55, 72, 79, 86, 95, 131, 137, 148, 155, 163, 170, 185, 192].map(
        (x, i) => (
          <rect
            key={x}
            x={x}
            y={17.3 + (i % 3) * 0.5}
            width="1.1"
            height="0.75"
            fill="#f6d79b"
            opacity={0.3 + ((i * 7) % 5) * 0.11}
          />
        ),
      )}
    </svg>
  );
}

/** El faro del aeródromo, fuera del SVG para que el CSS lo anime solo. */
function FaroDeAerodromo() {
  return (
    <span
      className="pista-faro absolute rounded-full"
      style={{
        left: "22%",
        top: `${HORIZONTE_PCT - 2.4}%`,
        width: "0.55vw",
        height: "0.55vw",
        boxShadow: "0 0 1.1vw 0.3vw rgba(236,253,245,0.55)",
      }}
    />
  );
}
