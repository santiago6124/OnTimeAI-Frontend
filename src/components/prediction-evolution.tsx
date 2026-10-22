"use client";

import { useState } from "react";

import { PredictionHistoryChart } from "@/components/prediction-history-chart";
import { ShapPanel } from "@/components/shap-panel";
import { BotonColapsar } from "@/components/ui/seccion-colapsable";
import { useSeccionAbierta } from "@/lib/secciones-abiertas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtProba, fmtTime, type PredictionPoint } from "@/lib/api";

const PHASE_LABELS: Record<PredictionPoint["prediction_phase"], string> = {
  PRE_DEPARTURE: "Antes de la salida",
  EN_ROUTE: "En vuelo",
  POST_LANDING: "Vuelo finalizado",
};

// eslint-disable-next-line complexity -- deuda registrada en .complejidad-baseline.json
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
        <CicloSeleccionado
          compacto={
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <DatoCiclo etiqueta="Momento" valor={fmtTime(selected.predicted_at_utc)} />
              <DatoCiclo etiqueta="Fase" valor={PHASE_LABELS[selected.prediction_phase]} />
              <DatoCiclo etiqueta="Base" valor={fmtProba(selected.base_probability)} />
              <DatoCiclo etiqueta="Final" valor={fmtProba(selected.delay_probability)} fuerte />
              <DatoCiclo
                etiqueta="Ajuste"
                valor={`${selected.operational_adjustment >= 0 ? "+" : ""}${(
                  selected.operational_adjustment * 100
                ).toFixed(1)} pp`}
              />
              <DatoCiclo
                etiqueta="Cambio"
                valor={
                  delta === null
                    ? "Primer ciclo"
                    : `${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(1)} pp`
                }
              />
              <DatoCiclo
                etiqueta="Umbral"
                valor={
                  selected.threshold_used === null
                    ? "—"
                    : fmtProba(selected.threshold_used)
                }
              />
              <DatoCiclo
                etiqueta="Estrategia"
                valor={selected.threshold_strategy?.replaceAll("_", " ") ?? "—"}
              />
            </div>
          }
          detallado={
            <>
            <CycleValue label="Momento" value={`${fmtTime(selected.predicted_at_utc)} UTC`} numero />
            <CycleValue label="Fase" value={PHASE_LABELS[selected.prediction_phase]} />
            <CycleValue label="Probabilidad base calibrada" value={fmtProba(selected.base_probability)} numero />
            <CycleValue label="Probabilidad final" value={fmtProba(selected.delay_probability)} numero emphasis />
            <CycleValue
              label="Ajuste operativo"
              value={`${selected.operational_adjustment >= 0 ? "+" : ""}${(
                selected.operational_adjustment * 100
              ).toFixed(1)} pp`}
              numero
            />
            <CycleValue
              label="Cambio vs. ciclo anterior"
              value={
                delta === null
                  ? "Primer ciclo"
                  : `${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(1)} pp`
              }
              numero={delta !== null}
            />
            <CycleValue
              label="Umbral usado"
              value={selected.threshold_used === null ? "No registrado" : fmtProba(selected.threshold_used)}
              numero={selected.threshold_used !== null}
            />
            <CycleValue
              label="Estrategia de umbral"
              value={selected.threshold_strategy?.replaceAll("_", " ") ?? "No registrada"}
            />
            </>
          }
        />

        <ShapPanel factors={selected.shap} />
      </div>
    </div>
  );
}

function CycleValue({
  label,
  value,
  numero = false,
  emphasis = false,
}: {
  label: string;
  value: string;
  /**
   * Los valores de esta tarjeta son todos cifras —horarios, probabilidades,
   * puntos porcentuales—, nunca identificadores. Antes iban en la familia
   * monoespaciada, que es la de los códigos; lo que hace falta acá es que los
   * dígitos se alineen en columna, y eso lo da `tabular-nums` sin cambiar de
   * familia tipográfica.
   */
  numero?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-2 last:border-0 last:pb-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`${numero ? "tabular-nums" : ""} ${emphasis ? "font-semibold" : ""} text-right text-xs`}>
        {value}
      </span>
    </div>
  );
}


/**
 * El detalle del ciclo elegido, cerrado por omisión.
 *
 * Son siete filas —momento, fase, probabilidad base, final, ajuste operativo,
 * cambio contra el ciclo anterior, umbral y estrategia— y casi siempre lo que
 * se mira es la probabilidad, que queda en el resumen. Abierto está todo.
 */
function CicloSeleccionado({
  compacto,
  detallado,
}: {
  compacto: React.ReactNode;
  detallado: React.ReactNode;
}) {
  const { abierto, alternar } = useSeccionAbierta("ciclo-seleccionado", false);
  return (
    <Card>
      <CardHeader className="pb-3">
        <BotonColapsar
          abierto={abierto}
          onToggle={alternar}
          titulo={
            <CardTitle className="text-sm font-medium">
              Ciclo seleccionado
            </CardTitle>
          }
        />
      </CardHeader>
      <CardContent className={abierto ? "space-y-3 text-sm" : "pb-4"}>
        {abierto ? detallado : compacto}
      </CardContent>
    </Card>
  );
}

/** Un valor del ciclo en su forma apretada. */
function DatoCiclo({
  etiqueta,
  valor,
  fuerte = false,
}: {
  etiqueta: string;
  valor: React.ReactNode;
  fuerte?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{etiqueta}</p>
      <div className={fuerte ? "font-semibold tabular-nums" : "tabular-nums"}>
        {valor}
      </div>
    </div>
  );
}
