"use client";

import * as React from "react";

import { api, type Flight } from "@/lib/api";

type FlightsState = {
  flights: Flight[];
  loading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
};

const INITIAL_STATE: FlightsState = {
  flights: [],
  loading: true,
  isRefreshing: false,
  error: null,
  lastUpdated: null,
};

export function useFlights(refreshIntervalMs = 60_000) {
  const [state, setState] = React.useState<FlightsState>(INITIAL_STATE);

  const reload = React.useCallback(async () => {
    setState((current) => ({ ...current, isRefreshing: current.flights.length > 0 }));
    try {
      const flights = await api.flights();
      setState({
        flights,
        loading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        isRefreshing: false,
        error: error instanceof Error ? error.message : "No se pudieron cargar los vuelos.",
      }));
    }
  }, []);

  React.useEffect(() => {
    let active = true;

    async function load() {
      try {
        const flights = await api.flights();
        if (!active) return;
        setState({
          flights,
          loading: false,
          isRefreshing: false,
          error: null,
          lastUpdated: new Date(),
        });
      } catch (error) {
        if (!active) return;
        setState((current) => ({
          ...current,
          loading: false,
          isRefreshing: false,
          error: error instanceof Error ? error.message : "No se pudieron cargar los vuelos.",
        }));
      }
    }

    void load();
    const interval = window.setInterval(load, refreshIntervalMs);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [refreshIntervalMs]);

  return { ...state, reload };
}
