import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Plane } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RiskBadge } from "@/components/risk-badge";
import { ShapPanel } from "@/components/shap-panel";
import { WeatherCard } from "@/components/weather-card";
import { getFlightById } from "@/lib/mock-data";

export default async function FlightDetailPage(
  props: PageProps<"/flights/[id]">,
) {
  const { id } = await props.params;
  const flight = getFlightById(id);

  if (!flight) notFound();

  return (
    <AppShell title={`Vuelo ${flight.flightNumber}`}>
      <div className="space-y-4">
        <div>
          <Link
            href="/"
            className={buttonVariants({ variant: "ghost", size: "sm" }) + " gap-1 -ml-2"}
          >
            <ArrowLeft className="size-4" />
            Volver al dashboard
          </Link>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-md bg-muted font-mono text-sm font-semibold">
                {flight.airlineCode}
              </span>
              <div>
                <h1 className="font-mono text-2xl font-semibold tracking-tight">
                  {flight.flightNumber}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {flight.airline} · {flight.aircraft}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RiskBadge risk={flight.risk} size="md" />
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-6 pt-6 md:flex-row md:items-center md:justify-between">
            <RouteEndpoint
              code={flight.origin}
              name={flight.originName}
              time={flight.scheduledDeparture}
              label="Salida"
            />
            <div className="hidden flex-col items-center gap-1 md:flex">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-px w-16 bg-border" />
                <Plane className="size-4" />
                <div className="h-px w-16 bg-border" />
              </div>
              <div className="font-mono text-xs text-muted-foreground">
                Gate {flight.gate}
              </div>
            </div>
            <div className="flex md:hidden items-center gap-2 text-muted-foreground">
              <ArrowRight className="size-4" />
            </div>
            <RouteEndpoint
              code={flight.destination}
              name={flight.destinationName}
              time={flight.scheduledArrival}
              label="Llegada"
              align="right"
            />
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Predicción del modelo
              </CardTitle>
              <CardDescription>XGBoost — ATL 2020-2024</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <KV
                label="Probabilidad de retraso"
                value={`${Math.round(flight.delayProbability * 100)}%`}
                emphasis
              />
              <Separator />
              <KV
                label="Retraso esperado"
                value={`+${flight.expectedDelayMinutes} min`}
              />
              <Separator />
              <KV label="Nivel de riesgo" value={<RiskBadge risk={flight.risk} />} />
              <Separator />
              <KV label="Gate" value={flight.gate} mono />
              <KV label="Aeronave" value={flight.aircraft} mono />
            </CardContent>
          </Card>

          <div className="lg:col-span-2">
            <ShapPanel factors={flight.shap} />
          </div>
        </div>

        <WeatherCard />
      </div>
    </AppShell>
  );
}

function RouteEndpoint({
  code,
  name,
  time,
  label,
  align = "left",
}: {
  code: string;
  name: string;
  time: string;
  label: string;
  align?: "left" | "right";
}) {
  return (
    <div
      className={`flex flex-col gap-1 ${align === "right" ? "md:items-end md:text-right" : ""}`}
    >
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-3xl font-semibold">{code}</span>
        <span className="font-mono text-lg text-muted-foreground">{time}</span>
      </div>
      <div className="text-xs text-muted-foreground">{name}</div>
    </div>
  );
}

function KV({
  label,
  value,
  emphasis = false,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`${emphasis ? "font-mono text-lg font-semibold" : mono ? "font-mono text-sm" : "text-sm"}`}
      >
        {value}
      </span>
    </div>
  );
}
