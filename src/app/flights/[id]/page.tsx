import { notFound } from "next/navigation";

import { api, ApiError } from "@/lib/api";
import { FlightDetailView } from "@/components/flight-detail-view";

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
  let flight;
  try {
    flight = await api.flight(decodeURIComponent(id));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const history = await api.flightHistory(decodeURIComponent(id));

  return <FlightDetailView flight={flight} history={history} />;
}
