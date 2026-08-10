"use client";

import * as React from "react";
import type { WeatherStation } from "@/lib/mock-data";
import type { AwcMetar } from "@/lib/weather-api";

export type WeatherApiResponse = {
  stations: WeatherStation[];
  atlRaw: string | null;
  rawPayload: AwcMetar[];
  requestUrl: string;
  fetchedAt: string;
  elapsedMs: number;
};

export type WeatherApiErrorResponse = {
  error: string;
  requestUrl: string;
  elapsedMs: number;
};

type State = {
  status: "idle" | "loading" | "success" | "error";
  data: WeatherApiResponse | null;
  error: string | null;
};

export function useWeatherStations() {
  const [state, setState] = React.useState<State>({
    status: "loading",
    data: null,
    error: null,
  });

  const load = React.useCallback(async () => {
    setState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const res = await fetch("/api/weather", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        const err = (await res
          .json()
          .catch(() => ({}))) as Partial<WeatherApiErrorResponse>;
        throw new Error(
          err.error ?? `Proxy devolvió ${res.status} ${res.statusText}`,
        );
      }

      const data = (await res.json()) as WeatherApiResponse;
      setState({ status: "success", data, error: null });
    } catch (e) {
      setState({
        status: "error",
        data: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  React.useEffect(() => {
    let active = true;

    fetch("/api/weather", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as Partial<WeatherApiErrorResponse>;
          throw new Error(err.error ?? `Proxy devolvió ${res.status} ${res.statusText}`);
        }
        return res.json() as Promise<WeatherApiResponse>;
      })
      .then((data) => {
        if (active) setState({ status: "success", data, error: null });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          status: "error",
          data: null,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return () => { active = false; };
  }, []);

  return { ...state, reload: load };
}
