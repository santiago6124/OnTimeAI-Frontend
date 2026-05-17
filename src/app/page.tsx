import { AppShell } from "@/components/app-shell";
import { MetricCards } from "@/components/metric-cards";
import { FlightsTable } from "@/components/flights-table";
import { WeatherCard } from "@/components/weather-card";
import { HourlyDelayChart } from "@/components/hourly-delay-chart";
import { ModelBadge } from "@/components/model-badge";

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard operacional">
      <div className="space-y-4">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Vuelos del día — ATL
          </h1>
          <p className="text-sm text-muted-foreground">
            Predicción en tiempo real de retrasos · Hartsfield-Jackson Atlanta
          </p>
        </header>

        <MetricCards />

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <HourlyDelayChart />
          </div>
          <div className="flex flex-col gap-4">
            <ModelBadge />
            <WeatherCard />
          </div>
        </div>

        <FlightsTable />
      </div>
    </AppShell>
  );
}
