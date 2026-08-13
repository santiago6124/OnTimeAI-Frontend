import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ExternalLink, Plane } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { BackButton } from "@/components/back-button";
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
import { WeatherCard } from "@/components/weather-card";
import { Badge } from "@/components/ui/badge";
import { api, ApiError, fmtTime, fmtProba } from "@/lib/api";
import { PredictionEvolution } from "@/components/prediction-evolution";

export default async function FlightDetailPage(
  props: PageProps<"/flights/[id]">,
) {
  const { id } = await props.params;
  let flight;
  try {
    flight = await api.flight(decodeURIComponent(id));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const history = await api.flightHistory(decodeURIComponent(id));
  const historyWithLatestExplanation = history.map((cycle, index) =>
    index === history.length - 1 && cycle.shap.length === 0
      ? { ...cycle, shap: flight.shap ?? [] }
      : cycle,
  );

  return (
    <AppShell title={`Vuelo ${flight.flight_number}`}>
      <div className="space-y-4">
        <div>
          <BackButton />
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-md bg-muted font-mono text-sm font-semibold">
                {flight.airline_code}
              </span>
              <div>
                <h1 className="font-mono text-2xl font-semibold tracking-tight">
                  {flight.flight_number}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {flight.airline_code} · {flight.aircraft_type || "—"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {flight.is_historical && (
              <Badge variant="secondary" className="text-xs">Vuelo concluido</Badge>
            )}
            <RiskBadge risk={flight.risk} size="md" />
            <Link
              href={`https://www.flightaware.com/live/flight/${flight.fa_flight_id.split("-")[0]}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ExternalLink className="size-3.5" />
              FlightAware
            </Link>
            <Link
              href={`https://www.flightradar24.com/data/flights/${flight.flight_number.replace(/\s+/g, "").toLowerCase()}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ExternalLink className="size-3.5" />
              FlightRadar24
            </Link>
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-6 pt-6 md:flex-row md:items-center md:justify-between">
            <RouteEndpoint
              code={flight.origin}
              scheduledTime={flight.scheduled_out_utc}
              estimatedTime={flight.estimated_out_utc}
              actualTime={flight.actual_out_utc ?? flight.actual_off_utc}
              label="Salida (UTC)"
            />
            <div className="hidden flex-col items-center gap-1 md:flex">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-px w-16 bg-border" />
                <Plane className="size-4" />
                <div className="h-px w-16 bg-border" />
              </div>
            </div>
            <div className="flex md:hidden items-center gap-2 text-muted-foreground">
              <ArrowRight className="size-4" />
            </div>
            <RouteEndpoint
              code={flight.destination}
              scheduledTime={flight.scheduled_in_utc}
              estimatedTime={flight.estimated_in_utc}
              actualTime={flight.actual_in_utc ?? flight.actual_on_utc}
              label="Llegada (UTC)"
              align="right"
            />
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Predicción del modelo
              </CardTitle>
              <CardDescription>LightGBM v9 · ATL 2021-2024</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <KV
                label="Probabilidad de retraso"
                value={fmtProba(flight.delay_probability)}
                emphasis
              />
              <Separator />
              <KV
                label="Predicción binaria"
                value={flight.predicted_delay ? "Retrasado (>15 min)" : "A tiempo"}
              />
              <Separator />
              <KV label="Nivel de riesgo" value={<RiskBadge risk={flight.risk} />} />
              <Separator />
              <KV label="Aeronave" value={flight.aircraft_type || "—"} mono />
              <KV label="Última predicción" value={fmtTime(flight.predicted_at_utc)} mono />
              <Separator />
              <KV
                label="Resultado real"
                value={
                  flight.has_actual && flight.arr_delay_min !== null
                    ? <ActualOutcome arrDelay={flight.arr_delay_min} predicted={!!flight.predicted_delay} />
                    : <span className="text-muted-foreground text-sm">Pendiente</span>
                }
              />
            </CardContent>
          </Card>

        </div>

        <PredictionEvolution history={historyWithLatestExplanation} arrDelayMin={flight.arr_delay_min} />

        <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-muted" />}>
          <WeatherCard />
        </Suspense>
      </div>
    </AppShell>
  );
}

function RouteEndpoint({
  code, scheduledTime, estimatedTime, actualTime, label, align = "left",
}: {
  code: string;
  scheduledTime: string;
  estimatedTime: string;
  actualTime: string | null;
  label: string;
  align?: "left" | "right";
}) {
  const hasDistinctEstimate = estimatedTime && estimatedTime !== scheduledTime;

  return (
    <div className={`flex min-w-48 flex-col gap-2 ${align === "right" ? "md:items-end md:text-right" : ""}`}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <span className="font-mono text-3xl font-semibold">{code}</span>
      <div className={`grid gap-1 ${align === "right" ? "md:justify-items-end" : ""}`}>
        <RouteTime label="Programada" value={scheduledTime} />
        {hasDistinctEstimate ? (
          <RouteTime label="Estimada" value={estimatedTime} className="text-risk-medium" />
        ) : null}
        {actualTime ? <RouteTime label="Real" value={actualTime} /> : null}
      </div>
    </div>
  );
}

function RouteTime({
  label, value, className,
}: {
  label: string; value: string; className?: string;
}) {
  return (
    <div className={`flex items-baseline gap-2 font-mono text-sm ${className ?? "text-muted-foreground"}`}>
      <span className="w-20 text-[10px] uppercase tracking-wide">{label}</span>
      <span className="text-base text-foreground">{fmtTime(value)}</span>
    </div>
  );
}

function KV({
  label, value, emphasis = false, mono = false,
}: {
  label: string; value: React.ReactNode; emphasis?: boolean; mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={emphasis ? "font-mono text-lg font-semibold" : mono ? "font-mono text-sm" : "text-sm"}>
        {value}
      </span>
    </div>
  );
}

function ActualOutcome({ arrDelay, predicted }: { arrDelay: number; predicted: boolean }) {
  const actuallyDelayed = arrDelay > 15;
  const correct = actuallyDelayed === predicted;
  return (
    <span className="flex flex-col items-end gap-0.5">
      <span className={`text-sm font-medium ${actuallyDelayed ? "text-risk-high" : "text-risk-low"}`}>
        {actuallyDelayed ? `Demorado (+${Math.round(arrDelay)} min)` : "A tiempo"}
      </span>
      <span className={`text-[11px] ${correct ? "text-risk-low" : "text-risk-high"}`}>
        {correct ? "✓ Predicción correcta" : "✗ Predicción incorrecta"}
      </span>
    </span>
  );
}
