"use client";

import "leaflet/dist/leaflet.css";
import "./map-overrides.css";

import * as React from "react";
import Link from "next/link";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Tooltip,
  CircleMarker,
  useMap,
} from "react-leaflet";

import { MOCK_FLIGHTS, type FlightTrack } from "@/lib/mock-data";
import { AIRPORTS, greatCirclePath } from "@/lib/geo";
import { cn } from "@/lib/utils";

const RISK_COLOR: Record<FlightTrack["risk"], string> = {
  low: "#4ade80",
  medium: "#facc15",
  high: "#f87171",
};

function planeIcon(bearing: number, risk: FlightTrack["risk"], selected = false) {
  const color = RISK_COLOR[risk];
  const scale = selected ? 1.25 : 1;
  const ring = selected
    ? `<circle cx="14" cy="14" r="13" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-opacity="0.55" stroke-width="1" />`
    : "";
  const html = `
    <div class="relative" style="width:28px;height:28px;transform:rotate(${bearing}deg);transform-origin:center;">
      <svg viewBox="0 0 28 28" width="28" height="28" xmlns="http://www.w3.org/2000/svg" style="transform:scale(${scale});transform-origin:center;">
        ${ring}
        <path d="M14 2 L16.2 12.2 L26 15 L26 17 L16.2 15.6 L15.3 22 L17.8 24 L17.8 25.5 L14 24.6 L10.2 25.5 L10.2 24 L12.7 22 L11.8 15.6 L2 17 L2 15 L11.8 12.2 Z"
              fill="${color}" stroke="#0b1220" stroke-width="0.6" stroke-linejoin="round" />
      </svg>
    </div>
  `;
  return L.divIcon({
    html,
    className: "ontimeai-plane-icon",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function airportIcon(code: string, variant: "origin" | "destination") {
  const bg = variant === "origin" ? "#60a5fa" : "#94a3b8";
  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-6px);pointer-events:none;">
      <div style="font-family:ui-monospace,Menlo,monospace;font-size:10px;font-weight:700;letter-spacing:0.05em;color:${bg};text-shadow:0 1px 2px rgba(0,0,0,0.8);">${code}</div>
      <div style="width:10px;height:10px;border-radius:50%;background:${bg};box-shadow:0 0 0 2px rgba(15,23,42,0.9), 0 0 0 3px ${bg}33;margin-top:2px;"></div>
    </div>
  `;
  return L.divIcon({
    html,
    className: "ontimeai-airport-icon",
    iconSize: [32, 28],
    iconAnchor: [16, 18],
  });
}

function FitToFlights({ flights }: { flights: FlightTrack[] }) {
  const map = useMap();
  React.useEffect(() => {
    if (flights.length === 0) return;
    const points: Array<[number, number]> = [];
    for (const f of flights) {
      const o = AIRPORTS[f.origin];
      const d = AIRPORTS[f.destination];
      if (o) points.push([o.lat, o.lng]);
      if (d) points.push([d.lat, d.lng]);
      points.push([f.currentLat, f.currentLng]);
    }
    if (points.length > 0) {
      map.fitBounds(points, { padding: [32, 32] });
    }
  }, [flights, map]);
  return null;
}

export type FlightRadarMapProps = {
  flights?: FlightTrack[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  className?: string;
  height?: number | string;
  showRoutes?: boolean;
};

export function FlightRadarMap({
  flights = MOCK_FLIGHTS,
  selectedId,
  onSelect,
  className,
  height = 520,
  showRoutes = true,
}: FlightRadarMapProps) {
  const originCoords = AIRPORTS.ATL;
  const destinations = React.useMemo(() => {
    const seen = new Set<string>();
    const list: typeof AIRPORTS[string][] = [];
    for (const f of flights) {
      if (!seen.has(f.destination) && AIRPORTS[f.destination]) {
        seen.add(f.destination);
        list.push(AIRPORTS[f.destination]);
      }
    }
    return list;
  }, [flights]);

  return (
    <div
      className={cn("relative overflow-hidden rounded-lg border bg-[#0b1220]", className)}
      style={{ height }}
    >
      <MapContainer
        center={[originCoords.lat, originCoords.lng]}
        zoom={4}
        minZoom={3}
        maxZoom={10}
        worldCopyJump
        zoomControl={false}
        attributionControl={false}
        style={{ height: "100%", width: "100%", background: "#0b1220" }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains={["a", "b", "c", "d"]}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        <FitToFlights flights={flights} />

        {showRoutes &&
          flights.map((f) => {
            const o = AIRPORTS[f.origin];
            const d = AIRPORTS[f.destination];
            if (!o || !d) return null;
            const path = greatCirclePath(o, d, 48);
            const flown = path.slice(0, Math.max(2, Math.round(path.length * f.progress)));
            const remaining = path.slice(flown.length - 1);
            const color = RISK_COLOR[f.risk];
            return (
              <React.Fragment key={f.id}>
                <Polyline
                  positions={remaining}
                  pathOptions={{
                    color,
                    weight: 1,
                    opacity: 0.35,
                    dashArray: "3 5",
                  }}
                />
                <Polyline
                  positions={flown}
                  pathOptions={{
                    color,
                    weight: 1.6,
                    opacity: 0.85,
                  }}
                />
              </React.Fragment>
            );
          })}

        <Marker
          position={[originCoords.lat, originCoords.lng]}
          icon={airportIcon("ATL", "origin")}
          interactive={false}
        />

        {destinations.map((d) => (
          <Marker
            key={d.code}
            position={[d.lat, d.lng]}
            icon={airportIcon(d.code, "destination")}
            interactive={false}
          />
        ))}

        {flights.map((f) => {
          const selected = selectedId === f.id;
          return (
            <Marker
              key={f.id}
              position={[f.currentLat, f.currentLng]}
              icon={planeIcon(f.bearing, f.risk, selected)}
              eventHandlers={{
                click: () => onSelect?.(f.id),
              }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                <FlightTooltip flight={f} />
              </Tooltip>
            </Marker>
          );
        })}

        {selectedId ? (
          <CircleMarker
            center={[
              flights.find((f) => f.id === selectedId)?.currentLat ?? 0,
              flights.find((f) => f.id === selectedId)?.currentLng ?? 0,
            ]}
            radius={18}
            pathOptions={{
              color: RISK_COLOR[
                flights.find((f) => f.id === selectedId)?.risk ?? "low"
              ],
              weight: 1,
              opacity: 0.6,
              fillOpacity: 0.05,
            }}
          />
        ) : null}
      </MapContainer>

      <MapLegend />
      <SimulatedBadge />
      {onSelect ? (
        <SelectedCard
          flight={flights.find((f) => f.id === selectedId) ?? null}
          onClose={() => onSelect?.("")}
        />
      ) : null}
    </div>
  );
}

function FlightTooltip({ flight }: { flight: FlightTrack }) {
  return (
    <div className="font-sans text-xs text-white">
      <div className="font-mono text-[11px] font-semibold">
        {flight.flightNumber}
      </div>
      <div className="text-[10px] opacity-80">
        {flight.origin} → {flight.destination}
      </div>
      <div className="mt-1 flex items-center gap-2 text-[10px]">
        <span>FL{Math.round(flight.altitudeFt / 100)}</span>
        <span>·</span>
        <span>{flight.groundSpeedKt} kt</span>
        <span>·</span>
        <span
          style={{
            color: RISK_COLOR[flight.risk],
          }}
        >
          {Math.round(flight.delayProbability * 100)}%
        </span>
      </div>
    </div>
  );
}

function SelectedCard({
  flight,
  onClose,
}: {
  flight: FlightTrack | null;
  onClose: () => void;
}) {
  if (!flight) return null;
  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 z-[400] w-72 rounded-lg border border-white/10 bg-[#0b1220]/95 p-3 text-sm text-white shadow-lg backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-sm font-semibold">
            {flight.flightNumber}
          </div>
          <div className="text-[11px] text-white/60">{flight.airline}</div>
        </div>
        <button
          onClick={onClose}
          className="rounded text-[11px] text-white/60 hover:text-white"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <div className="text-white/50">Ruta</div>
          <div className="font-mono">
            {flight.origin} → {flight.destination}
          </div>
        </div>
        <div>
          <div className="text-white/50">Salida</div>
          <div className="font-mono">{flight.scheduledDeparture}</div>
        </div>
        <div>
          <div className="text-white/50">Altitud</div>
          <div className="font-mono">
            FL{Math.round(flight.altitudeFt / 100)}
          </div>
        </div>
        <div>
          <div className="text-white/50">Velocidad</div>
          <div className="font-mono">{flight.groundSpeedKt} kt</div>
        </div>
        <div className="col-span-2">
          <div className="text-white/50">Riesgo predictivo</div>
          <div
            className="font-mono"
            style={{ color: RISK_COLOR[flight.risk] }}
          >
            {Math.round(flight.delayProbability * 100)}% · +
            {flight.expectedDelayMinutes} min
          </div>
        </div>
      </div>
      <Link
        href={`/flights/${flight.id}`}
        className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-white/10 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-white/20"
      >
        Ver detalle + SHAP
      </Link>
    </div>
  );
}

function MapLegend() {
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-[400] flex flex-col gap-1 rounded-md border border-white/10 bg-[#0b1220]/80 px-2 py-1.5 text-[10px] text-white/80 backdrop-blur">
      <div className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-[#4ade80]" /> Riesgo bajo
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-[#facc15]" /> Riesgo medio
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-[#f87171]" /> Riesgo alto
      </div>
    </div>
  );
}

function SimulatedBadge() {
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-[400] rounded-md border border-white/10 bg-[#0b1220]/80 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-white/70 backdrop-blur">
      <span className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-[#facc15] align-middle" />
      Simulado · batch predictivo
    </div>
  );
}
