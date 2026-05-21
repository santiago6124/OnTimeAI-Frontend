"use client";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import type { RouteMetric } from "@/lib/api";
import { cn } from "@/lib/utils";

interface RoutesTableProps {
  routes: RouteMetric[];
  loading?: boolean;
  selectedRoute?: string;
  onRouteSelect?: (origin: string, dest: string) => void;
}

export function RoutesTable({ routes, loading, selectedRoute, onRouteSelect }: RoutesTableProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Puntualidad histórica por ruta
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Cargando rutas...
          </div>
        ) : routes.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Sin datos históricos disponibles aún. Los datos se acumulan a medida que los vuelos aterrizan.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>Ruta</TableHead>
                <TableHead className="w-[90px] text-right">Vuelos</TableHead>
                <TableHead className="w-[120px] text-right">On-time</TableHead>
                <TableHead className="w-[130px] text-right">Retraso avg</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.map((r) => (
                <TableRow
                  key={r.route}
                  onClick={() => onRouteSelect?.(r.origin, r.dest)}
                  className={cn(
                    onRouteSelect && "cursor-pointer",
                    selectedRoute === r.route && "bg-muted/50",
                  )}
                >
                  <TableCell className="font-mono text-sm">{r.route}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{r.total_flights}</TableCell>
                  <TableCell className={cn(
                    "text-right font-mono text-sm",
                    r.on_time_rate >= 0.75 && "text-risk-low",
                    r.on_time_rate >= 0.6 && r.on_time_rate < 0.75 && "text-risk-medium",
                    r.on_time_rate < 0.6 && "text-risk-high",
                  )}>
                    {Math.round(r.on_time_rate * 100)}%
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">
                    {Math.round(r.avg_delay_min)} min
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
