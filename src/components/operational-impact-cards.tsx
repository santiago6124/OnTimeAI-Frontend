import { api } from "@/lib/api";
import { computeOperationalImpact } from "@/lib/operational-impact";
import { OperationalImpactCardsView } from "@/components/operational-impact-cards-view";

export { OperationalImpactSkeleton } from "@/components/operational-impact-cards-view";

/**
 * La lectura del reloj vive acá y no en el componente: el instante de
 * referencia forma parte de la carga de datos, no del render.
 */
export async function loadImpact() {
  try {
    const flights = await api.flights();
    return computeOperationalImpact(flights, Date.now());
  } catch {
    return null;
  }
}

/**
 * Impacto operacional para la web: Server Component que trae los vuelos
 * durante el render. La variante nativa está en
 * `mobile/components/operational-impact-cards.tsx`.
 */
export async function OperationalImpactCards() {
  return <OperationalImpactCardsView impact={await loadImpact()} />;
}
