"use client";

/**
 * AUC antes de salir contra AUC en vuelo.
 *
 * Es la comparación que decide si el sistema sirve. Predecir con el avión
 * volando es fácil: media hora después se sabe solo, y el modelo ya vio el
 * retraso de salida. El valor está en acertar **antes de que salga**, que es
 * cuando todavía se puede hacer algo.
 *
 * Que la línea de en vuelo esté por encima es lo esperado. Lo que hay que mirar
 * es cuánta distancia hay: si es mucha, el modelo depende de información que
 * llega demasiado tarde para ser útil.
 *
 * Solo se dibujan los promedios de siete días. Superponer además los valores
 * diarios de dos series deja un enredo del que no se lee ninguna de las dos.
 */

import {
  CartesianGrid, Legend, Line, LineChart, XAxis, YAxis,
} from "recharts";
import {
  ChartContainer, ChartTooltip, type ChartConfig,
} from "@/components/ui/chart";
import type { ModelHistoryPoint } from "@/lib/api";
import { VENTANA_DIAS, promedioMovil } from "@/lib/model-history";

const chartConfig = {
  antes: { label: "Antes de salir", color: "var(--chart-1)" },
  enVuelo: { label: "En vuelo", color: "var(--chart-2)" },
} satisfies ChartConfig;

type Fila = {
  etiqueta: string;
  antes: number | null;
  enVuelo: number | null;
};

function etiquetaDeDia(day: string): string {
  const [, mes, dia] = day.split("-");
  return `${dia}/${mes}`;
}

function Tooltip({ active, payload }: { active?: boolean; payload?: { payload: Fila }[] }) {
  if (!active || !payload?.length) return null;
  const f = payload[0].payload;
  const brecha =
    f.antes !== null && f.enVuelo !== null ? f.enVuelo - f.antes : null;

  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{f.etiqueta}</p>
      <dl className="mt-1 space-y-0.5 text-muted-foreground">
        <div className="flex gap-4">
          <dt>Antes de salir</dt>
          <dd className="ml-auto font-mono text-foreground tabular-nums">
            {f.antes === null ? "—" : f.antes.toFixed(3)}
          </dd>
        </div>
        <div className="flex gap-4">
          <dt>En vuelo</dt>
          <dd className="ml-auto font-mono text-foreground tabular-nums">
            {f.enVuelo === null ? "—" : f.enVuelo.toFixed(3)}
          </dd>
        </div>
        {brecha !== null && (
          <div className="flex gap-4 border-t border-border pt-1">
            <dt>Ventaja de esperar</dt>
            <dd className="ml-auto font-mono text-foreground tabular-nums">
              {brecha > 0 ? "+" : ""}
              {brecha.toFixed(3)}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

export function ModelPhaseChart({
  antes,
  enVuelo,
}: {
  antes: ModelHistoryPoint[];
  enVuelo: ModelHistoryPoint[];
}) {
  // Las dos series pueden no cubrir los mismos días: un día sin vuelos
  // predichos antes de salir existe en una y no en la otra.
  const dias = [...new Set([...antes, ...enVuelo].map((p) => p.day))].sort();
  const mediaAntes = promedioMovil(antes, "auc");
  const mediaEnVuelo = promedioMovil(enVuelo, "auc");

  const porDia = (
    puntos: ModelHistoryPoint[],
    media: (number | null)[],
  ): Map<string, number | null> =>
    new Map(puntos.map((p, i) => [p.day, media[i]]));

  const mapaAntes = porDia(antes, mediaAntes);
  const mapaEnVuelo = porDia(enVuelo, mediaEnVuelo);

  const filas: Fila[] = dias.map((day) => ({
    etiqueta: etiquetaDeDia(day),
    antes: mapaAntes.get(day) ?? null,
    enVuelo: mapaEnVuelo.get(day) ?? null,
  }));

  const valores = filas
    .flatMap((f) => [f.antes, f.enVuelo])
    .filter((v): v is number => v !== null);

  if (valores.length === 0) {
    return (
      <p className="flex h-[240px] items-center justify-center px-6 text-center text-xs leading-relaxed text-muted-foreground">
        Todavía no hay días suficientes con las dos fases. El corte por fase se
        empezó a guardar hace poco; la comparación aparece cuando se acumule una
        semana.
      </p>
    );
  }

  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const aire = Math.max((max - min) * 0.15, 0.02);

  return (
    <ChartContainer config={chartConfig} className="h-[240px] w-full">
      <LineChart data={filas} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="etiqueta"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={11}
          minTickGap={24}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={11}
          width={44}
          domain={[
            Math.max(0, Number((min - aire).toFixed(3))),
            Number((max + aire).toFixed(3)),
          ]}
          tickFormatter={(v: number) => v.toFixed(2)}
        />
        <ChartTooltip content={<Tooltip />} />
        <Legend
          verticalAlign="top"
          height={28}
          iconType="plainline"
          wrapperStyle={{ fontSize: 11 }}
        />
        <Line
          type="monotone"
          name={`Antes de salir (prom. ${VENTANA_DIAS}d)`}
          dataKey="antes"
          stroke="var(--color-antes)"
          strokeWidth={2.5}
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          name={`En vuelo (prom. ${VENTANA_DIAS}d)`}
          dataKey="enVuelo"
          stroke="var(--color-enVuelo)"
          strokeWidth={2.5}
          strokeDasharray="5 3"
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
