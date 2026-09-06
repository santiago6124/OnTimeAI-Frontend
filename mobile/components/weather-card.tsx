"use client";

import * as React from "react";

import { api, ApiError, type WeatherData } from "@/lib/api";
import {
  WeatherCardView,
  type WeatherErrorKind,
} from "@/components/weather-card-view";

/**
 * Panel meteorológico en el bundle empaquetado. Ver
 * `mobile/components/metric-cards.tsx` para el porqué del fetch en el cliente —
 * acá pesa todavía más: un METAR compilado adentro del binario sería
 * información meteorológica de hace semanas presentada como actual.
 */
export function WeatherCard({ title }: { title?: string } = {}) {
  const [state, setState] = React.useState<{
    data: WeatherData | null;
    errorKind: WeatherErrorKind;
  }>({ data: null, errorKind: null });

  React.useEffect(() => {
    let alive = true;
    api.weather("ATL").then(
      (data) => alive && setState({ data, errorKind: null }),
      (e: unknown) =>
        alive &&
        setState({
          data: null,
          errorKind:
            e instanceof ApiError && e.status === 404 ? "unavailable" : "server",
        }),
    );
    return () => {
      alive = false;
    };
  }, []);

  return (
    <WeatherCardView
      data={state.data}
      errorKind={state.errorKind}
      title={title}
    />
  );
}
