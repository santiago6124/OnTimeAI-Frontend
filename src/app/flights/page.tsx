"use client";

import * as React from "react";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FlightsTable } from "@/components/flights-table";
import { FlightRadarMap } from "@/components/maps/flight-radar-map-dynamic";
import { useRealFlightTracks, type MapTrack } from "@/hooks/use-real-flight-tracks";
import { Plane } from "lucide-react";

type StatusTab = "all" | "upcoming" | "departed";

function filterTracksByTab(tracks: MapTrack[], tab: StatusTab) {
  if (tab === "all") return tracks;
  if (tab === "departed") return tracks.filter((t) => t.isDeparted);
  // upcoming: not departed AND departing within the next 45min (same window as table)
  return tracks.filter((t) => !t.isDeparted && t.minutesToDep >= -15 && t.minutesToDep <= 45);
}

const TAB_LABELS: Record<StatusTab, string> = {
  all:      "todos los vuelos",
  upcoming: "próximas salidas",
  departed: "vuelos que ya despegaron",
};

export default function FlightsPage() {
  const [selectedId, setSelectedId] = React.useState<string | undefined>();
  const [statusTab, setStatusTab] = React.useState<StatusTab>("all");
  const { tracks, loading } = useRealFlightTracks();

  const visibleTracks = filterTracksByTab(tracks, statusTab);

  return (
    <AppShell title="Vuelos ATL">
      <div className="space-y-4">
        <header className="flex items-center justify-between gap-2">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Vuelos ATL</h1>
            <p className="text-sm text-muted-foreground">
              Radar en vivo · mostrando {TAB_LABELS[statusTab]}
            </p>
          </div>
          {!loading && (
            <Badge variant="outline" className="gap-1.5 shrink-0">
              <Plane className="size-3" />
              {visibleTracks.length} en mapa
            </Badge>
          )}
        </header>

        {loading ? (
          <Skeleton className="h-[560px] w-full rounded-lg" />
        ) : (
          <Card className="p-0 overflow-hidden">
            <FlightRadarMap
              flights={visibleTracks}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id || undefined)}
              height={560}
            />
          </Card>
        )}

        <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted" />}>
          <FlightsTable onStatusTabChange={setStatusTab} />
        </Suspense>
      </div>
    </AppShell>
  );
}
