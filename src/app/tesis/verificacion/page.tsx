import { api, type Flight } from "@/lib/api";
import { VerificacionView } from "@/components/verificacion-view";

export const metadata = {
  title: "Verificación de predicciones — OnTimeAI",
  description: "Compará predicciones del modelo con el estado real en fuentes externas.",
  robots: { index: false, follow: false },
};


/**
 * Verificación de predicciones para la web: Server Component que trae los
 * vuelos durante el render. La variante nativa está en
 * `mobile/verificacion-page.tsx` y renderiza la misma vista.
 */
export default async function VerificacionPage() {
  let flights: Flight[] = [];
  let fetchError = false;

  try {
    flights = await api.flights();
  } catch {
    fetchError = true;
  }

  return <VerificacionView flights={flights} fetchError={fetchError} />;
}
