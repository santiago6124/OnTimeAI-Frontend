"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowRight, Search, X } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { RiskBadge } from "@/components/risk-badge";
import { api, fmtTime, fmtProba, toUTCDate, type Flight, type RiskLevel } from "@/lib/api";
import { cn } from "@/lib/utils";

type RiskFilter = "all" | RiskLevel;

const CHIPS: { value: RiskFilter; label: string }[] = [
  { value: "all",    label: "Todos"  },
  { value: "high",   label: "Alto"   },
  { value: "medium", label: "Medio"  },
  { value: "low",    label: "Bajo"   },
];

const STATUS_TABS: { value: "all" | "upcoming" | "airborne" | "landed"; label: string }[] = [
  { value: "all",      label: "Todos los vuelos"      },
  { value: "upcoming", label: "Próximas salidas (45m)" },
  { value: "airborne", label: "En vuelo"               },
  { value: "landed",   label: "Aterrizados"            },
];

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i} className="hover:bg-transparent">
          <TableCell><div className="h-4 w-20 animate-pulse rounded bg-muted" /></TableCell>
          <TableCell className="hidden sm:table-cell">
            <div className="size-7 animate-pulse rounded bg-muted" />
          </TableCell>
          <TableCell><div className="h-4 w-32 animate-pulse rounded bg-muted" /></TableCell>
          <TableCell className="hidden md:table-cell">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </TableCell>
          <TableCell><div className="h-5 w-20 animate-pulse rounded bg-muted" /></TableCell>
          <TableCell><div className="h-5 w-20 animate-pulse rounded-full bg-muted" /></TableCell>
          <TableCell><div className="ml-auto h-4 w-14 animate-pulse rounded bg-muted" /></TableCell>
          <TableCell><div className="ml-auto size-7 animate-pulse rounded bg-muted" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function FlightsTable({
  onStatusTabChange,
  onRiskChange,
}: {
  onStatusTabChange?: (tab: "all" | "upcoming" | "airborne" | "landed") => void;
  onRiskChange?: (risk: RiskFilter) => void;
}) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const [flights,   setFlights]   = React.useState<Flight[]>([]);
  const [loading,   setLoading]   = React.useState(true);
  const [statusTab, setStatusTab] = React.useState<"all" | "upcoming" | "airborne" | "landed">(
    () => (searchParams.get("status") as "all" | "upcoming" | "airborne" | "landed") ?? "all",
  );
  const [q,    setQ]    = React.useState(() => searchParams.get("q")    ?? "");
  const [risk, setRisk] = React.useState<RiskFilter>(
    () => (searchParams.get("risk") as RiskFilter) ?? "all",
  );

  React.useEffect(() => {
    api.flights()
      .then(setFlights)
      .catch(() => setFlights([]))
      .finally(() => setLoading(false));
  }, []);

  // Sync filters → URL
  React.useEffect(() => {
    const params = new URLSearchParams();
    if (statusTab !== "all") params.set("status", statusTab);
    if (risk !== "all")      params.set("risk", risk);
    if (q.trim())            params.set("q",    q.trim());
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [statusTab, risk, q, router]);

  function matchesTab(f: Flight, now: Date): boolean {
    const isDeparted = f.actual_out_utc !== null || f.departure_delay_min !== null;
    const hasLanded  = f.has_actual;
    if (statusTab === "airborne") return isDeparted && !hasLanded;
    if (statusTab === "landed")   return hasLanded;
    if (statusTab === "upcoming") {
      if (isDeparted) return false;
      const estStr = f.estimated_out_utc || f.scheduled_out_utc;
      if (!estStr) return false;
      const diff = (toUTCDate(estStr).getTime() - now.getTime()) / 60000;
      return diff >= -15 && diff <= 45;
    }
    return true; // "all"
  }

  const counts = React.useMemo(() => {
    const now = new Date();
    const byStatus = flights.filter((f) => matchesTab(f, now));
    return {
      all:    byStatus.length,
      high:   byStatus.filter((f) => f.risk === "high").length,
      medium: byStatus.filter((f) => f.risk === "medium").length,
      low:    byStatus.filter((f) => f.risk === "low").length,
    };
  }, [flights, statusTab]);

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    const now  = new Date();
    return flights.filter((f) => {
      if (!matchesTab(f, now)) return false;
      if (risk !== "all" && f.risk !== risk) return false;
      if (!term) return true;
      return (
        f.flight_number.toLowerCase().includes(term) ||
        f.airline_code.toLowerCase().includes(term) ||
        f.destination.toLowerCase().includes(term) ||
        f.origin.toLowerCase().includes(term)
      );
    });
  }, [flights, q, risk, statusTab]);

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="flex border-b border-border">
        {STATUS_TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => { setStatusTab(value as "all" | "upcoming" | "airborne" | "landed"); onStatusTabChange?.(value as "all" | "upcoming" | "airborne" | "landed"); }}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              statusTab === value
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por vuelo, aerolínea o destino..."
            className="pl-9 pr-9"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {CHIPS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { setRisk(value); onRiskChange?.(value); }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                risk === value
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  risk === value ? "bg-white/20 text-inherit" : "bg-muted text-foreground",
                )}
              >
                {loading ? "—" : counts[value]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-[110px]">Vuelo</TableHead>
                <TableHead className="hidden w-[80px] sm:table-cell">Aero.</TableHead>
                <TableHead>Ruta</TableHead>
                <TableHead className="hidden w-[150px] md:table-cell">Salida UTC</TableHead>
                <TableHead className="hidden w-[150px] md:table-cell">Llegada UTC</TableHead>
                <TableHead className="w-[120px]">Estado</TableHead>
                <TableHead className="w-[120px]">Riesgo</TableHead>
                <TableHead className="w-[110px] text-right">Prob.</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton />
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9}>
                    <div className="flex flex-col items-center gap-1 py-12 text-sm text-muted-foreground">
                      <span>No se encontraron vuelos.</span>
                      <span className="text-xs">
                        Probá con otra búsqueda o limpiá los filtros.
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((f) => <FlightRow key={f.fa_flight_id} flight={f} />)
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        {loading ? "Cargando vuelos..." : `${filtered.length} de ${flights.length} vuelos`}
      </div>
    </div>
  );
}

function FlightRow({ flight: f }: { flight: Flight }) {
  const proba      = f.delay_probability;
  const isDeparted = f.actual_out_utc !== null || f.departure_delay_min !== null;

  return (
    <TableRow className="group">
      <TableCell className="font-mono text-sm font-medium">{f.flight_number}</TableCell>
      <TableCell className="hidden sm:table-cell">
        <span className="inline-flex size-7 items-center justify-center rounded bg-muted text-[11px] font-semibold">
          {f.airline_code}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-mono text-xs text-muted-foreground">{f.origin}</span>
          <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
          <span className="font-mono text-xs font-medium">{f.destination}</span>
        </div>
      </TableCell>

      {/* Salida UTC — muestra horario real o estimado si difiere */}
      <TableCell className="hidden md:table-cell">
        <div className="flex flex-col gap-0.5 font-mono text-sm">
          <span>{fmtTime(f.scheduled_out_utc)}</span>
          {f.actual_out_utc ? (
            <span className="text-[10px] leading-none text-muted-foreground">
              Real: {fmtTime(f.actual_out_utc)}
            </span>
          ) : f.estimated_out_utc && f.estimated_out_utc !== f.scheduled_out_utc ? (
            <span className="text-[10px] leading-none text-risk-medium">
              Est: {fmtTime(f.estimated_out_utc)}
            </span>
          ) : null}
        </div>
      </TableCell>

      {/* Llegada UTC — muestra estimado si difiere */}
      <TableCell className="hidden md:table-cell">
        <div className="flex flex-col gap-0.5 font-mono text-sm">
          <span>{fmtTime(f.scheduled_in_utc)}</span>
          {f.estimated_in_utc && f.estimated_in_utc !== f.scheduled_in_utc ? (
            <span className="text-[10px] leading-none text-muted-foreground">
              Est: {fmtTime(f.estimated_in_utc)}
            </span>
          ) : null}
        </div>
      </TableCell>

      {/* Estado */}
      <TableCell>
        {isDeparted ? (
          <span
            className={cn(
              "inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium",
              f.departure_delay_min && f.departure_delay_min > 15
                ? "border-risk-high/20 bg-risk-high/10 text-risk-high"
                : "border-risk-low/20 bg-risk-low/10 text-risk-low",
            )}
          >
            {f.departure_delay_min && f.departure_delay_min > 15
              ? `Salió +${Math.round(f.departure_delay_min)}m`
              : "Salió en hora"}
          </span>
        ) : (
          <span className="inline-flex items-center rounded border border-transparent bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            Programado
          </span>
        )}
      </TableCell>

      <TableCell>
        <RiskBadge risk={f.risk} />
      </TableCell>
      <TableCell
        className={cn(
          "text-right font-mono text-sm font-medium",
          proba >= 0.35 && "text-risk-high",
          proba >= 0.15 && proba < 0.35 && "text-risk-medium",
          proba < 0.15 && "text-risk-low",
        )}
      >
        {fmtProba(proba)}
      </TableCell>
      <TableCell className="text-right">
        <Link
          href={`/flights/${encodeURIComponent(f.fa_flight_id)}`}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon-sm" }),
            "opacity-0 transition-opacity group-hover:opacity-100",
          )}
          aria-label={`Ver detalle de ${f.flight_number}`}
        >
          <ArrowRight className="size-4" />
        </Link>
      </TableCell>
    </TableRow>
  );
}
