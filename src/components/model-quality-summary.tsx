/**
 * Las tres cifras que resumen si el modelo está mejorando o degradándose.
 *
 * El orden no es decorativo: primero si ordena bien (AUC), después si sus
 * números son honestos (ECE), y al final cuánto material hubo para medir. Las
 * dos primeras no significan nada sin la tercera.
 *
 * La flecha sale de `tendencia()` y no de comparar el signo acá: el ECE mejora
 * bajando, y esa inversión mal puesta pintaría de verde una calibración que
 * empeoró.
 */

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ModelHistoryPoint } from "@/lib/api";
import {
  VENTANA_DIAS, compararPeriodos, esConfiable, tendencia, type Metrica,
} from "@/lib/model-history";

const COLOR: Record<string, string> = {
  mejor: "text-risk-low",
  peor: "text-risk-high",
  igual: "text-muted-foreground",
  "sin-datos": "text-muted-foreground",
};

function Delta({ metrica, delta }: { metrica: Metrica; delta: number | null }) {
  const dir = tendencia(metrica, delta);
  if (dir === "sin-datos") {
    return (
      <span className="text-xs text-muted-foreground">
        sin semana previa para comparar
      </span>
    );
  }

  const Icono = dir === "igual" ? Minus : delta! > 0 ? ArrowUpRight : ArrowDownRight;
  const signo = delta! > 0 ? "+" : "";

  return (
    <span className={`flex items-center gap-1 text-xs ${COLOR[dir]}`}>
      <Icono className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="font-mono tabular-nums">
        {signo}
        {delta!.toFixed(3)}
      </span>
      <span className="text-muted-foreground">vs. semana previa</span>
    </span>
  );
}

function Cifra({
  etiqueta,
  explicacion,
  valor,
  children,
}: {
  etiqueta: string;
  explicacion: string;
  valor: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{etiqueta}</p>
        <p className="font-mono text-2xl font-semibold tabular-nums">{valor}</p>
        {children}
        <p className="pt-1 text-xs leading-snug text-muted-foreground">
          {explicacion}
        </p>
      </CardContent>
    </Card>
  );
}

export function ModelQualitySummary({ puntos }: { puntos: ModelHistoryPoint[] }) {
  const auc = compararPeriodos(puntos, "auc");
  const ece = compararPeriodos(puntos, "ece");

  const confiables = puntos.filter(esConfiable);
  const vuelosPorDia =
    confiables.length > 0
      ? Math.round(
          confiables.reduce((s, p) => s + p.n_flights, 0) / confiables.length,
        )
      : null;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Cifra
        etiqueta="Discriminación (AUC)"
        valor={auc ? auc.actual.toFixed(3) : "—"}
        explicacion="Qué tan bien separa los vuelos que se demoran de los que no. Sube cuando mejora."
      >
        {auc && <Delta metrica="auc" delta={auc.delta} />}
      </Cifra>

      <Cifra
        etiqueta="Calibración (ECE)"
        valor={ece ? ece.actual.toFixed(3) : "—"}
        explicacion="Cuánto se aleja la probabilidad que dice de la que ocurre. Baja cuando mejora."
      >
        {ece && <Delta metrica="ece" delta={ece.delta} />}
      </Cifra>

      <Cifra
        etiqueta="Material para medir"
        valor={vuelosPorDia === null ? "—" : String(vuelosPorDia)}
        explicacion={`Vuelos aterrizados por día, promedio de los ${confiables.length} días que alcanzan el mínimo.`}
      >
        <span className="text-xs text-muted-foreground">
          media de {VENTANA_DIAS} días en las otras dos cifras
        </span>
      </Cifra>
    </div>
  );
}
