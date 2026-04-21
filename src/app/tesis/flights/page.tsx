"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, EyeOff } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FlightsTable } from "@/components/flights-table";
import { FlightRadarMap } from "@/components/maps/flight-radar-map-dynamic";

export default function TesisFlightsPage() {
  const [selectedId, setSelectedId] = React.useState<string | undefined>();

  return (
    <AppShell title="Laboratorio · Radar">
      <div className="space-y-4">
        <div>
          <Link
            href="/tesis"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            Volver al laboratorio
          </Link>
        </div>

        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <EyeOff className="size-3" />
              Vista oculta
            </Badge>
            <Badge variant="outline" className="text-risk-medium">
              Fuera del MVP
            </Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Radar predictivo de vuelos — ATL
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Visualización estilo Flightradar con posiciones simuladas sobre
            rutas great-circle desde ATL. Los aviones se colorean por riesgo
            predicho por el modelo. Hacé clic en un avión para ver su predicción
            y factores SHAP.
          </p>
        </header>

        <Card className="p-0 overflow-hidden">
          <FlightRadarMap
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id || undefined)}
            height={600}
          />
        </Card>

        <FlightsTable />
      </div>
    </AppShell>
  );
}
