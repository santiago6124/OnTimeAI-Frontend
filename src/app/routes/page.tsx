"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RoutesTable } from "@/components/routes-table";
import { RouteHistoryChart } from "@/components/route-history-chart";
import { api, type RouteMetric } from "@/lib/api";

export default function RoutesPage() {
  const [routes, setRoutes] = useState<RouteMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ origin: string; dest: string } | null>(null);

  useEffect(() => {
    let active = true;
    api.routes()
      .then((data) => {
        if (!active) return;
        setRoutes(data);
        if (data.length > 0) setSelected({ origin: data[0].origin, dest: data[0].dest });
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar las rutas.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <AppShell title="Historial por ruta">
      <div className="space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Puntualidad histórica por ruta
          </h1>
          <p className="text-sm text-muted-foreground">
            Basado en vuelos completados con actuals confirmados. Seleccioná una ruta para ver su tendencia.
          </p>
        </header>
        <RoutesTable
          routes={routes}
          loading={loading}
          selectedRoute={selected ? `${selected.origin} → ${selected.dest}` : undefined}
          onRouteSelect={(origin, dest) => setSelected({ origin, dest })}
        />
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        {selected && <RouteHistoryChart origin={selected.origin} dest={selected.dest} />}
      </div>
    </AppShell>
  );
}
