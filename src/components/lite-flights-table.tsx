"use client";

import * as React from "react";
import { Lock, Search, X } from "lucide-react";
import { RiskBadge } from "@/components/risk-badge";
import { Input } from "@/components/ui/input";
import { fmtProba, fmtTime, toUTCDate, type Flight, type RiskLevel } from "@/lib/api";
import { cn } from "@/lib/utils";

type RiskFilter = "all" | RiskLevel;
type StatusTab = "all" | "upcoming" | "departed";

const RISK_CHIPS: { value: RiskFilter; label: string; color: string }[] = [
  { value: "all",    label: "Todos",       color: "" },
  { value: "high",   label: "Alto",        color: "text-red-600 dark:text-red-400 border-red-300 dark:border-red-800 data-[active=true]:bg-red-500/10" },
  { value: "medium", label: "Medio",       color: "text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800 data-[active=true]:bg-amber-500/10" },
  { value: "low",    label: "Bajo",        color: "text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 data-[active=true]:bg-emerald-500/10" },
];

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: "all",      label: "Todos" },
  { value: "upcoming", label: "Próximas salidas" },
  { value: "departed", label: "En vuelo / aterrizados" },
];

const RISK_BORDER: Record<RiskLevel, string> = {
  high:   "border-l-red-500",
  medium: "border-l-amber-400",
  low:    "border-l-emerald-500",
};

const RISK_BAR: Record<RiskLevel, string> = {
  high:   "bg-red-500",
  medium: "bg-amber-400",
  low:    "bg-emerald-500",
};

const PAGE_SIZE = 20;

export function LiteFlightsTable({ initialFlights }: { initialFlights: Flight[] }) {
  const [query, setQuery]   = React.useState("");
  const [risk, setRisk]     = React.useState<RiskFilter>("all");
  const [status, setStatus] = React.useState<StatusTab>("all");
  const [page, setPage]     = React.useState(0);

  const now = new Date();

  const filtered = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    return initialFlights.filter((f) => {
      if (risk !== "all" && f.risk !== risk) return false;
      if (status === "departed" && f.actual_out_utc === null) return false;
      if (status === "upcoming") {
        if (f.actual_out_utc !== null) return false;
        const est = f.estimated_out_utc || f.scheduled_out_utc;
        if (!est) return false;
        const mins = (toUTCDate(est).getTime() - now.getTime()) / 60_000;
        if (mins < -15 || mins > 45) return false;
      }
      if (q) {
        return (
          f.flight_number?.toLowerCase().includes(q) ||
          f.airline_code?.toLowerCase().includes(q) ||
          f.origin?.toLowerCase().includes(q) ||
          f.destination?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [initialFlights, query, risk, status]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function reset() { setPage(0); }

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Vuelo, aerolínea, ruta…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); reset(); }}
            className="pl-8 h-8 text-sm w-52"
          />
          {query && (
            <button onClick={() => { setQuery(""); reset(); }} className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-1.5">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => { setStatus(t.value); reset(); }}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs border transition-colors",
                status === t.value
                  ? "bg-primary/10 border-primary/40 text-primary font-medium"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5">
          {RISK_CHIPS.map((c) => (
            <button
              key={c.value}
              data-active={risk === c.value}
              onClick={() => { setRisk(c.value); reset(); }}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs border transition-colors",
                risk === c.value && c.value === "all"
                  ? "bg-primary/10 border-primary/40 text-primary font-medium"
                  : risk === c.value
                  ? c.color + " font-medium"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} vuelo{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Tabla */}
      <div className="rounded-lg border overflow-hidden">
        {paged.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Sin vuelos para los filtros seleccionados.
          </div>
        ) : (
          <div className="divide-y">
            {/* Header */}
            <div className="grid grid-cols-[1fr_1.5fr_1fr_120px] sm:grid-cols-[80px_1fr_1.5fr_1fr_120px] gap-3 px-4 py-2 bg-muted/40 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span className="hidden sm:block">Vuelo</span>
              <span>Ruta</span>
              <span className="hidden sm:block">Salida UTC</span>
              <span>Riesgo</span>
              <span className="text-right">Probabilidad</span>
            </div>

            {paged.map((f) => (
              <div
                key={f.fa_flight_id}
                title="Cambiá a modo Pro para ver historial y detalle completo"
                className={cn(
                  "grid grid-cols-[1fr_1.5fr_1fr_120px] sm:grid-cols-[80px_1fr_1.5fr_1fr_120px] gap-3 px-4 py-3 items-center border-l-2 transition-colors hover:bg-muted/30 cursor-default",
                  RISK_BORDER[f.risk],
                )}
              >
                <span className="hidden sm:block font-mono text-xs font-semibold">{f.flight_number}</span>
                <span className="text-sm font-medium">{f.origin} → {f.destination}</span>
                <span className="hidden sm:block text-xs text-muted-foreground">{fmtTime(f.scheduled_out_utc)}</span>
                <span><RiskBadge risk={f.risk} /></span>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-mono text-sm font-semibold">{fmtProba(f.delay_probability)}</span>
                  <div className="w-16 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", RISK_BAR[f.risk])}
                      style={{ width: `${Math.round(f.delay_probability * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-40 hover:text-foreground transition-colors px-2 py-1">
            ← Anterior
          </button>
          <span>Página {page + 1} de {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-40 hover:text-foreground transition-colors px-2 py-1">
            Siguiente →
          </button>
        </div>
      )}

      {/* CTA upgrade */}
      <div className="mt-6 rounded-lg border border-dashed p-5 flex items-center justify-between gap-4 bg-muted/20">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 size-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Lock className="size-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Más detalle en modo Pro</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Historial de predicciones, explicación de factores (SHAP),
              métricas del modelo y comparación real vs predicho.
            </p>
          </div>
        </div>
        <a
          href="/"
          className="shrink-0 text-xs font-medium px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Ir a modo Pro →
        </a>
      </div>
    </div>
  );
}
