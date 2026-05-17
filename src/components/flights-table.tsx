"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Search } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buttonVariants } from "@/components/ui/button";
import { RiskBadge } from "@/components/risk-badge";
import { api, fmtTime, fmtProba, type Flight, type RiskLevel } from "@/lib/api";
import { cn } from "@/lib/utils";

type RiskFilter = "all" | RiskLevel;

export function FlightsTable() {
  const [flights, setFlights] = React.useState<Flight[]>([]);
  const [loading, setLoading]  = React.useState(true);
  const [q,       setQ]        = React.useState("");
  const [risk,    setRisk]     = React.useState<RiskFilter>("all");

  React.useEffect(() => {
    api.flights()
      .then(setFlights)
      .catch(() => setFlights([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return flights.filter((f) => {
      if (risk !== "all" && f.risk !== risk) return false;
      if (!term) return true;
      return (
        f.flight_number.toLowerCase().includes(term) ||
        f.airline_code.toLowerCase().includes(term) ||
        f.destination.toLowerCase().includes(term) ||
        f.origin.toLowerCase().includes(term)
      );
    });
  }, [flights, q, risk]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por vuelo, aerolínea o destino..."
            className="pl-9"
          />
        </div>
        <Select value={risk} onValueChange={(v) => setRisk(v as RiskFilter)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filtrar por riesgo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los riesgos</SelectItem>
            <SelectItem value="high">Solo alto</SelectItem>
            <SelectItem value="medium">Solo medio</SelectItem>
            <SelectItem value="low">Solo bajo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[110px]">Vuelo</TableHead>
              <TableHead className="w-[80px]">Aero.</TableHead>
              <TableHead>Ruta</TableHead>
              <TableHead className="w-[90px]">Salida UTC</TableHead>
              <TableHead className="w-[90px]">Llegada UTC</TableHead>
              <TableHead className="w-[120px]">Riesgo</TableHead>
              <TableHead className="w-[110px] text-right">Prob. retraso</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Cargando predicciones...
                  </div>
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <div className="flex flex-col items-center gap-1 py-10 text-sm text-muted-foreground">
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

      <div className="text-xs text-muted-foreground">
        {loading ? "Cargando..." : `Mostrando ${filtered.length} de ${flights.length} vuelos`}
      </div>
    </div>
  );
}

function FlightRow({ flight: f }: { flight: Flight }) {
  const proba = f.delay_probability;
  return (
    <TableRow className="group">
      <TableCell className="font-mono text-sm">{f.flight_number}</TableCell>
      <TableCell>
        <span className="inline-flex size-7 items-center justify-center rounded bg-muted text-[11px] font-semibold">
          {f.airline_code}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono text-xs text-muted-foreground">{f.origin}</span>
          <ArrowRight className="size-3 text-muted-foreground" />
          <span className="font-mono">{f.destination}</span>
        </div>
      </TableCell>
      <TableCell className="font-mono text-sm">{fmtTime(f.scheduled_out_utc)}</TableCell>
      <TableCell className="font-mono text-sm">{fmtTime(f.scheduled_in_utc)}</TableCell>
      <TableCell>
        <RiskBadge risk={f.risk} />
      </TableCell>
      <TableCell
        className={cn(
          "text-right font-mono text-sm",
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
          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          aria-label={`Ver detalle de ${f.flight_number}`}
        >
          <ArrowRight className="size-4" />
        </Link>
      </TableCell>
    </TableRow>
  );
}
