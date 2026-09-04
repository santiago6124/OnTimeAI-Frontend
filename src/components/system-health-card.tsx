"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Database, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, fmtTime, toUTCDate, type DbStats } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * El backend corre con 2 GiB y monta la copia de la DB en /tmp, que en Cloud
 * Run es memoria. Ese es el techo real contra el que hay que leer el tamaño.
 */
const DB_CEILING_MB = 2000;

/** Umbrales del issue #10. Entre 100 y 1500 MB la DB ya merece atención. */
function storageStatus(sizeMb: number) {
  if (sizeMb >= 1500) return { tone: "red" as const, label: "Crítico" };
  if (sizeMb >= 100) return { tone: "amber" as const, label: "Atención" };
  return { tone: "green" as const, label: "Normal" };
}

/** Un ciclo del pipeline son 15 min; el doble ya indica que algo se cortó. */
const STALE_AFTER_MIN = 30;

const TABLE_LABELS: Record<string, string> = {
  predictions: "Predicciones",
  actuals: "Resultados reales",
  flights: "Vuelos",
  prediction_shap: "Factores SHAP",
  weather_obs: "Observaciones METAR",
  aircraft_position: "Posiciones ADS-B",
  runs: "Ejecuciones del pipeline",
};

const TONE_TEXT = {
  green: "text-risk-low",
  amber: "text-risk-medium",
  red: "text-risk-high",
} as const;

const TONE_BAR = {
  green: "bg-risk-low",
  amber: "bg-risk-medium",
  red: "bg-risk-high",
} as const;

/** Lo que devolvió la última lectura, junto al instante en que se resolvió. */
type Snapshot = { stats: DbStats; fetchedAt: number };

export function SystemHealthCard() {
  const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    api
      .dbStats()
      .then((stats) => {
        if (cancelled) return;
        // El instante se toma acá y no en el render: la frescura se mide
        // contra el momento de la lectura, y así el render queda puro.
        setSnapshot({ stats, fetchedAt: Date.now() });
        setError(null);
      })
      .catch((cause) => {
        if (cancelled) return;
        setError(
          cause instanceof Error ? cause.message : "No se pudo leer el estado.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  function refresh() {
    setLoading(true);
    setError(null);
    setReloadToken((t) => t + 1);
  }

  const stats = snapshot?.stats ?? null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="size-4 text-muted-foreground" />
              Salud del sistema
            </CardTitle>
            <CardDescription>
              Estado del almacenamiento y frescura del pipeline de inferencia.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="shrink-0 gap-1.5"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Actualizar
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : loading && !stats ? (
          <div className="space-y-3">
            <div className="h-14 animate-pulse rounded-md bg-muted" />
            <div className="h-20 animate-pulse rounded-md bg-muted" />
          </div>
        ) : snapshot ? (
          <>
            <StorageBar sizeMb={snapshot.stats.db_size_mb} />
            <Freshness
              last={snapshot.stats.prediction_dates.last}
              now={snapshot.fetchedAt}
            />
            <TableCounts counts={snapshot.stats.table_counts} />
            <CostEstimate sizeMb={snapshot.stats.db_size_mb} />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StorageBar({ sizeMb }: { sizeMb: number }) {
  const status = storageStatus(sizeMb);
  const pct = Math.min((sizeMb / DB_CEILING_MB) * 100, 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">Tamaño de la base</span>
        <span className="flex items-baseline gap-2">
          <span className="font-mono text-sm font-semibold tabular-nums">
            {sizeMb.toFixed(1)} MB
          </span>
          <span className="text-[11px] text-muted-foreground">
            de {DB_CEILING_MB} MB
          </span>
          <span className={cn("text-[11px] font-medium", TONE_TEXT[status.tone])}>
            {status.label}
          </span>
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", TONE_BAR[status.tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Freshness({ last, now }: { last: string | null; now: number }) {
  if (!last) {
    return (
      <p className="text-xs text-muted-foreground">
        Sin predicciones registradas.
      </p>
    );
  }

  const minutesAgo = (now - toUTCDate(last).getTime()) / 60_000;
  const stale = minutesAgo > STALE_AFTER_MIN;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2",
        stale ? "border-risk-high/40 bg-risk-high/5" : "bg-muted/40",
      )}
    >
      {stale ? (
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-risk-high" />
      ) : (
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-risk-low" />
      )}
      <div className="min-w-0 text-xs">
        <p className={cn("font-medium", stale && "text-risk-high")}>
          {stale
            ? `Sin predicciones nuevas hace ${Math.round(minutesAgo)} min`
            : "Pipeline al día"}
        </p>
        <p className="text-muted-foreground">
          Última predicción: {fmtTime(last)} UTC
        </p>
      </div>
    </div>
  );
}

function TableCounts({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  if (entries.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {entries.map(([table, n]) => (
        <div key={table} className="rounded-md border px-2.5 py-2">
          <p className="truncate text-[11px] text-muted-foreground">
            {TABLE_LABELS[table] ?? table}
          </p>
          <p className="font-mono text-sm font-semibold tabular-nums">
            {n.toLocaleString("es-AR")}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * Sólo el almacenamiento es calculable con exactitud desde acá: GCS Standard
 * en us-central1 cuesta USD 0,020 por GB-mes. El costo de cómputo depende del
 * tráfico y no se puede derivar del tamaño de la base, así que no se inventa.
 */
function CostEstimate({ sizeMb }: { sizeMb: number }) {
  const storageUsd = (sizeMb / 1024) * 0.02;
  return (
    <p className="text-[11px] text-muted-foreground">
      Almacenamiento en GCS:{" "}
      <span className="font-mono">USD {storageUsd.toFixed(2)}</span>/mes
      {" · "}
      No incluye cómputo de Cloud Run, que depende del tráfico.
    </p>
  );
}
