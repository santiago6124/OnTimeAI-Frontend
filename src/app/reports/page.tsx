/**
 * Evolución de la calidad del modelo en el tiempo (Frontend #3).
 *
 * Hasta ahora `/metrics/model` daba un AUC de los últimos 7 días: un número
 * suelto que no dice si el modelo está mejorando, degradándose o quieto. La
 * serie diaria vive en `metrics_daily`, que sobrevive a la purga de 30 días de
 * las tablas crudas, así que esta página mira mucho más atrás que el dato crudo.
 *
 * El período va en la URL y no en estado local: así la página sigue siendo un
 * server component —los datos llegan renderizados, sin parpadeo— y un enlace a
 * "las últimas 12 semanas" se puede compartir.
 */

import { redirect } from "next/navigation";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModelQualityChart } from "@/components/model-quality-chart";
import { ModelQualitySummary } from "@/components/model-quality-summary";
import { ModelPhaseChart } from "@/components/model-phase-chart";
import { MetricBreakdownTable } from "@/components/metric-breakdown-table";
import { getServerRole } from "@/lib/server-auth";
import { api, type Breakdown, type ModelHistory } from "@/lib/api";
import {
  AUC_TEST, MINIMO_CONFIABLE, PERIODOS_SEMANAS, cambiosDeModelo,
  diasDescartados, semanasPedidas,
} from "@/lib/model-history";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** `14` → `14:00`, para que la tabla por hora se lea como una hora. */
function comoHora(key: string): string {
  return `${key.padStart(2, "0")}:00`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  // El issue pide que sea visible para admin y superadmin, y oculta para user.
  // Se decide acá y no solo en el menú: el menú no protege una URL escrita a
  // mano.
  const role = await getServerRole();
  if (role !== "admin" && role !== "superadmin") redirect("/");

  const semanas = semanasPedidas((await searchParams).weeks);
  const dias = semanas * 7;

  // En paralelo: son cinco consultas independientes contra la misma tabla.
  const [historia, antes, enVuelo, porAerolinea, porHora] = await Promise.all([
    api.modelHistory(dias).catch(() => null),
    api.modelHistory(dias, "phase:PRE_DEPARTURE").catch(() => null),
    api.modelHistory(dias, "phase:EN_ROUTE").catch(() => null),
    api.modelBreakdown("carrier", dias).catch(() => null),
    api.modelBreakdown("hour", dias).catch(() => null),
  ]) as [
    ModelHistory | null, ModelHistory | null, ModelHistory | null,
    Breakdown | null, Breakdown | null,
  ];

  const puntos = historia?.points ?? [];
  const descartados = diasDescartados(puntos);
  const cambios = cambiosDeModelo(puntos);
  const version = puntos.at(-1)?.model_version;

  return (
    <AppShell title="Evolución del modelo">
      <div className="space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Evolución del modelo
            </h1>
            <p className="text-sm text-muted-foreground">
              Cómo se comporta el modelo en producción, día a día
              {version ? ` · artefacto activo ${version}` : ""}.
            </p>
          </div>

          <nav aria-label="Período" className="flex items-center gap-1">
            {PERIODOS_SEMANAS.map((p) => (
              <Link
                key={p}
                href={`/reports?weeks=${p}`}
                aria-current={p === semanas ? "page" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs transition-colors",
                  p === semanas
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {p} sem
              </Link>
            ))}
          </nav>
        </header>

        {historia === null ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No se pudo cargar el historial del modelo.
            </CardContent>
          </Card>
        ) : puntos.length === 0 ? (
          <Card>
            <CardContent className="space-y-2 py-8 text-center text-sm text-muted-foreground">
              <p>Todavía no hay días consolidados.</p>
              <p className="text-xs">
                El agregado diario lo escribe el job antes de purgar; la serie
                aparece cuando pase el primer cierre.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <ModelQualitySummary puntos={puntos} />

            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <CardTitle className="text-sm font-medium">
                    Discriminación — AUC diario
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    la línea de puntos es el AUC sobre el set de test
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <ModelQualityChart
                  puntos={puntos}
                  metrica="auc"
                  referencia={AUC_TEST}
                  etiquetaReferencia={`test ${AUC_TEST}`}
                />
                <p className="pt-3 text-xs leading-relaxed text-muted-foreground">
                  La distancia contra la línea de test es el costo de predecir
                  sobre vuelos reales en vez de sobre datos históricos: el
                  modelo entrenó con BTS 2021-2024 y acá enfrenta el tráfico de
                  hoy.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Antes de salir contra en vuelo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ModelPhaseChart
                  antes={antes?.points ?? []}
                  enVuelo={enVuelo?.points ?? []}
                />
                <p className="pt-3 text-xs leading-relaxed text-muted-foreground">
                  Predecir con el avión volando es fácil: media hora después se
                  sabe solo. El valor está en acertar antes de que salga, que es
                  cuando todavía se puede hacer algo. Que la línea de en vuelo
                  esté arriba es lo esperado; lo que importa es cuánta distancia
                  hay.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Calibración — ECE diario
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ModelQualityChart puntos={puntos} metrica="ece" />
                <p className="pt-3 text-xs leading-relaxed text-muted-foreground">
                  Mide cuánto se aleja la probabilidad que el modelo dice de la
                  que efectivamente ocurre. Baja cuando mejora: un ECE de 0.20
                  significa que cuando dice 60% pasa cerca del 40%.
                </p>
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Por aerolínea
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <MetricBreakdownTable
                    filas={porAerolinea?.rows ?? []}
                    etiquetaClave="Aerolínea"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Por hora de salida (UTC)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <MetricBreakdownTable
                    filas={porHora?.rows ?? []}
                    etiquetaClave="Hora"
                    formatearClave={comoHora}
                    maximo={24}
                  />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Cómo leer estos números
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                <p>
                  En los gráficos, la línea marcada es el promedio de siete días
                  y los puntos tenues son el valor de cada día. Un día suelto
                  salta demasiado para leer una tendencia.
                </p>
                <p>
                  Los puntos <strong className="font-medium">huecos</strong> son
                  días con menos de {MINIMO_CONFIABLE} vuelos aterrizados, casi
                  siempre porque el pipeline corrió a medias. Quedan fuera del
                  promedio: con esa muestra el AUC se mueve décimas por un
                  puñado de casos.
                  {descartados > 0 && (
                    <>
                      {" "}
                      En esta serie hay{" "}
                      <strong className="font-medium">{`${descartados} de ${puntos.length}`}</strong>.
                    </>
                  )}
                </p>
                <p>
                  En las tablas, la <strong className="font-medium">accuracy</strong>{" "}
                  engaña sola: con ~20% de retrasos reales, un modelo que no
                  marque nunca nada acierta el 80%. Por eso al lado está la tasa
                  real de retraso, que es contra la que hay que leerla.
                </p>
                {cambios.length > 0 && (
                  <p>
                    Cambió el artefacto activo en{" "}
                    {cambios.map((c) => c.day).join(", ")}. Un salto que coincide
                    con esas fechas es el modelo nuevo, no deriva.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
