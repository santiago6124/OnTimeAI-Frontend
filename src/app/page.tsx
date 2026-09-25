import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { MetricCards, MetricCardsSkeleton } from "@/components/metric-cards";
import {
  OperationalImpactCards,
  OperationalImpactSkeleton,
} from "@/components/operational-impact-cards";
import { FlightsTable } from "@/components/flights-table";
import { HourlyDelayChart } from "@/components/hourly-delay-chart";
import { ModelBadge } from "@/components/model-badge";
import { getServerRole } from "@/lib/server-auth";

export default async function DashboardPage() {
  const role = await getServerRole();
  return (
    <AppShell title="Dashboard operacional">
      <div className="space-y-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Vuelos del día
          </h1>
          <p className="text-sm text-muted-foreground">
            Predicción en tiempo real de retrasos
          </p>
        </header>

        {/* Las tres tarjetas van en una sola grilla, y por eso las dos vistas
            devuelven fragmentos en vez de dibujar cada una la suya: con dos
            grillas apiladas quedaban dos cifras arriba y una sola abajo,
            desalineada con las de arriba. `<Suspense>` no crea ningún nodo, así
            que las tarjetas son hijas directas de esta grilla aunque cada
            bloque cargue sus datos por su cuenta. */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Suspense fallback={<MetricCardsSkeleton />}>
            <MetricCards />
          </Suspense>
          <Suspense fallback={<OperationalImpactSkeleton />}>
            <OperationalImpactCards />
          </Suspense>
        </div>

        {/* A todo el ancho: es lo único de la pantalla que se lee de un
            vistazo, y antes compartía la fila con el clima. */}
        <HourlyDelayChart />

        <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted" />}>
          <FlightsTable />
        </Suspense>

        {/* Al final: es ficha técnica del modelo, no dato operativo. */}
        {(role === "admin" || role === "superadmin") && <ModelBadge />}
      </div>
    </AppShell>
  );
}
