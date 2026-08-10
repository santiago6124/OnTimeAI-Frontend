"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowRight, RefreshCw, Search, X } from "lucide-react";

import { RiskBadge } from "@/components/risk-badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFlights } from "@/hooks/use-flights";
import { fmtProba, fmtTime, toUTCDate, type Flight, type RiskLevel } from "@/lib/api";
import { cn } from "@/lib/utils";

export type RiskFilter = "all" | RiskLevel;
export type StatusTab = "all" | "upcoming" | "departed";

const PAGE_SIZE = 25;

const CHIPS: { value: RiskFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "high", label: "Alto" },
  { value: "medium", label: "Medio" },
  { value: "low", label: "Bajo" },
];

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: "all", label: "Todos los vuelos" },
  { value: "upcoming", label: "Próximas salidas (45m)" },
  { value: "departed", label: "Ya despegaron" },
];

function validStatus(value: string | null): StatusTab {
  return value === "upcoming" || value === "departed" ? value : "all";
}

function validRisk(value: string | null): RiskFilter {
  return value === "low" || value === "medium" || value === "high" ? value : "all";
}

function matchesStatus(flight: Flight, status: StatusTab, now: Date): boolean {
  const departed = flight.actual_out_utc !== null || flight.departure_delay_min !== null;
  if (status === "departed") return departed;
  if (status !== "upcoming") return true;
  if (departed) return false;

  const estimated = flight.estimated_out_utc || flight.scheduled_out_utc;
  if (!estimated) return false;
  const minutes = (toUTCDate(estimated).getTime() - now.getTime()) / 60_000;
  return minutes >= -15 && minutes <= 45;
}

export function filterFlights(
  flights: Flight[],
  status: StatusTab,
  risk: RiskFilter,
  query: string,
  now = new Date(),
) {
  const term = query.trim().toLowerCase();
  return flights.filter((flight) => {
    if (!matchesStatus(flight, status, now)) return false;
    if (risk !== "all" && flight.risk !== risk) return false;
    if (!term) return true;
    return [flight.flight_number, flight.airline_code, flight.origin, flight.destination]
      .some((value) => value.toLowerCase().includes(term));
  });
}

export function FlightsTable() {
  const data = useFlights();
  return <FlightsTableView {...data} />;
}

export function FlightsTableView({
  flights,
  loading,
  isRefreshing = false,
  error = null,
  lastUpdated = null,
  reload,
  statusTab: controlledStatus,
  risk: controlledRisk,
  query: controlledQuery,
  onStatusTabChange,
  onRiskChange,
  onQueryChange,
}: {
  flights: Flight[];
  loading: boolean;
  isRefreshing?: boolean;
  error?: string | null;
  lastUpdated?: Date | null;
  reload?: () => void | Promise<void>;
  statusTab?: StatusTab;
  risk?: RiskFilter;
  query?: string;
  onStatusTabChange?: (tab: StatusTab) => void;
  onRiskChange?: (risk: RiskFilter) => void;
  onQueryChange?: (query: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [internalStatus, setInternalStatus] = React.useState<StatusTab>(() => validStatus(searchParams.get("status")));
  const [internalRisk, setInternalRisk] = React.useState<RiskFilter>(() => validRisk(searchParams.get("risk")));
  const [internalQuery, setInternalQuery] = React.useState(() => searchParams.get("q") ?? "");
  const [page, setPage] = React.useState(1);

  const status = controlledStatus ?? internalStatus;
  const risk = controlledRisk ?? internalRisk;
  const query = controlledQuery ?? internalQuery;
  const deferredQuery = React.useDeferredValue(query);

  React.useEffect(() => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (risk !== "all") params.set("risk", risk);
    if (deferredQuery.trim()) params.set("q", deferredQuery.trim());
    const next = params.toString();
    router.replace(`${pathname}${next ? `?${next}` : ""}`, { scroll: false });
  }, [deferredQuery, pathname, risk, router, status]);

  const counts = React.useMemo(() => {
    const byStatus = filterFlights(flights, status, "all", "");
    return {
      all: byStatus.length,
      high: byStatus.filter((flight) => flight.risk === "high").length,
      medium: byStatus.filter((flight) => flight.risk === "medium").length,
      low: byStatus.filter((flight) => flight.risk === "low").length,
    };
  }, [flights, status]);

  const filtered = React.useMemo(
    () => filterFlights(flights, status, risk, deferredQuery),
    [deferredQuery, flights, risk, status],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function changeStatus(next: StatusTab) {
    setPage(1);
    if (controlledStatus === undefined) setInternalStatus(next);
    onStatusTabChange?.(next);
  }

  function changeRisk(next: RiskFilter) {
    setPage(1);
    if (controlledRisk === undefined) setInternalRisk(next);
    onRiskChange?.(next);
  }

  function changeQuery(next: string) {
    setPage(1);
    if (controlledQuery === undefined) setInternalQuery(next);
    onQueryChange?.(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex overflow-x-auto border-b border-border" role="tablist" aria-label="Estado del vuelo">
        {STATUS_TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={status === value}
            onClick={() => changeStatus(value)}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4 sm:text-sm",
              status === value
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
          <label htmlFor="flight-search" className="sr-only">Buscar vuelos</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="flight-search"
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder="Buscar por vuelo, aerolínea, origen o destino..."
            className="pl-9 pr-9 text-base sm:text-sm"
          />
          {query ? (
            <button
              type="button"
              onClick={() => changeQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2" aria-label="Filtrar por riesgo">
          {CHIPS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={risk === value}
              onClick={() => changeRisk(value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                risk === value
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {label}
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                risk === value ? "bg-white/20 text-inherit" : "bg-muted text-foreground",
              )}>
                {loading ? "—" : counts[value]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm" role="alert">
          <span className="flex items-center gap-2"><AlertCircle className="size-4 text-destructive" />{error}</span>
          {reload ? (
            <button type="button" onClick={() => void reload()} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <RefreshCw className="size-3.5" /> Reintentar
            </button>
          ) : null}
        </div>
      ) : null}

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
                <TableHead className="w-[60px]"><span className="sr-only">Acciones</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton />
              ) : visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9}>
                    <div className="flex flex-col items-center gap-1 py-12 text-sm text-muted-foreground">
                      <span>{error ? "No se pudieron obtener los vuelos." : "No se encontraron vuelos."}</span>
                      {!error ? <span className="text-xs">Probá con otra búsqueda o limpiá los filtros.</span> : null}
                    </div>
                  </TableCell>
                </TableRow>
              ) : visible.map((flight) => <FlightRow key={flight.fa_flight_id} flight={flight} />)}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span aria-live="polite">
          {loading
            ? "Cargando vuelos..."
            : `${filtered.length} de ${flights.length} vuelos · página ${currentPage} de ${pageCount}`}
          {isRefreshing ? " · actualizando…" : ""}
          {!isRefreshing && lastUpdated
            ? ` · datos ${lastUpdated.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`
            : ""}
        </span>
        {pageCount > 1 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ArrowLeft className="size-3.5" /> Anterior
            </button>
            <button
              type="button"
              disabled={currentPage === pageCount}
              onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Siguiente <ArrowRight className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TableSkeleton() {
  return Array.from({ length: 8 }).map((_, index) => (
    <TableRow key={index} className="hover:bg-transparent">
      <TableCell><div className="h-4 w-20 animate-pulse rounded bg-muted" /></TableCell>
      <TableCell className="hidden sm:table-cell"><div className="size-7 animate-pulse rounded bg-muted" /></TableCell>
      <TableCell><div className="h-4 w-32 animate-pulse rounded bg-muted" /></TableCell>
      <TableCell className="hidden md:table-cell"><div className="h-4 w-24 animate-pulse rounded bg-muted" /></TableCell>
      <TableCell className="hidden md:table-cell"><div className="h-4 w-24 animate-pulse rounded bg-muted" /></TableCell>
      <TableCell><div className="h-5 w-20 animate-pulse rounded bg-muted" /></TableCell>
      <TableCell><div className="h-5 w-20 animate-pulse rounded-full bg-muted" /></TableCell>
      <TableCell><div className="ml-auto h-4 w-14 animate-pulse rounded bg-muted" /></TableCell>
      <TableCell><div className="ml-auto size-7 animate-pulse rounded bg-muted" /></TableCell>
    </TableRow>
  ));
}

function FlightRow({ flight }: { flight: Flight }) {
  const departed = flight.actual_out_utc !== null || flight.departure_delay_min !== null;
  const detailHref = `/flights/${encodeURIComponent(flight.fa_flight_id)}`;

  return (
    <TableRow className="group">
      <TableCell className="font-mono text-sm font-medium">
        <Link href={detailHref} className="rounded underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {flight.flight_number}
        </Link>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <span className="inline-flex size-7 items-center justify-center rounded bg-muted text-[11px] font-semibold">{flight.airline_code}</span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-mono text-xs text-muted-foreground">{flight.origin}</span>
          <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
          <span className="font-mono text-xs font-medium">{flight.destination}</span>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <div className="flex flex-col gap-0.5 font-mono text-sm">
          <span>{fmtTime(flight.scheduled_out_utc)}</span>
          {flight.actual_out_utc ? (
            <span className="text-[10px] leading-none text-muted-foreground">Real: {fmtTime(flight.actual_out_utc)}</span>
          ) : flight.estimated_out_utc && flight.estimated_out_utc !== flight.scheduled_out_utc ? (
            <span className="text-[10px] leading-none text-risk-medium">Est: {fmtTime(flight.estimated_out_utc)}</span>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <div className="flex flex-col gap-0.5 font-mono text-sm">
          <span>{fmtTime(flight.scheduled_in_utc)}</span>
          {flight.estimated_in_utc && flight.estimated_in_utc !== flight.scheduled_in_utc ? (
            <span className="text-[10px] leading-none text-muted-foreground">Est: {fmtTime(flight.estimated_in_utc)}</span>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        {departed ? (
          <span className={cn(
            "inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium",
            flight.departure_delay_min && flight.departure_delay_min > 15
              ? "border-risk-high/20 bg-risk-high/10 text-risk-high"
              : "border-risk-low/20 bg-risk-low/10 text-risk-low",
          )}>
            {flight.departure_delay_min && flight.departure_delay_min > 15
              ? `Salió +${Math.round(flight.departure_delay_min)}m`
              : "Salió en hora"}
          </span>
        ) : (
          <span className="inline-flex items-center rounded border border-transparent bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Programado</span>
        )}
      </TableCell>
      <TableCell><RiskBadge risk={flight.risk} /></TableCell>
      <TableCell className={cn(
        "text-right font-mono text-sm font-medium",
        flight.delay_probability >= 0.35 && "text-risk-high",
        flight.delay_probability >= 0.15 && flight.delay_probability < 0.35 && "text-risk-medium",
        flight.delay_probability < 0.15 && "text-risk-low",
      )}>
        {fmtProba(flight.delay_probability)}
      </TableCell>
      <TableCell className="text-right">
        <Link
          href={detailHref}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon-sm" }),
            "opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100 sm:opacity-50 sm:group-hover:opacity-100",
          )}
          aria-label={`Ver detalle de ${flight.flight_number}`}
        >
          <ArrowRight className="size-4" />
        </Link>
      </TableCell>
    </TableRow>
  );
}
