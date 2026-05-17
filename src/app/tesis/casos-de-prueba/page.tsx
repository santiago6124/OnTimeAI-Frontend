"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Plane,
  BarChart3,
  Timer,
  ArrowRight,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  type TestCasesResponse,
  type CP01Result,
  type CP02Result,
  type ShapFactor,
  BASE_URL,
  fmtProba,
  fmtTime,
} from "@/lib/api";

// ── helpers ────────────────────────────────────────────────────────────────

function PassBadge({ passed }: { passed: boolean }) {
  return passed ? (
    <Badge className="gap-1 bg-green-600 hover:bg-green-600 text-white">
      <CheckCircle2 className="size-3" /> PASS
    </Badge>
  ) : (
    <Badge className="gap-1 bg-destructive hover:bg-destructive text-white">
      <XCircle className="size-3" /> FAIL
    </Badge>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

// ── SHAP bar chart ────────────────────────────────────────────────────────

function ShapChart({ factors }: { factors: ShapFactor[] }) {
  const max = Math.max(...factors.map((f) => f.contribution), 0.01);

  return (
    <div className="space-y-2">
      {factors.map((f) => {
        const pct = Math.round((f.contribution / max) * 100);
        const positive = f.direction === "positive";
        return (
          <div key={f.feature} className="grid grid-cols-[1fr_auto] gap-x-2 items-center text-xs">
            <span className="text-muted-foreground truncate leading-tight">{f.label}</span>
            <span className={`font-mono font-semibold tabular-nums ${positive ? "text-red-500" : "text-blue-500"}`}>
              {positive ? "+" : "−"}{(f.contribution * 100).toFixed(1)}%
            </span>
            {/* bar track */}
            <div className="col-span-2 flex h-4 items-center">
              <div className="relative w-full h-3 bg-muted rounded-sm overflow-hidden">
                {/* center line */}
                <div className="absolute inset-y-0 left-1/2 w-px bg-border z-10" />
                {positive ? (
                  <div
                    className="absolute inset-y-0 left-1/2 bg-red-500/80 rounded-r-sm"
                    style={{ width: `${pct / 2}%` }}
                  />
                ) : (
                  <div
                    className="absolute inset-y-0 right-1/2 bg-blue-500/80 rounded-l-sm"
                    style={{ width: `${pct / 2}%` }}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
        <span>← reduce riesgo</span>
        <span>aumenta riesgo →</span>
      </div>
    </div>
  );
}

// ── CP-01 ──────────────────────────────────────────────────────────────────

function CP01Card({ data }: { data: CP01Result | null }) {
  if (!data) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <Badge variant="outline" className="w-fit">CP-01</Badge>
          <CardTitle className="text-base">Vuelo de alto riesgo confirmado</CardTitle>
          <CardDescription>Sin datos disponibles en la base de datos.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const top3 = data.shap.slice(0, 3);

  return (
    <Card className={data.passed ? "border-green-500/40" : "border-destructive/40"}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <Badge variant="outline" className="w-fit">CP-01</Badge>
          <PassBadge passed={data.passed} />
        </div>
        <div className="flex items-center gap-1.5 text-xl font-semibold mt-2">
          <Plane className="size-4 text-primary" />
          {data.flight_number}
        </div>
        <CardDescription className="flex items-center gap-1">
          {data.origin}
          <ArrowRight className="size-3" />
          {data.destination}
          <span className="ml-2 text-muted-foreground/60">·</span>
          <span className="ml-1">{fmtTime(data.scheduled_out_utc)} UTC</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <Row label="Objetivo" value="Detectar vuelo de alto riesgo con retraso real" />
          <Row label="Resultado esperado" value="Probabilidad ≥ 35% y retraso real > 15 min" />
          <Row label="Probabilidad predicha" value={
            <span className="text-risk-high font-bold">{fmtProba(data.predicted_proba)}</span>
          } />
          <Row label="Nivel de riesgo" value={
            <Badge variant="destructive" className="text-[11px]">ALTO</Badge>
          } />
          <Row label="Retraso real" value={`+${data.actual_delay_min} min`} />
        </div>

        {top3.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              Factores principales (SHAP)
            </p>
            <ShapChart factors={top3} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── CP-02 ──────────────────────────────────────────────────────────────────

function CP02Card({ data }: { data: CP02Result }) {
  const passed = data.passed;
  return (
    <Card className={passed ? "border-green-500/40" : "border-destructive/40"}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <Badge variant="outline" className="w-fit">CP-02</Badge>
          <PassBadge passed={passed} />
        </div>
        <div className="flex items-center gap-1.5 text-xl font-semibold mt-2">
          <BarChart3 className="size-4 text-primary" />
          Precisión del modelo
        </div>
        <CardDescription>
          Evaluación sobre vuelos reales de KATL con resultado confirmado
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Row label="Objetivo" value="AUC ≥ 0.70 sobre datos live reales" />
        <Row label="Resultado esperado" value="AUC ≥ 0.70 / Brier ≤ 0.15" />
        <Row label="Vuelos evaluados (n)" value={data.n_actuals.toLocaleString()} />
        <Row
          label={
            <span className="space-y-0.5">
              <span className="block">AUC-ROC</span>
              <span className="block text-[10px] font-normal text-muted-foreground/70 leading-tight">
                Qué tan bien separa el modelo vuelos demorados de puntuales. 1.0 = perfecto, 0.5 = azar.
              </span>
            </span>
          }
          value={
            <span className={data.auc && data.auc >= 0.70 ? "text-green-600 font-bold" : "text-destructive font-bold"}>
              {data.auc?.toFixed(3) ?? "—"}
            </span>
          }
        />
        <Row
          label={
            <span className="space-y-0.5">
              <span className="block">Brier Score</span>
              <span className="block text-[10px] font-normal text-muted-foreground/70 leading-tight">
                Error cuadrático medio de las probabilidades predichas. 0.0 = perfecto, 0.25 = azar.
              </span>
            </span>
          }
          value={data.brier?.toFixed(4) ?? "—"}
        />
        <Row
          label="Tasa real de retrasos"
          value={data.actual_delay_rate ? fmtProba(data.actual_delay_rate) : "—"}
        />
      </CardContent>
    </Card>
  );
}

// ── CP-03 ──────────────────────────────────────────────────────────────────

function CP03Card({ ms }: { ms: number | null }) {
  const THRESHOLD_MS = 2000;
  const passed = ms !== null && ms < THRESHOLD_MS;

  return (
    <Card className={ms === null ? "" : passed ? "border-green-500/40" : "border-destructive/40"}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <Badge variant="outline" className="w-fit">CP-03</Badge>
          {ms !== null ? <PassBadge passed={passed} /> : (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xl font-semibold mt-2">
          <Timer className="size-4 text-primary" />
          Tiempo de respuesta
        </div>
        <CardDescription>
          Latencia del endpoint principal medida desde el cliente
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Row label="Objetivo" value="API responde en < 2 segundos" />
        <Row label="Endpoint medido" value={
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">GET /flights</code>
        } />
        <Row label="Límite aceptable" value={`${THRESHOLD_MS} ms`} />
        <Row
          label="Tiempo medido"
          value={
            ms === null ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <span className={passed ? "text-green-600 font-bold" : "text-destructive font-bold"}>
                {ms.toFixed(0)} ms
              </span>
            )
          }
        />
        <Row
          label="Resultado"
          value={
            ms === null ? "—" : passed
              ? `${ms.toFixed(0)} ms < ${THRESHOLD_MS} ms ✓`
              : `${ms.toFixed(0)} ms ≥ ${THRESHOLD_MS} ms ✗`
          }
        />
      </CardContent>
    </Card>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function CasosDePruebaPage() {
  const [tcData, setTcData] = useState<TestCasesResponse | null>(null);
  const [flightsMs, setFlightsMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // CP-03: time /flights independently
    const t0 = performance.now();
    fetch(`${BASE_URL}/flights`, { cache: "no-store" })
      .then(() => setFlightsMs(performance.now() - t0))
      .catch(() => setFlightsMs(null));

    // CP-01 + CP-02
    fetch(`${BASE_URL}/test-cases`, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((d) => { setTcData(d); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, []);

  return (
    <AppShell title="Casos de prueba">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Validación académica</Badge>
            <Badge variant="outline" className="text-muted-foreground">UCC Grupo 9 · OnTimeAI</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Casos de prueba formales
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Tres casos de prueba ejecutados en vivo contra la API y la base de datos real de predicciones
            del aeropuerto ATL. Los resultados se calculan en el momento de cargar esta página.
          </p>
        </header>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <Loader2 className="size-4 animate-spin" />
            Ejecutando casos de prueba…
          </div>
        )}

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-4 text-sm text-destructive">
              Error al conectar con el backend: {error}
            </CardContent>
          </Card>
        )}

        {!loading && !error && tcData && (
          <div className="grid gap-4 md:grid-cols-3">
            <CP01Card data={tcData.cp01} />
            <CP02Card data={tcData.cp02} />
            <CP03Card ms={flightsMs} />
          </div>
        )}

        <Card className="bg-muted/30">
          <CardContent className="pt-4 grid gap-1 text-xs text-muted-foreground md:grid-cols-3">
            <div><span className="font-medium text-foreground">CP-01</span> — Predicción de vuelo de alto riesgo con retraso real confirmado. Criterio: probabilidad mayor o igual a 35% y retraso real mayor a 15 min.</div>
            <div><span className="font-medium text-foreground">CP-02</span> — Evaluación AUC-ROC sobre actuals reales de KATL (15–17 mayo 2026). Criterio: AUC mayor o igual a 0.70 y Brier menor o igual a 0.15.</div>
            <div><span className="font-medium text-foreground">CP-03</span> — Tiempo de respuesta del endpoint principal GET /flights medido desde el navegador. Criterio: menos de 2 segundos.</div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
