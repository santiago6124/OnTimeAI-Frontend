/**
 * Evolución de la calidad del modelo en el tiempo (Frontend #3).
 *
 * Hasta ahora `/metrics/model` daba un AUC de los últimos 7 días: un número
 * suelto que no dice si el modelo está mejorando, degradándose o quieto. La
 * serie diaria vive en `metrics_daily`, que sobrevive a la purga de 30 días de
 * las tablas crudas, así que esta página puede mirar hacia atrás mucho más de
 * lo que dura el dato crudo.
 *
 * Antes acá había un cartel de "Próximamente" desde abril, fuera del menú.
 */

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModelQualityChart } from "@/components/model-quality-chart";
import { ModelQualitySummary } from "@/components/model-quality-summary";
import { api, type ModelHistory } from "@/lib/api";
import {
  AUC_TEST, MINIMO_CONFIABLE, cambiosDeModelo, diasDescartados,
} from "@/lib/model-history";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  let historia: ModelHistory | null = null;
  try {
    historia = await api.modelHistory(56);
  } catch {
    historia = null;
  }

  const puntos = historia?.points ?? [];
  const descartados = diasDescartados(puntos);
  const cambios = cambiosDeModelo(puntos);
  const version = puntos.at(-1)?.model_version;

  return (
    <AppShell title="Evolución del modelo">
      <div className="space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Evolución del modelo
          </h1>
          <p className="text-sm text-muted-foreground">
            Cómo se comporta el modelo en producción, día a día
            {version ? ` · artefacto activo ${version}` : ""}.
          </p>
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

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Cómo leer estos gráficos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                <p>
                  La línea marcada es el promedio de siete días; los puntos
                  tenues son el valor de cada día. Un día suelto salta demasiado
                  para leer una tendencia.
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
                      <strong className="font-medium">
                        {descartados} de {puntos.length}
                      </strong>
                      .
                    </>
                  )}
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
