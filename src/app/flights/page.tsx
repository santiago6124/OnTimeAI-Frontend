"use client";

import * as React from "react";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FlightsTable } from "@/components/flights-table";
import { FlightRadarMap } from "@/components/maps/flight-radar-map-dynamic";
import { useRealFlightTracks } from "@/hooks/use-real-flight-tracks";
import { Plane } from "lucide-react";

export default function FlightsPage() {
  const [selectedId, setSelectedId] = React.useState<string | undefined>();
  const { tracks, loading } = useRealFlightTracks();

  return (
    <AppShell title="Vuelos ATL">
      <div className="space-y-4">
        <header className="flex items-center justify-between gap-2">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Vuelos ATL</h1>
            <p className="text-sm text-muted-foreground">
              Radar en vivo · posiciones interpoladas por ruta y tiempo
            </p>
          </div>
          {!loading && (
            <Badge variant="outline" className="gap-1.5 shrink-0">
              <Plane className="size-3" />
              {tracks.length} en ruta
            </Badge>
          )}
        </header>

        {loading ? (
          <Skeleton className="h-[560px] w-full rounded-lg" />
        ) : (
          <Card className="p-0 overflow-hidden">
            <FlightRadarMap
              flights={tracks}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id || undefined)}
              height={560}
            />
          </Card>
        )}

        <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted" />}>
          <FlightsTable />
        </Suspense>
      </div>
    </AppShell>
  );
}
