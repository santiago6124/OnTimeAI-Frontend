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
import type { RiskLevel } from "@/lib/api";

type StatusTab = "all" | "upcoming" | "departed";
type RiskFilter = "all" | RiskLevel;

function filterTracks(tracks: MapTrack[], tab: StatusTab, risk: RiskFilter) {
  let result = tracks;

  if (tab === "departed") {
    result = result.filter((t) => t.isDeparted);
  } else if (tab === "upcoming") {
    result = result.filter((t) => !t.isDeparted && t.minutesToDep >= -15 && t.minutesToDep <= 45);
  }

  if (risk !== "all") {
    result = result.filter((t) => t.risk === risk);
  }

  return result;
}

const TAB_LABELS: Record<StatusTab, string> = {
  all:      "todos los vuelos",
  upcoming: "próximas salidas",
  departed: "ya despegaron",
};

export default function FlightsPage() {
  const [selectedId, setSelectedId] = React.useState<string | undefined>();
  const [statusTab, setStatusTab]   = React.useState<StatusTab>("all");
  const [risk, setRisk]             = React.useState<RiskFilter>("all");
  const { tracks, loading }         = useRealFlightTracks();

  const visibleTracks = filterTracks(tracks, statusTab, risk);

  return (
    <AppShell title="Vuelos ATL">
      <div className="space-y-4">
        <header className="flex items-center justify-between gap-2">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Vuelos ATL</h1>
            <p className="text-sm text-muted-foreground">
              Radar en vivo · {TAB_LABELS[statusTab]}
              {risk !== "all" ? ` · riesgo ${risk}` : ""}
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
          <Skeleton className="h-[260px] w-full rounded-lg sm:h-[380px] md:h-[560px]" />
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="h-[260px] sm:h-[380px] md:h-[560px]">
              <FlightRadarMap
                flights={visibleTracks}
                selectedId={selectedId}
                onSelect={(id) => setSelectedId(id || undefined)}
                height="100%"
              />
            </div>
          </Card>
        )}

        <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted" />}>
          <FlightsTable
            onStatusTabChange={setStatusTab}
            onRiskChange={setRisk}
          />
        </Suspense>
      </div>
    </AppShell>
  );
}
