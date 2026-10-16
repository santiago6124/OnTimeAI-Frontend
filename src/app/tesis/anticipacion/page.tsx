import { Suspense } from "react";

import { AnticipacionView } from "@/components/tesis/anticipacion-view";
import { api, type LeadTime } from "@/lib/api";

export const metadata = {
  title: "Anticipación frente a la aerolínea — OnTimeAI",
  description:
    "Cuántos minutos antes el modelo marca un vuelo en riesgo, comparado con el momento en que la aerolínea publica la demora.",
  robots: { index: false, follow: false },
};

/**
 * El `fetch` no se cachea y bloquea el render hasta que responde, así que el
 * componente que lo hace va dentro de `<Suspense>` para que la página se
 * entregue y el dato llegue después. Ver
 * `01-app/01-getting-started/06-fetching-data` en los docs del paquete.
 */
export default function AnticipacionPage() {
  return (
    <Suspense fallback={<AnticipacionView datos={null} cargando />}>
      <Anticipacion />
    </Suspense>
  );
}

async function Anticipacion() {
  let datos: LeadTime | null = null;
  let fetchError = false;
  try {
    datos = await api.leadTime();
  } catch {
    fetchError = true;
  }
  return <AnticipacionView datos={datos} fetchError={fetchError} />;
}
