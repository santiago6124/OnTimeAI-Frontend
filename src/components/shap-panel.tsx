"use client";

import * as React from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ShapFactor } from "@/lib/api";
import { contributionShare, explainFactor } from "@/lib/shap-explain";
import { cn } from "@/lib/utils";
import { useSeccionAbierta } from "@/lib/secciones-abiertas";

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
                <p className="text-[11px] text-muted-foreground">
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

/**
 * Cuántos factores se muestran por grupo antes de colapsar.
 *
 * El backend guarda el top 15 y el panel los dibujaba todos. Medido sobre 25
 * vuelos de producción, eso son 15 filas por vuelo: 4 que suben el riesgo y 11
 * que protegen, y la cola pesa casi nada.
 *
 *     peso acumulado:  top 3  41%    top 4  49%    top 5  56%    top 8  75%
 *
 * Con cuatro por grupo, los que suben el riesgo casi nunca se truncan —son 4
 * de mediana— y los protectores bajan de 11 a 4. El resto sigue a un clic:
 * esconderlos del todo cambiaría lo que el panel afirma, y para una tesis la
 * lista completa tiene que poder verse.
 */
const FACTORES_VISIBLES = 4;

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
  // La clave sale del encabezado, que distingue los dos grupos y no cambia.
  const { abierto: expandido, alternar } = useSeccionAbierta(
    `factores:${heading}`,
    false,
  );
  const ocultos = Math.max(0, factors.length - FACTORES_VISIBLES);
  const visibles = expandido ? factors : factors.slice(0, FACTORES_VISIBLES);

  // Expandir hace dos cosas a la vez: muestra los factores que faltaban Y
  // detalla los que ya estaban. Colapsado cada factor es una línea con su
  // peso; abierto, cada uno explica por qué.
  return (
    <div className={cn("transition-all duration-200 motion-reduce:transition-none",
                       expandido ? "space-y-2.5" : "space-y-1.5")}>
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        {icon}
        {heading}
      </p>
      {visibles.map((f) => (
        <ShapRow
          key={f.feature}
          factor={f}
          max={max}
          total={total}
          technical={technical}
          detallado={expandido}
        />
      ))}
      {/* El botón aparece aunque no haya factores ocultos: expandir también
          muestra la frase que explica cada uno, y sin él un grupo de cuatro
          o menos se quedaba sin explicación y sin forma de pedirla. */}
      {factors.length > 0 ? (
        <button
          type="button"
          onClick={alternar}
          className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
        >
          {expandido
            ? "Ver menos"
            : ocultos > 0
              ? `Ver ${ocultos} más y el detalle`
              : "Ver el detalle"}
        </button>
      ) : null}
    </div>
  );
}

function ShapRow({
  factor,
  max,
  total,
  technical,
  detallado = false,
}: {
  /** Con `false` la fila es una línea: factor, peso y una barra fina. La frase
   *  que explica el factor sólo aparece al expandir el grupo. Dibujarlas
   *  siempre son tres bloques por factor y ocho factores a la vista. */
  detallado?: boolean;
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
    <div className={detallado ? "space-y-1" : "space-y-0.5"}>
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
            "shrink-0 tabular-nums",
            isPositive ? "text-risk-high" : "text-risk-low",
          )}
        >
          {technical
            ? `${isPositive ? "+" : "−"}${factor.contribution.toFixed(3)} SHAP`
            : `${share.toFixed(0)}%`}
        </span>
      </div>

      {/* El detalle crece desde cero con una transición de `grid-template-rows`:
          `height: auto` no es animable en CSS, y un `max-height` fijo recorta
          las frases largas o deja un salto al final. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          "motion-reduce:transition-none",
          detallado ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          {!technical ? (
            <p className="text-[11px] leading-snug text-muted-foreground">
              {copy.sentence}
            </p>
          ) : factor.value && factor.value !== "NaN" ? (
            <div className="text-[10px] text-muted-foreground">
              Valor observado:{" "}
              <span className="tabular-nums">{factor.value}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-full bg-muted",
          "transition-[height] duration-200 motion-reduce:transition-none",
          detallado ? "h-2" : "h-1",
        )}
      >
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
