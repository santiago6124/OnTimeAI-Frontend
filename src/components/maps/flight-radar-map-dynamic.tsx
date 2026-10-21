"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const cargarMapa = () => import("./flight-radar-map").then((m) => m.FlightRadarMap);

export const FlightRadarMap = dynamic(cargarMapa, {
  ssr: false,
  loading: () => <Skeleton className="h-[520px] w-full rounded-lg" />,
});

/**
 * Empuja el chunk del mapa antes de que haga falta.
 *
 * El mapa recién se monta cuando llegan los vuelos, así que su chunk se
 * empieza a bajar DESPUÉS de la espera: la cortina se levantaba sobre un
 * esqueleto. Pidiéndolo al montar la página, el chunk viaja en paralelo con
 * los 1,7 s de `/flights` y el mapa ya está listo cuando la cortina aterriza.
 *
 * `import()` deduplica, así que esto y el `dynamic` de arriba son una sola
 * descarga.
 */
export function precargarMapaDeVuelos(): void {
  void cargarMapa().catch(() => {
    // Si falla, el `dynamic` lo vuelve a intentar al montar y muestra su
    // esqueleto. Acá no hay nada que informar.
  });
}
