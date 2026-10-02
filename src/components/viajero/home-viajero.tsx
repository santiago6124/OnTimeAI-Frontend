import { Suspense } from "react";

import { api, type Flight } from "@/lib/api";
import { BuscadorVuelo } from "@/components/viajero/buscador-vuelo";
import {
  ProximosVuelos,
  proximasSalidas,
} from "@/components/viajero/proximos-vuelos";

/**
 * La home del perfil viajero.
 *
 * Deliberadamente no trae nada del tablero operativo: ni "demoras esperadas
 * sobre 563 vuelos", ni el gráfico por hora, ni la tabla completa. Un viajero
 * no opera el aeropuerto, busca un vuelo.
 */
/**
 * Trae los vuelos y resuelve cuáles son los próximos.
 *
 * El reloj se lee acá y no en el componente: `Date.now()` dentro del render
 * hace que el mismo árbol devuelva cosas distintas sin que cambien sus props,
 * y React lo rechaza con razón. Esta función no es un componente.
 */
async function cargar(): Promise<{ vuelos: Flight[]; proximos: Flight[] }> {
  let vuelos: Flight[] = [];
  try {
    vuelos = await api.flights();
  } catch {
    vuelos = [];
  }
  return { vuelos, proximos: proximasSalidas(vuelos, Date.now()) };
}

export async function HomeViajero() {
  const { vuelos, proximos } = await cargar();

  return (
    <div className="space-y-8">
      <section className="flex flex-col items-center gap-4 pt-6 pb-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          ¿Cómo viene tu vuelo?
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Escribí el número que figura en tu tarjeta de embarque y te decimos la
          probabilidad de que se demore.
        </p>
        <BuscadorVuelo vuelos={vuelos} />
      </section>

      <Suspense
        fallback={<div className="h-80 animate-pulse rounded-lg bg-muted" />}
      >
        <ProximosVuelos vuelos={proximos} />
      </Suspense>
    </div>
  );
}
