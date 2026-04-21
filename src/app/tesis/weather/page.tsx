"use client";

import Link from "next/link";
import { ArrowLeft, EyeOff, Radar, RefreshCw } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WeatherCard } from "@/components/weather-card";
import { HourlyDelayChart } from "@/components/hourly-delay-chart";
import { WeatherMap } from "@/components/maps/weather-map-dynamic";
import { WeatherErrorCard } from "@/components/weather-error-card";
import { RawPayloadPanel } from "@/components/raw-payload-panel";
import { useWeatherStations } from "@/hooks/use-weather-stations";
import type { WeatherStation } from "@/lib/mock-data";

export default function TesisWeatherPage() {
  const { status, data, error, reload } = useWeatherStations();

  const atlStation = data?.stations.find((s) => s.code === "ATL");

  return (
    <AppShell title="Laboratorio · Meteo">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/tesis"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            Volver al laboratorio
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={reload}
            disabled={status === "loading"}
            className="gap-1"
          >
            <RefreshCw
              className={
                "size-3.5 " + (status === "loading" ? "animate-spin" : "")
              }
            />
            Reintentar
          </Button>
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
            {status === "success" ? (
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
            METAR en vivo desde Aviation Weather Center (NOAA) vía el proxy{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
              /api/weather
            </code>
            . Abrí DevTools → Network para ver la request.
          </p>
          {data?.fetchedAt ? (
            <p className="font-mono text-[11px] text-muted-foreground">
              Última actualización:{" "}
              {new Date(data.fetchedAt).toLocaleString("es-AR", {
                dateStyle: "short",
                timeStyle: "medium",
              })}{" "}
              · proxy: {data.elapsedMs}ms
            </p>
          ) : null}
        </header>

        {status === "loading" || status === "idle" ? (
          <LoadingState />
        ) : status === "error" ? (
          <WeatherErrorCard message={error ?? "Error desconocido"} />
        ) : data && data.stations.length > 0 ? (
          <>
            <Card className="p-0 overflow-hidden">
              <WeatherMap stations={data.stations} height={600} />
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              {atlStation && data.atlRaw ? (
                <WeatherCard
                  title="KATL · METAR en vivo"
                  data={{
                    temperatureF: atlStation.temperatureF,
                    windKt: atlStation.windKt,
                    visibilitySm: atlStation.visibilitySm,
                    condition: conditionLabel(atlStation.condition),
                    metar: data.atlRaw,
                  }}
                />
              ) : null}
              <HourlyDelayChart />
            </div>

            <RawPayloadPanel
              title="Payload crudo de AWC"
              description="Respuesta JSON completa del endpoint de METAR. La URL externa es la original de AWC (abrila en una pestaña para ver el response directo de NOAA)."
              url={data.requestUrl}
              payload={data.rawPayload}
            />
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
      <Skeleton className="h-[600px] w-full rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-52 w-full rounded-lg" />
        <Skeleton className="h-52 w-full rounded-lg" />
      </div>
    </div>
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
