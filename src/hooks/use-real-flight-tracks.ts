"use client";

import * as React from "react";
import { api, type Flight } from "@/lib/api";
import { AIRPORTS, greatCirclePoint, initialBearing } from "@/lib/geo";

export type MapTrack = {
  id: string;
  flightNumber: string;
  airline: string;
  origin: string;
  destination: string;
  risk: "high" | "medium" | "low";
  delayProbability: number;
  bearing: number;
  currentLat: number;
  currentLng: number;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  progress: number;
  isDeparted: boolean;
  minutesToDep: number;
};

function toMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  try {
    const s = iso.endsWith("Z") ? iso : iso + "Z";
    return new Date(s).getTime();
  } catch {
    return null;
  }
}

function flightToTrack(f: Flight, now: number): MapTrack | null {
  const o = AIRPORTS[f.origin];
  const d = AIRPORTS[f.destination];
  if (!o || !d) return null;

  const depMs = toMs(f.actual_out_utc) ?? toMs(f.estimated_out_utc) ?? toMs(f.scheduled_out_utc);
  const arrMs = toMs(f.estimated_in_utc) ?? toMs(f.scheduled_in_utc);
  if (!depMs || !arrMs || arrMs <= depMs) return null;

  // progress: 0 = at origin, 1 = at destination
  let progress = (now - depMs) / (arrMs - depMs);
  // show planes up to 60min before departure (pre-dep as dot at origin) through landing
  const minProgress = -60 / ((arrMs - depMs) / 60_000);
  if (progress < minProgress || progress > 1.02) return null;
  progress = Math.max(0, Math.min(1, progress));

  const pos = greatCirclePoint(o, d, progress);
  const bearing = initialBearing(pos, d);

  const isDeparted = f.actual_out_utc !== null || f.departure_delay_min !== null;
  const estOutMs = toMs(f.estimated_out_utc) ?? toMs(f.scheduled_out_utc);
  const minutesToDep = estOutMs !== null ? (estOutMs - now) / 60_000 : 0;

  return {
    id: f.fa_flight_id,
    flightNumber: f.flight_number,
    airline: f.airline_code,
    origin: f.origin,
    destination: f.destination,
    risk: f.risk,
    delayProbability: f.delay_probability,
    bearing,
    currentLat: pos.lat,
    currentLng: pos.lng,
    originLat: o.lat,
    originLng: o.lng,
    destLat: d.lat,
    destLng: d.lng,
    progress,
    isDeparted,
    minutesToDep,
  };
}

export function useRealFlightTracks() {
  const [tracks, setTracks] = React.useState<MapTrack[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      const flights = await api.flights();
      const now = Date.now();
      const mapped = flights
        .map((f) => flightToTrack(f, now))
        .filter((t): t is MapTrack => t !== null);
      setTracks(mapped);
      setError(null);
    } catch {
      setError("No se pudieron cargar los vuelos.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    const id = setInterval(load, 60_000); // refresh every 60s
    return () => clearInterval(id);
  }, []);

  return { tracks, loading, error };
}
