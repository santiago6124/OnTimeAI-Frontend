"use client";

import "leaflet/dist/leaflet.css";
import "./map-overrides.css";

import * as React from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Tooltip,
  Circle,
  useMap,
} from "react-leaflet";

import {
  MOCK_WEATHER_STATIONS,
  type WeatherStation,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const CONDITION_COLOR: Record<WeatherStation["condition"], string> = {
  clear: "#38bdf8",
  cloudy: "#a78bfa",
  rain: "#22d3ee",
  storm: "#f87171",
  fog: "#94a3b8",
};

const CONDITION_LABEL: Record<WeatherStation["condition"], string> = {
  clear: "Despejado",
  cloudy: "Nublado",
  rain: "Lluvia",
  storm: "Tormenta",
  fog: "Niebla",
};

const IMPACT_RADIUS_KM: Record<WeatherStation["impact"], number> = {
  low: 60,
  medium: 110,
  high: 180,
};

const IMPACT_COLOR: Record<WeatherStation["impact"], string> = {
  low: "#4ade80",
  medium: "#facc15",
  high: "#f87171",
};

function weatherIcon(station: WeatherStation) {
  const color = CONDITION_COLOR[station.condition];
  const impact = IMPACT_COLOR[station.impact];
  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;">
      <div style="
        display:flex;align-items:center;gap:4px;
        background:rgba(11,18,32,0.95);
        border:1px solid ${impact};
        border-radius:999px;
        padding:3px 7px;
        font-family:ui-monospace,Menlo,monospace;
        font-size:10px;
        color:#fff;
        box-shadow:0 2px 10px rgba(0,0,0,0.4);
      ">
        <span style="width:6px;height:6px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color};"></span>
        <span style="font-weight:700;">${station.code}</span>
        <span style="color:#cbd5e1;">${station.temperatureF}°</span>
      </div>
    </div>
  `;
  return L.divIcon({
    html,
    className: "ontimeai-weather-icon",
    iconSize: [72, 22],
    iconAnchor: [36, 11],
  });
}

function FitToStations({ stations }: { stations: WeatherStation[] }) {
  const map = useMap();
  React.useEffect(() => {
    if (stations.length === 0) return;
    const bounds = L.latLngBounds(stations.map((s) => [s.lat, s.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [48, 48] });
  }, [stations, map]);
  return null;
}

export function WeatherMap({
  stations = MOCK_WEATHER_STATIONS,
  className,
  height = 520,
}: {
  stations?: WeatherStation[];
  className?: string;
  height?: number | string;
}) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-lg border bg-[#0b1220]", className)}
      style={{ height }}
    >
      <MapContainer
        center={[37, -95]}
        zoom={4}
        minZoom={3}
        maxZoom={8}
        zoomControl={false}
        attributionControl={false}
        style={{ height: "100%", width: "100%", background: "#0b1220" }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          subdomains={["a", "b", "c", "d"]}
          attribution='&copy; OSM &copy; CARTO'
        />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
          subdomains={["a", "b", "c", "d"]}
          opacity={0.6}
        />

        <FitToStations stations={stations} />

        {stations.map((s) => (
          <Circle
            key={`ring-${s.code}`}
            center={[s.lat, s.lng]}
            radius={IMPACT_RADIUS_KM[s.impact] * 1000}
            pathOptions={{
              color: IMPACT_COLOR[s.impact],
              weight: 1,
              opacity: 0.4,
              fillColor: IMPACT_COLOR[s.impact],
              fillOpacity: s.impact === "high" ? 0.14 : s.impact === "medium" ? 0.08 : 0.04,
            }}
          />
        ))}

        {stations.map((s) => (
          <Marker
            key={s.code}
            position={[s.lat, s.lng]}
            icon={weatherIcon(s)}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={1}>
              <WeatherTooltip station={s} />
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>

      <WeatherLegend />
      <SimulatedBadge />
    </div>
  );
}

function WeatherTooltip({ station }: { station: WeatherStation }) {
  return (
    <div className="font-sans text-xs text-white">
      <div className="font-mono text-[11px] font-semibold">
        {station.code} · {station.name}
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
        <span className="text-white/60">Temp</span>
        <span className="font-mono">{station.temperatureF}°F</span>
        <span className="text-white/60">Viento</span>
        <span className="font-mono">
          {station.windKt} kt @ {station.windDeg}°
        </span>
        <span className="text-white/60">Visibilidad</span>
        <span className="font-mono">{station.visibilitySm} SM</span>
        <span className="text-white/60">Condición</span>
        <span
          className="font-mono"
          style={{ color: CONDITION_COLOR[station.condition] }}
        >
          {CONDITION_LABEL[station.condition]}
        </span>
        <span className="text-white/60">Impacto vuelos</span>
        <span
          className="font-mono uppercase"
          style={{ color: IMPACT_COLOR[station.impact] }}
        >
          {station.impact}
        </span>
      </div>
    </div>
  );
}

function WeatherLegend() {
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-[400] flex flex-col gap-1 rounded-md border border-white/10 bg-[#0b1220]/80 px-2 py-1.5 text-[10px] text-white/80 backdrop-blur">
      <div className="mb-0.5 font-semibold uppercase tracking-wider text-white/60">
        Condición
      </div>
      {(
        Object.keys(CONDITION_COLOR) as WeatherStation["condition"][]
      ).map((c) => (
        <div key={c} className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ background: CONDITION_COLOR[c] }}
          />
          {CONDITION_LABEL[c]}
        </div>
      ))}
      <div className="mt-1 font-semibold uppercase tracking-wider text-white/60">
        Impacto
      </div>
      <div className="flex items-center gap-1.5">
        <span className="block size-2 rounded-full bg-[#4ade80]" /> Bajo
      </div>
      <div className="flex items-center gap-1.5">
        <span className="block size-2 rounded-full bg-[#facc15]" /> Medio
      </div>
      <div className="flex items-center gap-1.5">
        <span className="block size-2 rounded-full bg-[#f87171]" /> Alto
      </div>
    </div>
  );
}

function SimulatedBadge() {
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-[400] rounded-md border border-white/10 bg-[#0b1220]/80 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-white/70 backdrop-blur">
      <span className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-[#38bdf8] align-middle" />
      Mock NOAA · batch
    </div>
  );
}
