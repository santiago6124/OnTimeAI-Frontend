"use client";

import { useState, useCallback } from "react";
import {
  Play, CheckCircle2, XCircle, Clock, Loader2,
  ChevronDown, ChevronRight, Plane, BarChart3,
  CloudSun, Activity, FlaskConical, Info,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BASE_URL } from "@/lib/api";

// ── types ──────────────────────────────────────────────────────────────────

type Status = "idle" | "loading" | "ok" | "error";
type Verdict = "none" | "pass" | "fail";

interface EndpointState {
  status: Status;
  ms: number | null;
  data: unknown;
  verdict: Verdict;
}

// ── endpoint definitions ───────────────────────────────────────────────────

interface EndpointDef {
  id: string;
  method: "GET";
  path: string;
  buildPath?: (params: Record<string, string>) => string;
  params?: { key: string; label: string; placeholder: string }[];
  title: string;
  description: string;
  useCase: string;
  expectedResult: string;
  icon: React.ReactNode;
  group: string;
}

const ENDPOINTS: EndpointDef[] = [
  {
    id: "flights",
    method: "GET", path: "/flights",
    title: "Lista de vuelos con nivel de riesgo",
    description: "Retorna todos los vuelos del día en ATL con probabilidad de retraso, nivel de riesgo y factores SHAP.",
    useCase: "CU-01 · CU-02",
    expectedResult: "HTTP 200 · Array de vuelos con campos: flight_number, origin, destination, risk, delay_probability, shap[]",
    icon: <Plane className="size-4" />,
    group: "Predicciones",
  },
  {
    id: "flight-detail",
    method: "GET", path: "/flights/{id}",
    buildPath: (p) => `/flights/${encodeURIComponent(p.id)}`,
    params: [{ key: "id", label: "fa_flight_id", placeholder: "Ej: DAL1234-1747612800-schedule-0" }],
    title: "Detalle de vuelo + SHAP",
    description: "Pegá un fa_flight_id de la respuesta de /flights para ver la predicción completa con factores SHAP.",
    useCase: "CU-02",
    expectedResult: "HTTP 200 · Objeto vuelo con shap[] conteniendo al menos 3 factores con contribution y direction.",
    icon: <Plane className="size-4" />,
    group: "Predicciones",
  },
  {
    id: "metrics-summary",
    method: "GET", path: "/metrics/summary",
    title: "Resumen de métricas del día",
    description: "Retorna el conteo total de vuelos por nivel de riesgo, la probabilidad promedio y la versión del modelo activo.",
    useCase: "CU-04 · CU-05",
    expectedResult: "HTTP 200 · { total_flights, high_risk, medium_risk, low_risk, avg_delay_probability, model_version }",
    icon: <BarChart3 className="size-4" />,
    group: "Métricas",
  },
  {
    id: "metrics-hourly",
    method: "GET", path: "/metrics/hourly",
    title: "Distribución horaria de riesgo",
    description: "Retorna la distribución de vuelos por franja horaria con el conteo de vuelos de alto riesgo por hora.",
    useCase: "CU-04",
    expectedResult: "HTTP 200 · Array de { hour, total, high_risk, avg_proba } por cada franja horaria del día.",
    icon: <BarChart3 className="size-4" />,
    group: "Métricas",
  },
  {
    id: "metrics-model",
    method: "GET", path: "/metrics/model",
    title: "Información del modelo predictivo",
    description: "Retorna la versión activa del modelo LightGBM, el AUC-ROC y Brier Score calculados sobre datos live reales.",
    useCase: "CU-05",
    expectedResult: "HTTP 200 · { active_model, version, live_auc, live_brier, n_actuals, threshold }",
    icon: <Activity className="size-4" />,
    group: "Métricas",
  },
  {
    id: "test-cases",
    method: "GET", path: "/test-cases",
    title: "Casos de prueba formales (CP-01 / CP-02)",
    description: "Ejecuta los 2 casos de prueba académicos: detección de vuelo de alto riesgo con retraso real confirmado (CP-01) y evaluación AUC-ROC sobre actuals (CP-02).",
    useCase: "CP-01 · CP-02",
    expectedResult: "HTTP 200 · { cp01: { passed, predicted_proba, actual_delay_min, shap[] }, cp02: { auc≥0.70, brier≤0.15, passed } }",
    icon: <FlaskConical className="size-4" />,
    group: "Validación académica",
  },
  {
    id: "weather",
    method: "GET", path: "/weather/{airport_code}",
    buildPath: (p) => `/weather/${p.airport_code}`,
    params: [{ key: "airport_code", label: "Aeropuerto", placeholder: "ATL" }],
    title: "Condiciones meteorológicas",
    description: "Retorna las condiciones climáticas actuales del aeropuerto indicado: temperatura, viento, visibilidad y condición general.",
    useCase: "CU-03",
    expectedResult: "HTTP 200 · Objeto con datos meteorológicos del aeropuerto.",
    icon: <CloudSun className="size-4" />,
    group: "Contexto operacional",
  },
  {
    id: "operations",
    method: "GET", path: "/operations/{airport_code}",
    buildPath: (p) => `/operations/${p.airport_code}`,
    params: [{ key: "airport_code", label: "Aeropuerto", placeholder: "ATL" }],
    title: "Estado operacional del aeropuerto",
    description: "Retorna el nivel de congestión y la tasa de retrasos recientes del aeropuerto.",
    useCase: "CU-04",
    expectedResult: "HTTP 200 · Objeto con métricas operacionales del aeropuerto.",
    icon: <Activity className="size-4" />,
    group: "Contexto operacional",
  },
];

// ── sub-components ─────────────────────────────────────────────────────────

function JsonViewer({ data }: { data: unknown }) {
  const [open, setOpen] = useState(true);
  const json = JSON.stringify(data, null, 2);
  const lines = json.split("\n").length;

  return (
    <div className="mt-3 rounded-md border bg-muted/40 overflow-hidden text-xs font-mono">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-muted-foreground hover:bg-muted/60 transition-colors"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <span>{lines} líneas · click para {open ? "colapsar" : "expandir"}</span>
      </button>
      {open && (
        <pre className="p-3 overflow-auto max-h-64 text-[11px] leading-relaxed">
          {json}
        </pre>
      )}
    </div>
  );
}

function TestCasesViewer({ data }: { data: unknown }) {
  const d = data as {
    cp01: {
      passed: boolean;
      flight_number?: string;
      predicted_proba?: number;
      actual_delay_min?: number;
      predicted_risk?: string;
      shap?: { feature: string; contribution: number; direction: string }[];
    } | null;
    cp02: {
      passed: boolean;
      n_actuals: number | null;
      auc: number | null;
      brier: number | null;
      actual_delay_rate: number | null;
    };
  } | null;

  if (!d) return <JsonViewer data={data} />;

  return (
    <div className="mt-3 space-y-3">
      {/* CP-01 */}
      <div className={`rounded-lg border p-4 ${d.cp01 === null ? "border-muted" : d.cp01.passed ? "border-green-500/40 bg-green-500/5" : "border-destructive/40 bg-destructive/5"}`}>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="font-mono text-xs">CP-01</Badge>
          <span className="text-sm font-medium">Vuelo de alto riesgo con retraso real confirmado</span>
          {d.cp01 === null ? (
            <Badge variant="secondary" className="text-xs">Sin actuals</Badge>
          ) : d.cp01.passed ? (
            <Badge className="bg-green-600 text-xs">PASS</Badge>
          ) : (
            <Badge variant="destructive" className="text-xs">FAIL</Badge>
          )}
        </div>
        {d.cp01 === null ? (
          <p className="text-xs text-muted-foreground">No hay vuelos con retraso real registrado aún. CP-01 se evaluará cuando haya actuals en la base de datos.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <div className="rounded bg-muted/40 px-2 py-1.5">
              <p className="text-muted-foreground mb-0.5">Vuelo</p>
              <p className="font-mono font-medium">{d.cp01.flight_number ?? "—"}</p>
            </div>
            <div className="rounded bg-muted/40 px-2 py-1.5">
              <p className="text-muted-foreground mb-0.5">Prob. predicha</p>
              <p className="font-mono font-medium">{d.cp01.predicted_proba != null ? `${Math.round(d.cp01.predicted_proba * 100)}%` : "—"}</p>
            </div>
            <div className="rounded bg-muted/40 px-2 py-1.5">
              <p className="text-muted-foreground mb-0.5">Riesgo</p>
              <p className="font-mono font-medium capitalize">{d.cp01.predicted_risk ?? "—"}</p>
            </div>
            <div className="rounded bg-muted/40 px-2 py-1.5">
              <p className="text-muted-foreground mb-0.5">Retraso real</p>
              <p className="font-mono font-medium">{d.cp01.actual_delay_min != null ? `${d.cp01.actual_delay_min} min` : "—"}</p>
            </div>
            <div className="rounded bg-muted/40 px-2 py-1.5 col-span-2">
              <p className="text-muted-foreground mb-0.5">Factores SHAP</p>
              <p className="font-mono font-medium">{d.cp01.shap?.length ?? 0} factores</p>
            </div>
          </div>
        )}
      </div>

      {/* CP-02 */}
      <div className={`rounded-lg border p-4 ${d.cp02.n_actuals === 0 || d.cp02.n_actuals === null ? "border-muted" : d.cp02.passed ? "border-green-500/40 bg-green-500/5" : "border-destructive/40 bg-destructive/5"}`}>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="font-mono text-xs">CP-02</Badge>
          <span className="text-sm font-medium">AUC-ROC y Brier Score sobre datos reales</span>
          {(d.cp02.n_actuals === 0 || d.cp02.n_actuals === null) ? (
            <Badge variant="secondary" className="text-xs">Sin actuals</Badge>
          ) : d.cp02.passed ? (
            <Badge className="bg-green-600 text-xs">PASS</Badge>
          ) : (
            <Badge variant="destructive" className="text-xs">FAIL</Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="rounded bg-muted/40 px-2 py-1.5">
            <p className="text-muted-foreground mb-0.5">Actuals</p>
            <p className="font-mono font-medium">{d.cp02.n_actuals ?? "—"}</p>
          </div>
          <div className="rounded bg-muted/40 px-2 py-1.5">
            <p className="text-muted-foreground mb-0.5">AUC-ROC</p>
            <p className={`font-mono font-medium ${d.cp02.auc != null && d.cp02.auc >= 0.70 ? "text-green-600" : "text-muted-foreground"}`}>
              {d.cp02.auc != null ? d.cp02.auc.toFixed(3) : "—"}
              {d.cp02.auc != null && <span className="text-muted-foreground ml-1">(≥0.70)</span>}
            </p>
          </div>
          <div className="rounded bg-muted/40 px-2 py-1.5">
            <p className="text-muted-foreground mb-0.5">Brier</p>
            <p className={`font-mono font-medium ${d.cp02.brier != null && d.cp02.brier <= 0.15 ? "text-green-600" : "text-muted-foreground"}`}>
              {d.cp02.brier != null ? d.cp02.brier.toFixed(3) : "—"}
              {d.cp02.brier != null && <span className="text-muted-foreground ml-1">(≤0.15)</span>}
            </p>
          </div>
          <div className="rounded bg-muted/40 px-2 py-1.5">
            <p className="text-muted-foreground mb-0.5">Tasa real</p>
            <p className="font-mono font-medium">
              {d.cp02.actual_delay_rate != null ? `${Math.round(d.cp02.actual_delay_rate * 100)}%` : "—"}
            </p>
          </div>
        </div>
        {(d.cp02.n_actuals === 0 || d.cp02.n_actuals === null) && (
          <p className="text-xs text-muted-foreground mt-2">CP-02 requiere vuelos con resultado real registrado. Los actuals se cargan automáticamente pasadas las horas de llegada.</p>
        )}
      </div>
    </div>
  );
}

function VerdictButtons({
  verdict,
  onChange,
}: {
  verdict: Verdict;
  onChange: (v: "pass" | "fail") => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Veredicto:</span>
      <button
        onClick={() => onChange("pass")}
        className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
          verdict === "pass"
            ? "bg-green-600 text-white border-green-600"
            : "border-green-600/40 text-green-600 hover:bg-green-600/10"
        }`}
      >
        <CheckCircle2 className="size-3" /> PASS
      </button>
      <button
        onClick={() => onChange("fail")}
        className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
          verdict === "fail"
            ? "bg-destructive text-white border-destructive"
            : "border-destructive/40 text-destructive hover:bg-destructive/10"
        }`}
      >
        <XCircle className="size-3" /> FAIL
      </button>
    </div>
  );
}

function EndpointCard({
  ep,
  onVerdict,
}: {
  ep: EndpointDef;
  onVerdict: (id: string, v: "pass" | "fail") => void;
}) {
  const [state, setState] = useState<EndpointState>({
    status: "idle", ms: null, data: null, verdict: "none",
  });
  const [params, setParams] = useState<Record<string, string>>(
    Object.fromEntries((ep.params ?? []).map((p) => [p.key, ""]))
  );

  const missingRequired = (ep.params ?? []).some((p) => !params[p.key]?.trim());

  async function run() {
    setState((s) => ({ ...s, status: "loading", data: null, ms: null }));
    const path = ep.buildPath ? ep.buildPath(params) : ep.path;
    const t0 = performance.now();
    try {
      const res = await fetch(`${BASE_URL}${path}`, { cache: "no-store" });
      const ms = Math.round(performance.now() - t0);
      const data = await res.json();
      setState((s) => ({
        ...s, status: res.ok ? "ok" : "error", ms, data,
        verdict: res.ok ? s.verdict : "fail",
      }));
    } catch (e) {
      const ms = Math.round(performance.now() - t0);
      setState((s) => ({ ...s, status: "error", ms, data: String(e), verdict: "fail" }));
    }
  }

  function handleVerdict(v: "pass" | "fail") {
    setState((s) => ({ ...s, verdict: v }));
    onVerdict(ep.id, v);
  }

  const statusColor = {
    idle: "bg-muted text-muted-foreground",
    loading: "bg-blue-500/15 text-blue-600",
    ok: "bg-green-500/15 text-green-700",
    error: "bg-destructive/15 text-destructive",
  }[state.status];

  const statusLabel = {
    idle: "Sin ejecutar",
    loading: "Ejecutando…",
    ok: `200 OK · ${state.ms} ms`,
    error: `Error · ${state.ms ?? "—"} ms`,
  }[state.status];

  const isTestCases = ep.id === "test-cases";

  return (
    <Card className={
      state.verdict === "pass" ? "border-green-500/40" :
      state.verdict === "fail" ? "border-destructive/40" : ""
    }>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 font-mono text-xs">
              <span className="text-green-600 font-bold">GET</span>
              {ep.path}
            </Badge>
            <Badge variant="secondary" className="text-xs">{ep.useCase}</Badge>
          </div>
          <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
            {state.status === "loading" && <Loader2 className="size-3 animate-spin" />}
            {state.status === "ok" && <CheckCircle2 className="size-3" />}
            {state.status === "error" && <XCircle className="size-3" />}
            {state.status === "idle" && <Clock className="size-3" />}
            {statusLabel}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {ep.icon}
          <CardTitle className="text-base">{ep.title}</CardTitle>
        </div>
        <CardDescription className="text-sm">{ep.description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* params */}
        {ep.params && ep.params.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            {ep.params.map((p) => (
              <div key={p.key} className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground font-medium">{p.label}:</label>
                <Input
                  value={params[p.key]}
                  onChange={(e) => setParams((prev) => ({ ...prev, [p.key]: e.target.value }))}
                  className="h-7 w-64 font-mono text-xs"
                  placeholder={p.placeholder}
                />
              </div>
            ))}
          </div>
        )}

        {/* expected result info */}
        <div className="flex items-start gap-2 rounded-md bg-muted/30 border px-3 py-2">
          <Info className="size-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Resultado esperado:</span>{" "}
            {ep.expectedResult}
          </p>
        </div>

        {/* actions */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={run}
              disabled={state.status === "loading" || missingRequired}
              className="gap-1.5"
            >
              {state.status === "loading"
                ? <Loader2 className="size-3.5 animate-spin" />
                : <Play className="size-3.5" />}
              Ejecutar
            </Button>
            {missingRequired && (
              <span className="text-xs text-muted-foreground">Completá el parámetro para ejecutar</span>
            )}
          </div>

          {state.status !== "idle" && (
            <VerdictButtons verdict={state.verdict} onChange={handleVerdict} />
          )}
        </div>

        {/* response */}
        {state.data !== null && (
          isTestCases ? <TestCasesViewer data={state.data} /> : <JsonViewer data={state.data} />
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function PruebasPage() {
  const groups = [...new Set(ENDPOINTS.map((e) => e.group))];
  const [verdicts, setVerdicts] = useState<Record<string, "pass" | "fail">>({});

  const handleVerdict = useCallback((id: string, v: "pass" | "fail") => {
    setVerdicts((prev) => ({ ...prev, [id]: v }));
  }, []);

  const total = ENDPOINTS.length;
  const passed = Object.values(verdicts).filter((v) => v === "pass").length;
  const failed = Object.values(verdicts).filter((v) => v === "fail").length;

  return (
    <AppShell title="Pruebas de API">
      <div className="mx-auto w-full max-w-4xl space-y-8">

        {/* header */}
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Validación externa</Badge>
            <Badge variant="outline" className="text-muted-foreground">
              UCC Grupo 9 · OnTimeAI · Sprint 4
            </Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Sandbox de pruebas — API OnTimeAI
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Ejecutá cada endpoint con el botón <strong>Ejecutar</strong>, verificá que el resultado
            coincida con lo esperado y marcá <strong>PASS</strong> o <strong>FAIL</strong>.
            El backend corre en <code className="bg-muted px-1 py-0.5 rounded text-xs">{BASE_URL}</code>.
          </p>

          {/* scoreboard */}
          <div className="flex gap-3 flex-wrap">
            <div className="rounded-lg border bg-muted/30 px-4 py-2 text-sm">
              Total: <strong>{total}</strong> endpoints
            </div>
            <div className="rounded-lg border bg-green-500/10 border-green-500/30 px-4 py-2 text-sm text-green-700">
              PASS: <strong>{passed}</strong>
            </div>
            <div className="rounded-lg border bg-destructive/10 border-destructive/30 px-4 py-2 text-sm text-destructive">
              FAIL: <strong>{failed}</strong>
            </div>
            <div className="rounded-lg border bg-muted/30 px-4 py-2 text-sm text-muted-foreground">
              Sin evaluar: <strong>{total - passed - failed}</strong>
            </div>
          </div>
        </header>

        {/* grupos */}
        {groups.map((group) => (
          <section key={group} className="space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">{group}</h2>
            <div className="space-y-4">
              {ENDPOINTS.filter((e) => e.group === group).map((ep) => (
                <EndpointCard key={ep.id} ep={ep} onVerdict={handleVerdict} />
              ))}
            </div>
          </section>
        ))}

        {/* use cases reference */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold border-b pb-2">Referencia de casos de uso</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { id: "CU-01", title: "Consultar vuelos del día con nivel de riesgo", jira: "UGS-23, UGS-30" },
              { id: "CU-02", title: "Ver predicción detallada con factores causales (SHAP)", jira: "UGS-22, UGS-39" },
              { id: "CU-03", title: "Consultar condiciones meteorológicas de ATL", jira: "UGS-25, UGS-35" },
              { id: "CU-04", title: "Ver estado operacional y métricas del aeropuerto", jira: "UGS-25, UGS-36, UGS-41" },
              { id: "CU-05", title: "Evaluar precisión del modelo predictivo", jira: "UGS-19, UGS-21" },
              { id: "CP-01/02", title: "Casos de prueba académicos formales (AUC + retraso real)", jira: "UGS-28, UGS-49" },
            ].map((cu) => (
              <div key={cu.id} className="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs font-mono">{cu.id}</Badge>
                  <span className="text-xs text-muted-foreground">Jira: {cu.jira}</span>
                </div>
                <p className="font-medium text-sm">{cu.title}</p>
              </div>
            ))}
          </div>
        </section>

      </div>
    </AppShell>
  );
}
