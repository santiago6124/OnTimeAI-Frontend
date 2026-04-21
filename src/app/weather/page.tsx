import { AppShell } from "@/components/app-shell";
import { WeatherCard } from "@/components/weather-card";
import { HourlyDelayChart } from "@/components/hourly-delay-chart";
import { WeatherMap } from "@/components/maps/weather-map-dynamic";
import { Card } from "@/components/ui/card";

export default function WeatherPage() {
  return (
    <AppShell title="Meteorología ATL">
      <div className="space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Condiciones meteorológicas — KATL y red operativa
          </h1>
          <p className="text-sm text-muted-foreground">
            Estaciones NOAA con impacto estimado sobre la puntualidad. El radio
            del halo refleja el impacto operacional proyectado.
          </p>
        </header>

        <Card className="p-0 overflow-hidden">
          <WeatherMap height={560} />
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <WeatherCard />
          <HourlyDelayChart />
        </div>
      </div>
    </AppShell>
  );
}
