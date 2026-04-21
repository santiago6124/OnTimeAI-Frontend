import { AppShell } from "@/components/app-shell";
import { WeatherCard } from "@/components/weather-card";
import { HourlyDelayChart } from "@/components/hourly-delay-chart";

export default function WeatherPage() {
  return (
    <AppShell title="Meteorología ATL">
      <div className="space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Condiciones meteorológicas — KATL
          </h1>
          <p className="text-sm text-muted-foreground">
            Datos actuales de NOAA y correlación con retrasos históricos.
          </p>
        </header>
        <div className="grid gap-4 lg:grid-cols-2">
          <WeatherCard />
          <HourlyDelayChart />
        </div>
      </div>
    </AppShell>
  );
}
