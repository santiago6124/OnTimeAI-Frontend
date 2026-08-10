"use client";

import { useState } from "react";

import { PredictionHistoryChart } from "@/components/prediction-history-chart";
import { ShapPanel } from "@/components/shap-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtProba, fmtTime, type PredictionPoint } from "@/lib/api";

const PHASE_LABELS: Record<PredictionPoint["prediction_phase"], string> = {
  PRE_DEPARTURE: "Antes de la salida",
  EN_ROUTE: "En vuelo",
  POST_LANDING: "Vuelo finalizado",
};

export function PredictionEvolution({
  history,
  arrDelayMin,
}: {
  history: PredictionPoint[];
  arrDelayMin?: number | null;
}) {
  const latest = history.at(-1);
  const [selectedAt, setSelectedAt] = useState(latest?.predicted_at_utc ?? "");
  const matchedIndex = history.findIndex((cycle) => cycle.predicted_at_utc === selectedAt);
  const selectedIndex = matchedIndex >= 0 ? matchedIndex : Math.max(history.length - 1, 0);
  const selected = history[selectedIndex] ?? latest;
  const previous = selectedIndex > 0 ? history[selectedIndex - 1] : null;

  if (!selected) {
    return <PredictionHistoryChart history={history} arrDelayMin={arrDelayMin} />;
  }

  const delta = previous
    ? selected.delay_probability - previous.delay_probability
    : null;

  return (
    <div className="space-y-4">
      <PredictionHistoryChart
        history={history}
        arrDelayMin={arrDelayMin}
        selectedAt={selected.predicted_at_utc}
        onSelect={setSelectedAt}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(240px,0.75fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Ciclo seleccionado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <CycleValue label="Momento" value={`${fmtTime(selected.predicted_at_utc)} UTC`} mono />
            <CycleValue label="Fase" value={PHASE_LABELS[selected.prediction_phase]} />
            <CycleValue label="Probabilidad base calibrada" value={fmtProba(selected.base_probability)} mono />
            <CycleValue label="Probabilidad final" value={fmtProba(selected.delay_probability)} mono emphasis />
            <CycleValue
              label="Ajuste operativo"
              value={`${selected.operational_adjustment >= 0 ? "+" : ""}${(
                selected.operational_adjustment * 100
              ).toFixed(1)} pp`}
              mono
            />
            <CycleValue
              label="Cambio vs. ciclo anterior"
              value={
                delta === null
                  ? "Primer ciclo"
                  : `${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(1)} pp`
              }
              mono={delta !== null}
            />
            <CycleValue
              label="Umbral usado"
              value={selected.threshold_used === null ? "No registrado" : fmtProba(selected.threshold_used)}
              mono={selected.threshold_used !== null}
            />
            <CycleValue
              label="Estrategia de umbral"
              value={selected.threshold_strategy?.replaceAll("_", " ") ?? "No registrada"}
            />
          </CardContent>
        </Card>

        <ShapPanel factors={selected.shap} />
      </div>
    </div>
  );
}

function CycleValue({
  label,
  value,
  mono = false,
  emphasis = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-2 last:border-0 last:pb-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`${mono ? "font-mono" : ""} ${emphasis ? "font-semibold" : ""} text-right text-xs`}>
        {value}
      </span>
    </div>
  );
}
