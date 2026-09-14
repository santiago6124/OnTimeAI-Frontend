import { api, ApiError, type WeatherData } from "@/lib/api";
import {
  WeatherCardView,
  type WeatherErrorKind,
} from "@/components/weather-card-view";

/**
 * Panel meteorológico para la web: Server Component que trae el METAR de ATL
 * durante el render. La versión nativa está en `mobile/components/weather-card.tsx`.
 */
export async function WeatherCard({ title }: { title?: string } = {}) {
  let data: WeatherData | null = null;
  let errorKind: WeatherErrorKind = null;
  try {
    data = await api.weather("ATL");
  } catch (e) {
    errorKind = e instanceof ApiError && e.status === 404 ? "unavailable" : "server";
  }
  return <WeatherCardView data={data} errorKind={errorKind} title={title} />;
}
