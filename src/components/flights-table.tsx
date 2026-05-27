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
import { api, fmtTime, fmtProba, type Flight, type RiskLevel } from "@/lib/api";
import { cn } from "@/lib/utils";

type RiskFilter = "all" | RiskLevel;

const CHIPS: { value: RiskFilter; label: string }[] = [
  { value: "all",    label: "Todos"  },
  { value: "high",   label: "Alto"   },
  { value: "medium", label: "Medio"  },
  { value: "low",    label: "Bajo"   },
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
          <TableCell><div className="h-4 w-20 animate-pulse rounded bg-muted" /></TableCell>
          <TableCell><div className="h-5 w-20 animate-pulse rounded-full bg-muted" /></TableCell>
          <TableCell><div className="ml-auto h-4 w-14 animate-pulse rounded bg-muted" /></TableCell>
          <TableCell><div className="ml-auto size-7 animate-pulse rounded bg-muted" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

const STATUS_TABS = [
  { value: "all",      label: "Todos los vuelos" },
  { value: "upcoming", label: "Próximas Salidas (45m)" },
  { value: "departed", label: "Ya Despegaron" },
];

export function FlightsTable() {
  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();

  const [flights, setFlights] = React.useState<Flight[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusTab, setStatusTab] = React.useState<"all" | "upcoming" | "departed">(
    () => (searchParams.get("status") as any) ?? "all",
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

  React.useEffect(() => {
    const params = new URLSearchParams();
    if (statusTab !== "all") params.set("status", statusTab);
    if (risk !== "all")      params.set("risk", risk);
    if (q.trim())            params.set("q",    q.trim());
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [statusTab, risk, q, router]);

  const counts = React.useMemo(() => {
    const now = new Date();
    const statusFiltered = flights.filter((f) => {
      const isDeparted = f.actual_out_utc !== null || f.departure_delay_min !== null;
      if (statusTab === "departed") return isDeparted;
      if (statusTab === "upcoming") {
        if (isDeparted) return false;
        const estOutStr = f.estimated_out_utc || f.scheduled_out_utc;
        if (!estOutStr) return false;
        const estOut = new Date(estOutStr);
        const diffMinutes = (estOut.getTime() - now.getTime()) / (1000 * 60);
        return diffMinutes >= -15 && diffMinutes <= 45;
      }
      return true;
    });

    return {
      all:    statusFiltered.length,
      high:   statusFiltered.filter((f) => f.risk === "high").length,
      medium: statusFiltered.filter((f) => f.risk === "medium").length,
      low:    statusFiltered.filter((f) => f.risk === "low").length,
    };
  }, [flights, statusTab]);

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    const now = new Date();

    return flights.filter((f) => {
      // 1. Status Tab filter
      const isDeparted = f.actual_out_utc !== null || f.departure_delay_min !== null;
      if (statusTab === "departed") {
        if (!isDeparted) return false;
      } else if (statusTab === "upcoming") {
        if (isDeparted) return false;
        const estOutStr = f.estimated_out_utc || f.scheduled_out_utc;
        if (!estOutStr) return false;
        const estOut = new Date(estOutStr);
        const diffMinutes = (estOut.getTime() - now.getTime()) / (1000 * 60);
        if (diffMinutes < -15 || diffMinutes > 45) return false;
      }

      // 2. Risk filter
      if (risk !== "all" && f.risk !== risk) return false;

      // 3. Search query
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
      {/* Status Segmented Tabs */}
      <div className="flex border-b border-border pb-px">
        {STATUS_TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatusTab(value as any)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors -mb-[2px]",
              statusTab === value
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
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
              onClick={() => setRisk(value)}
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
                  risk === value
                    ? "bg-white/20 text-inherit"
                    : "bg-muted text-foreground",
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
  const proba = f.delay_probability;
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
      <TableCell className="hidden font-mono text-sm md:table-cell">
        <div className="flex flex-col gap-0.5">
          <span>{fmtTime(f.scheduled_out_utc)}</span>
          {f.actual_out_utc ? (
            <span className="text-[10px] text-muted-foreground leading-none">
              Real: {fmtTime(f.actual_out_utc)}
            </span>
          ) : f.estimated_out_utc && f.estimated_out_utc !== f.scheduled_out_utc ? (
            <span className="text-[10px] text-risk-medium leading-none">
              Est: {fmtTime(f.estimated_out_utc)}
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="hidden font-mono text-sm md:table-cell">
        <div className="flex flex-col gap-0.5">
          <span>{fmtTime(f.scheduled_in_utc)}</span>
          {f.estimated_in_utc && f.estimated_in_utc !== f.scheduled_in_utc ? (
            <span className="text-[10px] text-muted-foreground leading-none">
              Est: {fmtTime(f.estimated_in_utc)}
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        {isDeparted ? (
          <span className={cn(
            "inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium border",
            f.departure_delay_min && f.departure_delay_min > 15
              ? "bg-risk-high/10 text-risk-high border-risk-high/20"
              : "bg-risk-low/10 text-risk-low border-risk-low/20"
          )}>
            {f.departure_delay_min && f.departure_delay_min > 15
              ? `Salió +${Math.round(f.departure_delay_min)}m`
              : "Salió en hora"}
          </span>
        ) : (
          <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground border border-transparent">
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
