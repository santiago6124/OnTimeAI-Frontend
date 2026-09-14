import { api } from "@/lib/api";
import { ModelBadgeView } from "@/components/model-badge-view";

/**
 * Tarjeta del modelo activo para la web. La versión nativa está en
 * `mobile/components/model-badge.tsx`.
 */
export async function ModelBadge() {
  let info;
  try {
    info = await api.model();
  } catch {
    info = null;
  }
  return <ModelBadgeView info={info} />;
}
