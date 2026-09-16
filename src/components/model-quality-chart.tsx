"use client";

/**
 * Evolución diaria de una métrica de calidad del modelo.
 *
 * El gráfico muestra dos cosas a la vez y no una: el valor de cada día, tenue,
 * y el promedio de siete días, marcado. El día suelto salta demasiado para leer
 * una tendencia; el promedio solo escondería que un día puntual se fue al
 * fondo.
 *
 * Los días que no llegan al mínimo de vuelos se dibujan huecos y quedan fuera
 * del promedio. Sin esa distinción, el 2026-08-18 —AUC 0.06 sobre 18 vuelos—
 * se lee como el día que el modelo colapsó, y lo que pasó es que no hubo con
 * qué medirlo.
 */

import {
  CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis,
} from "recharts";
import {
  ChartContainer, ChartTooltip, type ChartConfig,
} from "@/components/ui/chart";
import type { ModelHistoryPoint } from "@/lib/api";
import {
  MINIMO_CONFIABLE, VENTANA_DIAS, esConfiable, promedioMovil, type Metrica,
} from "@/lib/model-history";

const chartConfig = {
  diario: { label: "Día", color: "var(--chart-1)" },
  media: { label: `Promedio ${VENTANA_DIAS}d`, color: "var(--chart-1)" },
} satisfies ChartConfig;

type Fila = {
  day: string;
  etiqueta: string;
  diario: number | null;
  media: number | null;
  confiable: boolean;
  n_flights: number;
};

/** `2026-09-14` → `14/09`, el formato de fechas del resto de la app. */
function etiquetaDeDia(day: string): string {
  const [, mes, dia] = day.split("-");
  return `${dia}/${mes}`;
}

/**
 * Los días de muestra chica van huecos y en gris.
 *
 * Se dibujan igual en vez de omitirse: que falten días es información, y un
 * hueco en la línea no dice por qué está el hueco.
 */
function Punto(props: {
  cx?: number;
  cy?: number;
  payload?: Fila;
}) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || !payload) return null;
  if (payload.diario === null) return null;

  return payload.confiable ? (
    <circle cx={cx} cy={cy} r={2.5} fill="var(--color-diario)" fillOpacity={0.55} />
  ) : (
    <circle
      cx={cx}
      cy={cy}
      r={3}
      fill="var(--background)"
      stroke="var(--muted-foreground)"
      strokeWidth={1.5}
    />
  );
}

function Tooltip({ active, payload }: { active?: boolean; payload?: { payload: Fila }[] }) {
  if (!active || !payload?.length) return null;
  const fila = payload[0].payload;

  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{fila.etiqueta}</p>
      <dl className="mt-1 space-y-0.5 text-muted-foreground">
        <div className="flex gap-3">
          <dt>Día</dt>
          <dd className="ml-auto font-mono text-foreground tabular-nums">
            {fila.diario === null ? "—" : fila.diario.toFixed(3)}
          </dd>
        </div>
        <div className="flex gap-3">
          <dt>Promedio {VENTANA_DIAS}d</dt>
          <dd className="ml-auto font-mono text-foreground tabular-nums">
            {fila.media === null ? "—" : fila.media.toFixed(3)}
          </dd>
        </div>
        <div className="flex gap-3">
          <dt>Vuelos</dt>
          <dd className="ml-auto font-mono text-foreground tabular-nums">
            {fila.n_flights}
          </dd>
        </div>
      </dl>
      {!fila.confiable && (
        <p className="mt-1.5 max-w-[15rem] border-t border-border pt-1.5 text-[11px] leading-snug text-muted-foreground">
          Menos de {MINIMO_CONFIABLE} vuelos: no entra en el promedio.
        </p>
      )}
    </div>
  );
}

export function ModelQualityChart({
  puntos,
  metrica,
  referencia,
  etiquetaReferencia,
}: {
  puntos: ModelHistoryPoint[];
  metrica: Metrica;
  /** Línea horizontal de comparación, si la métrica tiene una. */
  referencia?: number;
  etiquetaReferencia?: string;
}) {
  const media = promedioMovil(puntos, metrica);
  const filas: Fila[] = puntos.map((p, i) => ({
    day: p.day,
    etiqueta: etiquetaDeDia(p.day),
    diario: p[metrica],
    media: media[i],
    confiable: esConfiable(p),
    n_flights: p.n_flights,
  }));

  const valores = filas
    .flatMap((f) => [f.diario, f.media])
    .filter((v): v is number => v !== null);
  if (referencia !== undefined) valores.push(referencia);

  if (valores.length === 0) {
    return (
      <p className="flex h-[240px] items-center justify-center text-xs text-muted-foreground">
        Todavía no hay días con datos suficientes.
      </p>
    );
  }

  // El dominio se ajusta a lo que hay, con aire arriba y abajo: fijarlo en
  // [0,1] aplastaría toda la variación real contra una línea plana.
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

        {referencia !== undefined && (
          <ReferenceLine
            y={referencia}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            strokeOpacity={0.6}
            label={{
              value: etiquetaReferencia,
              position: "insideTopRight",
              fontSize: 10,
              fill: "var(--muted-foreground)",
            }}
          />
        )}

        <ChartTooltip content={<Tooltip />} />

        {/* El día suelto, tenue: está para ver dispersión, no para seguirlo. */}
        <Line
          type="monotone"
          dataKey="diario"
          stroke="var(--color-diario)"
          strokeOpacity={0.3}
          strokeWidth={1}
          dot={<Punto />}
          activeDot={false}
          connectNulls
          isAnimationActive={false}
        />
        {/* El promedio, que es lo que de verdad hay que leer. */}
        <Line
          type="monotone"
          dataKey="media"
          stroke="var(--color-media)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
          connectNulls
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
