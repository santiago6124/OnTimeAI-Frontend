import { Suspense } from "react";

import type { Flight } from "@/lib/api";
import { BuscadorVuelo } from "@/components/viajero/buscador-vuelo";
import { ProximosVuelos } from "@/components/viajero/proximos-vuelos";

/**
 * La home del perfil viajero, sin datos propios.
 *
 * Deliberadamente no trae nada del tablero operativo: ni "demoras esperadas
 * sobre 563 vuelos", ni el gráfico por hora, ni la tabla completa. Un viajero
 * no opera el aeropuerto, busca un vuelo.
 *
 * Es una vista pura por el mismo motivo que `metric-cards-view.tsx`: la web
 * pide los vuelos en el servidor durante el render (`home-viajero.tsx`) y el
 * bundle nativo en el cliente al montar (`mobile/components/home-viajero.tsx`),
 * pero lo que se ve en pantalla tiene que ser un solo archivo.
 */
export function HomeViajeroView({
  vuelos,
  proximos,
  cargando = false,
}: {
  vuelos: Flight[];
  /** Ya filtrados y ordenados por `proximasSalidas`. */
  proximos: Flight[];
  /**
   * Mientras los vuelos vienen en camino. Sin esta bandera la lista vacía se
   * leería como "no hay salidas próximas", que es otra cosa.
   */
  cargando?: boolean;
}) {
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

      {cargando ? (
        <div className="h-80 animate-pulse rounded-lg bg-muted" />
      ) : (
        <Suspense
          fallback={<div className="h-80 animate-pulse rounded-lg bg-muted" />}
        >
          <ProximosVuelos vuelos={proximos} />
        </Suspense>
      )}
    </div>
  );
}
