import Link from "next/link";
import { ArrowLeft, EyeOff, Radar } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WeatherCard } from "@/components/weather-card";
import { HourlyDelayChart } from "@/components/hourly-delay-chart";
import { WeatherMap } from "@/components/maps/weather-map-dynamic";
import { WeatherErrorCard } from "@/components/weather-error-card";
import {
  ATL_REGIONAL_STATIONS,
  fetchWeatherStations,
} from "@/lib/weather-api";
import type { WeatherStation } from "@/lib/mock-data";

export const metadata = {
  title: "Laboratorio · Meteo — OnTimeAI",
  description: "Vista experimental fuera del alcance del MVP.",
  robots: { index: false, follow: false },
};

export const revalidate = 300;

export default async function TesisWeatherPage() {
  let stations: WeatherStation[] | null = null;
  let atlRaw: string | null = null;
  let fetchedAt: string | null = null;
  let errorMessage: string | null = null;

  try {
    const result = await fetchWeatherStations(ATL_REGIONAL_STATIONS);
    stations = result.stations;
    atlRaw = result.atlRaw;
    fetchedAt = result.fetchedAt;
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : String(e);
  }

  const atlStation = stations?.find((s) => s.code === "ATL");

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
            {fetchedAt ? (
              <Badge variant="outline" className="gap-1.5 text-risk-low">
                <Radar className="size-3" />
                Datos en vivo · AWC/NOAA
              </Badge>
            ) : null}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Mapa meteorológico operativo
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            METAR en vivo desde Aviation Weather Center (NOAA) para las
            estaciones principales de la red operativa ATL. Los halos reflejan
            el impacto proyectado sobre la puntualidad según la categoría de
            vuelo (VFR/MVFR/IFR/LIFR).
          </p>
          {fetchedAt ? (
            <p className="font-mono text-[11px] text-muted-foreground">
              Última actualización:{" "}
              {new Date(fetchedAt).toLocaleString("es-AR", {
                dateStyle: "short",
                timeStyle: "medium",
              })}
            </p>
          ) : null}
        </header>

        {errorMessage ? (
          <WeatherErrorCard message={errorMessage} />
        ) : stations && stations.length > 0 ? (
          <>
            <Card className="p-0 overflow-hidden">
              <WeatherMap stations={stations} height={600} />
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              {atlStation && atlRaw ? (
                <WeatherCard
                  title="KATL · METAR en vivo"
                  data={{
                    temperatureF: atlStation.temperatureF,
                    windKt: atlStation.windKt,
                    visibilitySm: atlStation.visibilitySm,
                    condition: conditionLabel(atlStation.condition),
                    metar: atlRaw,
                  }}
                />
              ) : null}
              <HourlyDelayChart />
            </div>
          </>
        ) : (
          <WeatherErrorCard message="La respuesta de AWC no contiene estaciones válidas." />
        )}
      </div>
    </AppShell>
  );
}

function conditionLabel(c: WeatherStation["condition"]): string {
  switch (c) {
    case "clear":
      return "Despejado";
    case "cloudy":
      return "Nublado";
    case "rain":
      return "Lluvia";
    case "storm":
      return "Tormenta";
    case "fog":
      return "Niebla";
  }
}
