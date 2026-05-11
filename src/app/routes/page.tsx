// UGS-38: página de historial de puntualidad por ruta
// UGS-132: incluye gráfico de tendencia semanal
// UGS-133: gráfico conectado a GET /api/routes/{origin}/{destination}/history
"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RoutesTable } from "@/components/routes-table";
import { RouteHistoryChart } from "@/components/route-history-chart";
import { MOCK_ROUTES } from "@/lib/mock-data";

export default function RoutesPage() {
  const [selectedRoute, setSelectedRoute] = useState(MOCK_ROUTES[0].route);

  return (
    <AppShell title="Historial por ruta">
      <div className="space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Puntualidad histórica por ruta
          </h1>
          <p className="text-sm text-muted-foreground">
            Seleccioná una ruta para ver su tendencia semanal de las últimas 12
            semanas.
          </p>
        </header>
        <RoutesTable
          selectedRoute={selectedRoute}
          onRouteSelect={setSelectedRoute}
        />
        <RouteHistoryChart route={selectedRoute} />
      </div>
    </AppShell>
  );
}
