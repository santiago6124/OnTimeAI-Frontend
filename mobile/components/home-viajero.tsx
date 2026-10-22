"use client";

import * as React from "react";

import { api, type Flight } from "@/lib/api";
import { HomeViajeroView } from "@/components/viajero/home-viajero-view";
import { proximasSalidas } from "@/components/viajero/proximos-vuelos";

/**
 * La home del viajero en el bundle empaquetado.
 *
 * Misma vista que la web; los vuelos se piden al montar en vez de en el
 * servidor. Ver `mobile/components/metric-cards.tsx` para el porqué.
 *
 * El reloj se lee dentro del efecto, cuando llegan los datos, y no en el
 * render: `proximasSalidas` recibe `Date.now()` como argumento justamente para
 * que ningún componente dependa de la hora mientras dibuja.
 */
export function HomeViajero() {
  const [state, setState] = React.useState<{
    vuelos: Flight[];
    proximos: Flight[];
    cargando: boolean;
  }>({ vuelos: [], proximos: [], cargando: true });

  React.useEffect(() => {
    let alive = true;
    api.flights().then(
      (vuelos) =>
        alive &&
        setState({
          vuelos,
          proximos: proximasSalidas(vuelos, Date.now()),
          cargando: false,
        }),
      // Como en la web: si la lista no viene, la home se dibuja igual, con el
      // buscador vacío y sin salidas próximas.
      () => alive && setState({ vuelos: [], proximos: [], cargando: false }),
    );
    return () => {
      alive = false;
    };
  }, []);

  return (
    <HomeViajeroView
      vuelos={state.vuelos}
      proximos={state.proximos}
      cargando={state.cargando}
    />
  );
}
