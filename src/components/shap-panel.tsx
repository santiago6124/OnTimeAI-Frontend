"use client";

import * as React from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ShapFactor } from "@/lib/api";
import { contributionShare, explainFactor } from "@/lib/shap-explain";
import { cn } from "@/lib/utils";

export function ShapPanel({
  factors,
  compact = false,
}: {
  factors: ShapFactor[];
  compact?: boolean;
}) {
  const [technical, setTechnical] = React.useState(false);

  const sorted = React.useMemo(
    () => [...factors].sort((a, b) => b.contribution - a.contribution),
    [factors],
  );

  const total = sorted.reduce((sum, f) => sum + f.contribution, 0);
  const risers = sorted.filter((f) => f.direction === "positive");
  const protectors = sorted.filter((f) => f.direction === "negative");
  const max = Math.max(...sorted.map((f) => f.contribution), 0.001);

  // El aporte dominante es el primero de la lista ya ordenada por magnitud.
  const main = sorted[0];
  const mainCopy = main
    ? explainFactor(main.feature, main.direction, main.value)
    : null;

  return (
    <Card>
      <CardHeader className={cn(compact && "pb-2")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-sm font-medium">
              ¿Por qué esta predicción?
            </CardTitle>
            {!compact ? (
              <CardDescription>
                Peso relativo de cada factor sobre la decisión del modelo, antes
                de calibración y ajustes operativos.
              </CardDescription>
            ) : null}
          </div>
          {sorted.length > 0 ? (
            <button
              type="button"
              onClick={() => setTechnical((t) => !t)}
              className="shrink-0 rounded-md border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              aria-pressed={technical}
            >
              {technical ? "Ver explicación" : "Ver nombres técnicos"}
            </button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {sorted.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No hay factores calculados para este vuelo.
          </div>
        ) : (
          <>
            {mainCopy && !technical ? (
              <div className="rounded-lg border bg-muted/40 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Causa principal
                </p>
                <p className="mt-0.5 text-sm">{mainCopy.sentence}</p>
              </div>
            ) : null}

            {risers.length > 0 ? (
              <FactorGroup
                heading="Factores que aumentan el riesgo"
                icon={<AlertTriangle className="size-3.5 text-risk-high" />}
                factors={risers}
                max={max}
                total={total}
                technical={technical}
              />
            ) : null}

            {protectors.length > 0 ? (
              <FactorGroup
                heading="Factores protectores"
                icon={<ShieldCheck className="size-3.5 text-risk-low" />}
                factors={protectors}
                max={max}
                total={total}
                technical={technical}
              />
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FactorGroup({
  heading,
  icon,
  factors,
  max,
  total,
  technical,
}: {
  heading: string;
  icon: React.ReactNode;
  factors: ShapFactor[];
  max: number;
  total: number;
  technical: boolean;
}) {
  return (
    <div className="space-y-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {heading}
      </p>
      {factors.map((f) => (
        <ShapRow
          key={f.feature}
          factor={f}
          max={max}
          total={total}
          technical={technical}
        />
      ))}
    </div>
  );
}

function ShapRow({
  factor,
  max,
  total,
  technical,
}: {
  factor: ShapFactor;
  max: number;
  total: number;
  technical: boolean;
}) {
  const width = Math.max((factor.contribution / max) * 100, 6);
  const isPositive = factor.direction === "positive";
  const share = contributionShare(factor.contribution, total);
  const copy = explainFactor(factor.feature, factor.direction, factor.value);

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="min-w-0 text-foreground">
          {technical ? (
            <span className="font-mono text-[11px]">{factor.feature}</span>
          ) : (
            copy.title
          )}
        </span>
        <span
          className={cn(
            "shrink-0 font-mono tabular-nums",
            isPositive ? "text-risk-high" : "text-risk-low",
          )}
        >
          {technical
            ? `${isPositive ? "+" : "−"}${factor.contribution.toFixed(3)} SHAP`
            : `${share.toFixed(0)}%`}
        </span>
      </div>

      {!technical ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {copy.sentence}
        </p>
      ) : factor.value && factor.value !== "NaN" ? (
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
