import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { MetricCards, MetricCardsSkeleton } from "@/components/metric-cards";
import { FlightsTable } from "@/components/flights-table";
import { WeatherCard } from "@/components/weather-card";
import { HourlyDelayChart } from "@/components/hourly-delay-chart";
import { ModelBadge } from "@/components/model-badge";
import { getServerRole } from "@/lib/server-auth";

export default async function DashboardPage() {
  const role = await getServerRole();
  return (
    <AppShell title="Dashboard operacional">
      <div className="space-y-4">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Vuelos del día
          </h1>
          <p className="text-sm text-muted-foreground">
            Predicción en tiempo real de retrasos 
          </p>
        </header>

        <Suspense fallback={<MetricCardsSkeleton />}>
          <MetricCards />
        </Suspense>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <HourlyDelayChart />
          </div>
          <div className="flex flex-col gap-4">
            {(role === "admin" || role === "superadmin") && <ModelBadge />}
            <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-muted" />}>
              <WeatherCard />
            </Suspense>
          </div>
        </div>

        <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted" />}>
          <FlightsTable />
        </Suspense>
      </div>
    </AppShell>
  );
}
