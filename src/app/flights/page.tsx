"use client";

import * as React from "react";
import { AppShell } from "@/components/app-shell";
import { FlightsTable } from "@/components/flights-table";
import { FlightRadarMap } from "@/components/maps/flight-radar-map-dynamic";
import { Card } from "@/components/ui/card";

export default function FlightsPage() {
  const [selectedId, setSelectedId] = React.useState<string | undefined>();

  return (
    <AppShell title="Vuelos ATL">
      <div className="space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Buscador de vuelos
          </h1>
          <p className="text-sm text-muted-foreground">
            Mapa predictivo + tabla con filtros. Clic en un avión para ver su
            predicción.
          </p>
        </header>

        <Card className="p-0 overflow-hidden">
          <FlightRadarMap
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id || undefined)}
            height={560}
          />
        </Card>

        <FlightsTable />
      </div>
    </AppShell>
  );
}
