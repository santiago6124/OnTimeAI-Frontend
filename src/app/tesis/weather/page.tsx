import Link from "next/link";
import { ArrowLeft, EyeOff } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WeatherCard } from "@/components/weather-card";
import { HourlyDelayChart } from "@/components/hourly-delay-chart";
import { WeatherMap } from "@/components/maps/weather-map-dynamic";

export default function TesisWeatherPage() {
  return (
    <AppShell title="Laboratorio · Meteo">
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
            Mapa meteorológico operativo
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Estaciones NOAA georreferenciadas sobre CONUS. Los halos reflejan el
            impacto proyectado sobre la puntualidad de vuelos ATL según la
            severidad del clima de cada nodo.
          </p>
        </header>

        <Card className="p-0 overflow-hidden">
          <WeatherMap height={600} />
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <WeatherCard />
          <HourlyDelayChart />
        </div>
      </div>
    </AppShell>
  );
}
