"use client";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { HourlyDelayChart } from "@/components/hourly-delay-chart";
import { Cloud, Eye, Radar, Thermometer, Wind } from "lucide-react";
import { WeatherMap } from "@/components/maps/weather-map-dynamic";
import { WeatherErrorCard } from "@/components/weather-error-card";
import { useWeatherStations } from "@/hooks/use-weather-stations";
import type { WeatherStation } from "@/lib/mock-data";

export default function WeatherPage() {
  const { status, data, error } = useWeatherStations();
  const atlStation = data?.stations.find((s) => s.code === "ATL");

  return (
    <AppShell title="Meteorología ATL">
      <div className="space-y-4">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Meteorología — KATL
            </h1>
            {status === "success" && (
              <Badge variant="outline" className="gap-1.5 text-risk-low">
                <Radar className="size-3" />
                Datos en vivo · AWC/NOAA
              </Badge>
            )}
          </div>
          {data?.fetchedAt && (
            <p className="font-mono text-[11px] text-muted-foreground">
              Última actualización:{" "}
              {new Date(data.fetchedAt).toLocaleString("es-AR", {
                dateStyle: "short",
                timeStyle: "medium",
              })}
            </p>
          )}
        </header>

        {status === "loading" || status === "idle" ? (
          <LoadingState />
        ) : status === "error" ? (
          <WeatherErrorCard message={error ?? "Error desconocido"} />
        ) : data && data.stations.length > 0 ? (
          <>
            <Card className="p-0 overflow-hidden">
              <div className="h-[260px] sm:h-[380px] md:h-[500px] lg:h-[600px]">
                <WeatherMap stations={data.stations} height="100%" />
              </div>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              {atlStation && data.atlRaw && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                      <Cloud className="size-4 text-muted-foreground" />
                      KATL · METAR en vivo (AWC/NOAA)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <div className="rounded-md border bg-muted/30 p-3">
                        <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                          <Thermometer className="size-3.5" />Temp
                        </div>
                        <div className="mt-1 font-mono text-sm">{atlStation.temperatureF === null ? "—" : `${atlStation.temperatureF}°F`}</div>
                      </div>
                      <div className="rounded-md border bg-muted/30 p-3">
                        <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                          <Wind className="size-3.5" />Viento
                        </div>
                        <div className="mt-1 font-mono text-sm">{atlStation.windKt === null ? "—" : `${atlStation.windKt} kt`}</div>
                      </div>
                      <div className="col-span-2 rounded-md border bg-muted/30 p-3 sm:col-span-1">
                        <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                          <Eye className="size-3.5" />Visibilidad
                        </div>
                        <div className="mt-1 font-mono text-sm">{atlStation.visibilitySm === null ? "—" : `${atlStation.visibilitySm} SM`}</div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Condición</div>
                      <div className="text-sm">{conditionLabel(atlStation.condition)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">METAR</div>
                      <code className="block rounded bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
                        {data.atlRaw}
                      </code>
                    </div>
                  </CardContent>
                </Card>
              )}
              <HourlyDelayChart />
            </div>
          </>
        ) : (
          <WeatherErrorCard message="La respuesta del proxy no contiene estaciones válidas." />
        )}
      </div>
    </AppShell>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-[260px] w-full rounded-lg sm:h-[380px] md:h-[500px] lg:h-[600px]" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-52 w-full rounded-lg" />
        <Skeleton className="h-52 w-full rounded-lg" />
      </div>
    </div>
  );
}

function conditionLabel(c: WeatherStation["condition"]): string {
  switch (c) {
    case "clear":   return "Despejado";
    case "cloudy":  return "Nublado";
    case "rain":    return "Lluvia";
    case "storm":   return "Tormenta";
    case "fog":     return "Niebla";
  }
}
