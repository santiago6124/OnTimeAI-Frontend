"use client";

import * as React from "react";

import { api, type Flight } from "@/lib/api";
import { VerificacionView } from "@/components/verificacion-view";

/**
 * Verificación de predicciones en el bundle empaquetado.
 *
 * Misma vista que la web; los vuelos se piden al montar en vez de en el
 * servidor. Ver `mobile/components/metric-cards.tsx` para el porqué.
 */
export default function VerificacionPage() {
  const [state, setState] = React.useState<{
    flights: Flight[];
    fetchError: boolean;
    loading: boolean;
  }>({ flights: [], fetchError: false, loading: true });

  React.useEffect(() => {
    let alive = true;
    api.flights().then(
      (flights) =>
        alive && setState({ flights, fetchError: false, loading: false }),
      () =>
        alive && setState({ flights: [], fetchError: true, loading: false }),
    );
    return () => {
      alive = false;
    };
  }, []);

  // Mientras carga, la vista con la lista vacía y sin error ya muestra el
  // encabezado y los contadores en cero, que es una pantalla intermedia
  // razonable y evita un salto de layout cuando llegan los datos.
  return (
    <VerificacionView flights={state.flights} fetchError={state.fetchError} />
  );
}
