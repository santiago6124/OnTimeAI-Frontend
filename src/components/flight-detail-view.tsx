/**
 * Render del detalle de un vuelo, sin fetch.
 *
 * Separado del componente que trae los datos por el mismo motivo que
 * `metric-cards-view.tsx`. Acá hay además una razón de routing: en la web
 * el id viene del segmento `[id]`, y en el bundle empaquetado de un query
 * param, porque `output: 'export'` no admite segmentos dinámicos sin
 * resolver. La vista no se entera: recibe el vuelo ya resuelto.
 */
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, Plane } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { BackButton } from "@/components/back-button";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RiskBadge } from "@/components/risk-badge";
import { TarjetaColapsable } from "@/components/ui/tarjeta-colapsable";
import { WeatherCard } from "@/components/weather-card";
import { Badge } from "@/components/ui/badge";
import {
  fmtTime,
  fmtProba,
  type Flight,
  type PredictionPoint,
  toUTCDate,
} from "@/lib/api";
import { PredictionEvolution } from "@/components/prediction-evolution";
import { CascadaCard } from "@/components/cascada-card";
import { cn } from "@/lib/utils";

export function FlightDetailView({
  flight,
  history,
}: {
  flight: Flight;
  history: PredictionPoint[];
}) {
  const duracion = duracionProgramada(
    flight.scheduled_out_utc,
    flight.scheduled_in_utc,
  );
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
          {/* `py-4` y no `pt-6 gap-6`: con el relleno anterior esta tarjeta
              medía casi 180 px y la mitad era aire. */}
          <CardContent className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
            <RouteEndpoint
              code={flight.origin}
              scheduledTime={flight.scheduled_out_utc}
              estimatedTime={flight.estimated_out_utc}
              actualTime={flight.actual_out_utc ?? flight.actual_off_utc}
              label="Salida (UTC)"
            />
            {/* El medio llevaba una línea con un avión y nada más: era el
                hueco más grande de la pantalla. Ahora dice cuánto dura el
                vuelo y, si ya aterrizó, con cuánto retraso. */}
            <div className="hidden flex-col items-center gap-1 md:flex">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-px w-12 bg-border" />
                <Plane className="size-4" />
                <div className="h-px w-12 bg-border" />
              </div>
              {duracion ? (
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {duracion}
                </span>
              ) : null}
              {flight.has_actual && flight.arr_delay_min !== null ? (
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    flight.arr_delay_min > 15
                      ? "text-risk-high"
                      : "text-muted-foreground",
                  )}
                >
                  {flight.arr_delay_min > 0
                    ? `llegó +${Math.round(flight.arr_delay_min)} min`
                    : `llegó ${Math.round(flight.arr_delay_min)} min`}
                </span>
              ) : null}
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
          <TarjetaColapsable
            titulo="Predicción del modelo"
            detalladoPorDefecto
            // Compacto: las mismas seis cosas en una grilla apretada, sin
            // separadores ni etiquetas largas. Detallado: con el aire y los
            // nombres completos. No se esconde nada en ninguno de los dos.
            compacto={
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
                <Dato etiqueta="Probabilidad" valor={fmtProba(flight.delay_probability)} fuerte />
                <Dato
                  etiqueta="Predicción"
                  valor={flight.predicted_delay ? "Retrasado" : "A tiempo"}
                />
                <Dato etiqueta="Riesgo" valor={<RiskBadge risk={flight.risk} size="sm" />} />
                <Dato etiqueta="Aeronave" valor={flight.aircraft_type || "—"} />
                <Dato etiqueta="Última corrida" valor={fmtTime(flight.predicted_at_utc)} />
                <Dato
                  etiqueta="Resultado"
                  valor={
                    flight.has_actual && flight.arr_delay_min !== null
                      ? `${Math.round(flight.arr_delay_min)} min`
                      : "Pendiente"
                  }
                />
              </div>
            }
            detallado={
              <>
                <p className="-mt-1 text-xs text-muted-foreground">
                  LightGBM v9 · ATL 2021-2024
                </p>
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
                <KV label="Aeronave" value={flight.aircraft_type || "—"} variante="codigo" />
                <KV label="Última predicción" value={fmtTime(flight.predicted_at_utc)} variante="numero" />
                <Separator />
                <KV
                  label="Resultado real"
                  value={
                    flight.has_actual && flight.arr_delay_min !== null
                      ? <ActualOutcome arrDelay={flight.arr_delay_min} predicted={!!flight.predicted_delay} />
                      : <span className="text-muted-foreground text-sm">Pendiente</span>
                  }
                />
              </>
            }
          />

        </div>

        {/* La cascada va ANTES de la evolución.
            Estaba debajo, y entre el encabezado y ella quedaban el gráfico de
            ciclos, el detalle del ciclo y el desglose de factores: más de una
            pantalla. Es la mitad del título de la tesis y quien la fue a
            buscar sabiendo que existía no la encontró.
            Trae sus datos en el cliente porque el simulador los vuelve a pedir. */}
        <CascadaCard faFlightId={flight.fa_flight_id} />

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
      <div className="text-xs text-muted-foreground">{label}</div>
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
    <div className={`flex items-baseline gap-2 text-sm tabular-nums ${className ?? "text-muted-foreground"}`}>
      <span className="w-20 text-[10px]">{label}</span>
      <span className="text-base text-foreground">{fmtTime(value)}</span>
    </div>
  );
}

function KV({
  label, value, emphasis = false, variante,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
  /**
   * La bandera anterior ponía la familia monoespaciada en dos casos que no son
   * lo mismo: el tipo de aeronave —un código, B739— y la hora de la última
   * predicción —una cifra—. Al código le sirve esa familia; a la hora solo le
   * hace falta que los dígitos ocupen lo mismo para no bailar entre renders.
   */
  variante?: "codigo" | "numero";
}) {
  const clases = [
    emphasis ? "text-lg font-semibold tabular-nums" : "text-sm",
    variante === "codigo" ? "font-mono" : "",
    variante === "numero" ? "tabular-nums" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={clases}>{value}</span>
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


/**
 * Un dato en la versión compacta: etiqueta chica arriba, valor abajo.
 *
 * Es el mismo contenido que `KV` pero sin el aire ni los separadores, para que
 * seis datos entren en dos o tres columnas en vez de seis filas.
 */
function Dato({
  etiqueta,
  valor,
  fuerte = false,
}: {
  etiqueta: string;
  valor: React.ReactNode;
  fuerte?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{etiqueta}</p>
      <div className={fuerte ? "font-semibold tabular-nums" : "tabular-nums"}>
        {valor}
      </div>
    </div>
  );
}


/**
 * Cuánto dura el vuelo según el horario programado, como "1 h 29 min".
 *
 * Va en el centro del encabezado, donde antes había una línea decorativa y
 * nada más. Devuelve null si falta alguno de los dos horarios o si la resta no
 * tiene sentido: inventar una duración sería peor que no mostrarla.
 */
function duracionProgramada(salida?: string | null, llegada?: string | null) {
  if (!salida || !llegada) return null;
  const a = toUTCDate(salida).getTime();
  const b = toUTCDate(llegada).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return null;
  const min = Math.round((b - a) / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
}
