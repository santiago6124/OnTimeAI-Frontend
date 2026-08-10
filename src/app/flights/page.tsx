"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FlightsTableView,
  type RiskFilter,
  type StatusTab,
} from "@/components/flights-table";
import { FlightRadarMap } from "@/components/maps/flight-radar-map-dynamic";
import { flightsToTracks, type MapTrack } from "@/hooks/use-real-flight-tracks";
import { useFlights } from "@/hooks/use-flights";
import { Plane } from "lucide-react";

function filterTracks(tracks: MapTrack[], tab: StatusTab, risk: RiskFilter, query: string) {
  let result = tracks;

  if (tab === "departed") {
    result = result.filter((t) => t.isDeparted);
  } else if (tab === "upcoming") {
    result = result.filter((t) => !t.isDeparted && t.minutesToDep >= -15 && t.minutesToDep <= 45);
  }

  if (risk !== "all") {
    result = result.filter((t) => t.risk === risk);
  }

  const term = query.trim().toLowerCase();
  if (term) {
    result = result.filter((track) =>
      [track.flightNumber, track.airline, track.origin, track.destination]
        .some((value) => value.toLowerCase().includes(term)),
    );
  }

  return result;
}

const TAB_LABELS: Record<StatusTab, string> = {
  all:      "todos los vuelos",
  upcoming: "próximas salidas",
  departed: "ya despegaron",
};

export default function FlightsPage() {
  return (
    <Suspense fallback={<FlightsPageSkeleton />}>
      <FlightsPageContent />
    </Suspense>
  );
}

function FlightsPageContent() {
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = React.useState<string | undefined>();
  const [statusTab, setStatusTab] = React.useState<StatusTab>(() => {
    const value = searchParams.get("status");
    return value === "upcoming" || value === "departed" ? value : "all";
  });
  const [risk, setRisk] = React.useState<RiskFilter>(() => {
    const value = searchParams.get("risk");
    return value === "low" || value === "medium" || value === "high" ? value : "all";
  });
  const [query, setQuery] = React.useState(() => searchParams.get("q") ?? "");
  const flightsData = useFlights();
  const tracks = React.useMemo(
    () => flightsToTracks(flightsData.flights),
    [flightsData.flights],
  );

  const visibleTracks = filterTracks(tracks, statusTab, risk, query);

  return (
    <AppShell title="Vuelos ATL">
      <div className="space-y-4">
        <header className="flex items-center justify-between gap-2">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Vuelos ATL</h1>
            <p className="text-sm text-muted-foreground">
              Trayectorias estimadas · {TAB_LABELS[statusTab]}
              {risk !== "all" ? ` · riesgo ${risk}` : ""}
            </p>
          </div>
          {!flightsData.loading && (
            <Badge variant="outline" className="gap-1.5 shrink-0">
              <Plane className="size-3" />
              {visibleTracks.length} en mapa
            </Badge>
          )}
        </header>

        {flightsData.loading ? (
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

        <FlightsTableView
          {...flightsData}
          statusTab={statusTab}
          risk={risk}
          query={query}
          onStatusTabChange={setStatusTab}
          onRiskChange={setRisk}
          onQueryChange={setQuery}
        />
      </div>
    </AppShell>
  );
}

function FlightsPageSkeleton() {
  return (
    <AppShell title="Vuelos ATL">
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-[260px] w-full rounded-lg sm:h-[380px] md:h-[560px]" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    </AppShell>
  );
}
