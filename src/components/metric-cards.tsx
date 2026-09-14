import { api } from "@/lib/api";
import { MetricCardsView } from "@/components/metric-cards-view";

export { MetricCardsSkeleton } from "@/components/metric-cards-view";

/**
 * Tarjetas de métricas para la web: Server Component que trae el resumen
 * durante el render y delega el dibujo en `MetricCardsView`.
 *
 * El equivalente del bundle nativo vive en `mobile/components/metric-cards.tsx`
 * y renderiza exactamente la misma vista.
 */
export async function MetricCards() {
  let data;
  try {
    data = await api.summary();
  } catch {
    data = null;
  }
  return <MetricCardsView data={data} />;
}
