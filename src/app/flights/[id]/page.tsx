import { notFound } from "next/navigation";

import { api, ApiError } from "@/lib/api";
import { FlightDetailView } from "@/components/flight-detail-view";
import { DetalleViajero } from "@/components/viajero/detalle-viajero";
import { getServerProfile } from "@/lib/server-profile";

/**
 * Detalle de vuelo para la web: Server Component que resuelve el id del
 * segmento `[id]` y trae vuelo e historial durante el render.
 *
 * La variante nativa está en `mobile/flight-detail-page.tsx`: lee el id de un
 * query param, porque `output: 'export'` exige los segmentos dinámicos
 * resueltos en build time y los `fa_flight_id` son datos vivos. Quien emite el
 * enlace correcto para cada build es `flightDetailHref()` en `src/lib/routes.ts`.
 */
export default async function FlightDetailPage(
  props: PageProps<"/flights/[id]">,
) {
  const { id } = await props.params;
  const identificador = decodeURIComponent(id);

  const [flight, profile] = await Promise.all([
    api.flight(identificador).catch((error) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }),
    getServerProfile(),
  ]);

  // Se resuelve acá y no dentro del botón: así la pantalla llega con el estado
  // correcto en el primer render y no parpadea de "Guardar" a "Guardado"
  // después de montarse.
  const guardado = await api
    .savedFlights()
    .then((lista) => lista.some((v) => v.fa_flight_id === flight.fa_flight_id))
    .catch(() => false);

  if (profile === "passenger") {
    // El historial de predicciones no se pide: la pantalla de viajero no lo
    // muestra, y es la consulta más cara de las dos.
    return <DetalleViajero flight={flight} guardado={guardado} />;
  }

  const history = await api.flightHistory(identificador);
  return (
    <FlightDetailView flight={flight} history={history} guardado={guardado} />
  );
}
