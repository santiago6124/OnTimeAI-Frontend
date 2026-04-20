"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";

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
import { MOCK_FLIGHTS, type Flight, type RiskLevel } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type RiskFilter = "all" | RiskLevel;

export function FlightsTable() {
  const [q, setQ] = React.useState("");
  const [risk, setRisk] = React.useState<RiskFilter>("all");

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return MOCK_FLIGHTS.filter((f) => {
      if (risk !== "all" && f.risk !== risk) return false;
      if (!term) return true;
      return (
        f.flightNumber.toLowerCase().includes(term) ||
        f.airline.toLowerCase().includes(term) ||
        f.destination.toLowerCase().includes(term) ||
        f.destinationName.toLowerCase().includes(term)
      );
    });
  }, [q, risk]);

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
              <TableHead>Aerolínea</TableHead>
              <TableHead>Ruta</TableHead>
              <TableHead className="w-[100px]">Salida</TableHead>
              <TableHead className="w-[80px]">Gate</TableHead>
              <TableHead className="w-[140px]">Riesgo</TableHead>
              <TableHead className="w-[120px] text-right">
                Prob. retraso
              </TableHead>
              <TableHead className="w-[100px] text-right">
                ETA retraso
              </TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <div className="flex flex-col items-center gap-1 py-10 text-sm text-muted-foreground">
                    <span>No se encontraron vuelos.</span>
                    <span className="text-xs">
                      Probá con otra búsqueda o limpiá los filtros.
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((f) => <FlightRow key={f.id} flight={f} />)
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground">
        Mostrando {filtered.length} de {MOCK_FLIGHTS.length} vuelos
      </div>
    </div>
  );
}

function FlightRow({ flight }: { flight: Flight }) {
  return (
    <TableRow className="group">
      <TableCell className="font-mono text-sm">{flight.flightNumber}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="inline-flex size-6 items-center justify-center rounded bg-muted text-[10px] font-semibold">
            {flight.airlineCode}
          </span>
          <span className="truncate text-sm">{flight.airline}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono text-xs text-muted-foreground">
            {flight.origin}
          </span>
          <ArrowRight className="size-3 text-muted-foreground" />
          <span className="font-mono">{flight.destination}</span>
          <span className="hidden text-xs text-muted-foreground md:inline">
            · {flight.destinationName}
          </span>
        </div>
      </TableCell>
      <TableCell className="font-mono text-sm">
        {flight.scheduledDeparture}
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {flight.gate}
      </TableCell>
      <TableCell>
        <RiskBadge risk={flight.risk} />
      </TableCell>
      <TableCell
        className={cn(
          "text-right font-mono text-sm",
          flight.delayProbability > 0.6 && "text-risk-high",
          flight.delayProbability > 0.35 &&
            flight.delayProbability <= 0.6 &&
            "text-risk-medium",
          flight.delayProbability <= 0.35 && "text-risk-low",
        )}
      >
        {Math.round(flight.delayProbability * 100)}%
      </TableCell>
      <TableCell className="text-right font-mono text-sm">
        +{flight.expectedDelayMinutes}m
      </TableCell>
      <TableCell className="text-right">
        <Link
          href={`/flights/${flight.id}`}
          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          aria-label={`Ver detalle de ${flight.flightNumber}`}
        >
          <ArrowRight className="size-4" />
        </Link>
      </TableCell>
    </TableRow>
  );
}
