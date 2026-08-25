import { Suspense } from "react";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { api, fmtTime } from "@/lib/api";
import { HourlyDelayChart } from "@/components/hourly-delay-chart";
import { LiteFlightsTable } from "@/components/lite-flights-table";
import { WeatherCard } from "@/components/weather-card";
import { WeatherErrorCard } from "@/components/weather-error-card";

async function getLiveData() {
  const [flights, hourly] = await Promise.all([
    api.flights().catch(() => []),
    api.hourly().catch(() => []),
  ]);
  return { flights, hourly };
}

export default async function LivePage() {
  const { flights, hourly } = await getLiveData();

  const highRisk   = flights.filter((f) => f.risk === "high").length;
  const mediumRisk = flights.filter((f) => f.risk === "medium").length;
  const lowRisk    = flights.filter((f) => f.risk === "low").length;
  const lastUpdated = new Date().toISOString();

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Vuelos activos</p>
          <p className="text-2xl font-bold tabular-nums">{flights.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{fmtTime(lastUpdated)}</p>
        </div>
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-500/5 p-4">
          <p className="text-xs text-red-600 dark:text-red-400 uppercase tracking-wide mb-1 flex items-center gap-1">
            <AlertTriangle className="size-3" /> Riesgo alto
          </p>
          <p className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{highRisk}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {flights.length > 0 ? `${Math.round((highRisk / flights.length) * 100)}% del total` : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-500/5 p-4">
          <p className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1 flex items-center gap-1">
            <Clock className="size-3" /> Riesgo medio
          </p>
          <p className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{mediumRisk}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {flights.length > 0 ? `${Math.round((mediumRisk / flights.length) * 100)}% del total` : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-500/5 p-4">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1 flex items-center gap-1">
            <CheckCircle2 className="size-3" /> Bajo riesgo
          </p>
          <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{lowRisk}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {flights.length > 0 ? `${Math.round((lowRisk / flights.length) * 100)}% del total` : "—"}
          </p>
        </div>
      </div>

      {/* Clima + gráfico */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Suspense fallback={<div className="h-36 rounded-lg border bg-muted animate-pulse" />}>
          <WeatherCard />
        </Suspense>
        <HourlyDelayChart initialData={hourly} />
      </div>

      {/* Vuelos */}
      <div>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-base font-semibold">Vuelos del día</h2>
          <span className="text-xs text-muted-foreground">{flights.length} predicciones activas</span>
        </div>
        <LiteFlightsTable initialFlights={flights} />
      </div>
    </div>
  );
}
