import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_ROUTES } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function RoutesTable() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Histórico de puntualidad por ruta
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead>Ruta</TableHead>
              <TableHead className="w-[90px] text-right">Vuelos</TableHead>
              <TableHead className="w-[120px] text-right">On-time</TableHead>
              <TableHead className="w-[120px] text-right">Retraso avg</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MOCK_ROUTES.map((r) => (
              <TableRow key={r.route}>
                <TableCell className="font-mono text-sm">{r.route}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {r.flights}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono text-sm",
                    r.onTimeRate >= 0.75 && "text-risk-low",
                    r.onTimeRate >= 0.6 &&
                      r.onTimeRate < 0.75 &&
                      "text-risk-medium",
                    r.onTimeRate < 0.6 && "text-risk-high",
                  )}
                >
                  {Math.round(r.onTimeRate * 100)}%
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {r.avgDelay}m
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
