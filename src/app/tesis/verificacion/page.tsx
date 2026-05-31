import Link from "next/link";
import { ExternalLink, CheckCircle2, XCircle, Clock3, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { api, type Flight } from "@/lib/api";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Verificación de predicciones — OnTimeAI",
  description: "Compará predicciones del modelo con el estado real en fuentes externas.",
  robots: { index: false, follow: false },
};

/* ─── helpers ─────────────────────────────────────────────────────────────── */

/** DAL1234-1747612800-schedule-0  →  DAL1234 */
function icaoIdent(faFlightId: string) {
  return faFlightId.split("-")[0];
}

/** "DL 123"  →  "dl123"  (para FR24) */
function iataIdent(flightNumber: string) {
  return flightNumber.replace(/\s+/g, "").toLowerCase();
}

function flightAwareUrl(faFlightId: string) {
  return `https://www.flightaware.com/live/flight/${icaoIdent(faFlightId)}`;
}

function fr24Url(flightNumber: string) {
  return `https://www.flightradar24.com/data/flights/${iataIdent(flightNumber)}`;
}

function fmtTime(iso: string | null | undefined) {
  if (!iso) return "—";
  // Normalize: strings without TZ suffix must be treated as UTC, not local time
  const normalized = /[Z+]/.test(iso) ? iso : iso + "Z";
  const d = new Date(normalized);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${min}`;
}

const RISK_LABEL: Record<string, string> = {
  high: "Alto",
  medium: "Medio",
  low: "Bajo",
};

const RISK_CLASS: Record<string, string> = {
  high: "bg-risk-high/15 text-risk-high border-risk-high/30",
  medium: "bg-risk-medium/15 text-risk-medium border-risk-medium/30",
  low: "bg-risk-low/15 text-risk-low border-risk-low/30",
};

/* ─── sub-components ──────────────────────────────────────────────────────── */

function ProbBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 50 ? "bg-risk-high" : pct >= 28 ? "bg-risk-medium" : "bg-risk-low";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right text-xs tabular-nums">{pct}%</span>
    </div>
  );
}

function ResultBadge({ flight }: { flight: Flight }) {
  if (!flight.has_actual || flight.arr_delay_min === null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const actualDelay = flight.arr_delay_min > 15;
  const predictedDelay = flight.risk === "high";
  const correct = predictedDelay === actualDelay;
  const label = actualDelay
    ? `+${flight.arr_delay_min} min`
    : `${flight.arr_delay_min} min`;

  return (
    <div className="flex items-center gap-1.5">
      {correct ? (
        <CheckCircle2 className="size-3.5 text-risk-low" />
      ) : (
        <XCircle className="size-3.5 text-risk-high" />
      )}
      <span className={cn("text-xs tabular-nums", correct ? "text-risk-low" : "text-risk-high")}>
        {label}
      </span>
    </div>
  );
}

function ExternalLinks({ flight }: { flight: Flight }) {
  return (
    <div className="flex items-center gap-2">
      <a
        href={flightAwareUrl(flight.fa_flight_id)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        FA <ExternalLink className="size-2.5" />
      </a>
      <a
        href={fr24Url(flight.flight_number)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        FR24 <ExternalLink className="size-2.5" />
      </a>
    </div>
  );
}

function FlightRow({ flight }: { flight: Flight }) {
  return (
    <tr className="border-b transition-colors hover:bg-muted/30">
      <td className="py-2.5 pl-4 pr-3">
        <Link
          href={`/flights/${encodeURIComponent(flight.fa_flight_id)}`}
          className="font-mono text-xs font-semibold hover:text-primary hover:underline"
        >
          {icaoIdent(flight.fa_flight_id)}
        </Link>
        <div className="text-[10px] text-muted-foreground">{flight.flight_number}</div>
      </td>
      <td className="px-3 py-2.5 text-xs">
        <span className="font-medium">{flight.origin}</span>
        <span className="text-muted-foreground"> → </span>
        <span className="font-medium">{flight.destination}</span>
      </td>
      <td className="px-3 py-2.5 text-xs tabular-nums text-muted-foreground">
        {fmtTime(flight.scheduled_out_utc)}
      </td>
      <td className="px-3 py-2.5">
        <ProbBar value={flight.delay_probability} />
      </td>
      <td className="px-3 py-2.5">
        <span
          className={cn(
            "inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium",
            RISK_CLASS[flight.risk],
          )}
        >
          {RISK_LABEL[flight.risk]}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <ResultBadge flight={flight} />
      </td>
      <td className="py-2.5 pl-3 pr-4">
        <ExternalLinks flight={flight} />
      </td>
    </tr>
  );
}

function FlightTable({ flights }: { flights: Flight[] }) {
  if (flights.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Sin vuelos en este grupo
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pl-4 pr-3 text-left">Vuelo</th>
            <th className="px-3 py-2 text-left">Ruta</th>
            <th className="px-3 py-2 text-left">Salida UTC</th>
            <th className="px-3 py-2 text-left">P(demora)</th>
            <th className="px-3 py-2 text-left">Riesgo</th>
            <th className="px-3 py-2 text-left">Resultado real</th>
            <th className="py-2 pl-3 pr-4 text-left">Verificar</th>
          </tr>
        </thead>
        <tbody>
          {flights.map((f) => (
            <FlightRow key={f.fa_flight_id} flight={f} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── page ────────────────────────────────────────────────────────────────── */

export default async function VerificacionPage() {
  let flights: Flight[] = [];
  let fetchError = false;

  try {
    flights = await api.flights();
  } catch {
    fetchError = true;
  }

  // Separar por disponibilidad de resultado real
  const withActual = flights
    .filter((f) => f.has_actual && f.arr_delay_min !== null)
    .sort((a, b) => (a.scheduled_out_utc > b.scheduled_out_utc ? -1 : 1));

  const pending = flights
    .filter((f) => !f.has_actual)
    .sort((a, b) => (a.scheduled_out_utc < b.scheduled_out_utc ? -1 : 1));

  // Mini accuracy stats sobre los vuelos con resultado
  let tp = 0, tn = 0, fp = 0, fn = 0;
  for (const f of withActual) {
    const predPos = f.risk === "high";
    const actualPos = (f.arr_delay_min ?? 0) > 15;
    if (predPos && actualPos) tp++;
    else if (!predPos && !actualPos) tn++;
    else if (predPos && !actualPos) fp++;
    else fn++;
  }
  const total = withActual.length;
  const correct = tp + tn;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : null;
  const precision = tp + fp > 0 ? Math.round((tp / (tp + fp)) * 100) : null;
  const recall = tp + fn > 0 ? Math.round((tp / (tp + fn)) * 100) : null;

  return (
    <AppShell title="Verificación de predicciones">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        {/* Header */}
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <TrendingUp className="size-3" />
              Validación en vivo
            </Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Verificación de predicciones
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Compará cada predicción del modelo contra el estado real del vuelo.
            Los botones <strong>FA</strong> (FlightAware) y <strong>FR24</strong>{" "}
            (FlightRadar24) abren el vuelo en la fuente externa para verificación
            independiente.
          </p>
        </header>

        {/* Error state */}
        {fetchError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            No se pudieron cargar los vuelos. Verificá la conexión al backend.
          </div>
        )}

        {/* Stats sobre vuelos con resultado conocido */}
        {total > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Vuelos evaluados", value: total, sub: "con resultado real" },
              {
                label: "Accuracy",
                value: `${accuracy}%`,
                sub: `${correct}/${total} correctos`,
              },
              {
                label: "Precisión",
                value: precision !== null ? `${precision}%` : "—",
                sub: `TP=${tp} FP=${fp}`,
              },
              {
                label: "Recall",
                value: recall !== null ? `${recall}%` : "—",
                sub: `TP=${tp} FN=${fn}`,
              },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border p-4">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums">{s.value}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{s.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Vuelos pendientes de resultado */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock3 className="size-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">
              Vuelos pendientes
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({pending.length}) — verificar en fuente externa
              </span>
            </h2>
          </div>
          <FlightTable flights={pending} />
        </section>

        {/* Vuelos con resultado real conocido */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">
              Resultado conocido
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({withActual.length}) — demora real registrada
              </span>
            </h2>
          </div>
          <FlightTable flights={withActual} />
        </section>

        {/* Leyenda */}
        <div className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Cómo interpretar</p>
          <ul className="mt-2 space-y-1 list-disc pl-4">
            <li>
              <strong>FA</strong> = FlightAware — tracker oficial, usa el identificador
              ICAO del vuelo (ej. DAL1234). Muestra delay real en tiempo real.
            </li>
            <li>
              <strong>FR24</strong> = FlightRadar24 — alternativa visual, usa el
              identificador IATA (ej. DL1234). Útil para ver posición live.
            </li>
            <li>
              El modelo predice demora si <strong>riesgo = Alto</strong>. Un resultado
              correcto es TP (predicho: demorado, real: demorado) o TN (predicho: a
              tiempo, real: a tiempo).
            </li>
            <li>
              &quot;Resultado real&quot; = <code>arr_delay_min</code> desde AeroAPI. Positivo
              = llegó tarde, negativo = llegó antes.
            </li>
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
