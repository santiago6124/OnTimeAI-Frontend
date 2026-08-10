import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ShapFactor } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ShapPanel({
  factors,
  compact = false,
}: {
  factors: ShapFactor[];
  compact?: boolean;
}) {
  const sorted = [...factors].sort(
    (a, b) => b.contribution - a.contribution,
  );
  const max = Math.max(...sorted.map((f) => f.contribution), 0.001);

  return (
    <Card>
      <CardHeader className={cn(compact && "pb-2")}>
        <CardTitle className="text-sm font-medium">
          Factores del riesgo (SHAP)
        </CardTitle>
        {!compact ? (
          <CardDescription>
            Impacto sobre el score base del modelo, antes de calibración y ajustes
            operativos. Positivo aumenta el riesgo; negativo lo reduce.
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No hay factores calculados para este vuelo.
          </div>
        ) : (
          sorted.map((f) => (
            <ShapRow key={f.feature} factor={f} max={max} />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ShapRow({ factor, max }: { factor: ShapFactor; max: number }) {
  const width = Math.max((factor.contribution / max) * 100, 6);
  const isPositive = factor.direction === "positive";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-foreground">{factor.label}</span>
        <span
          className={cn(
            "font-mono tabular-nums",
            isPositive ? "text-risk-high" : "text-risk-low",
          )}
        >
          {isPositive ? "+" : "−"}
          {factor.contribution.toFixed(3)} SHAP
        </span>
      </div>
      {factor.value && factor.value !== "NaN" ? (
        <div className="text-[10px] text-muted-foreground">
          Valor observado: <span className="font-mono">{factor.value}</span>
        </div>
      ) : null}
      <div className="relative h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            isPositive ? "bg-risk-high/70" : "bg-risk-low/70",
          )}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
