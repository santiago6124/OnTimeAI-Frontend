const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type RiskLevel = "low" | "medium" | "high";

export type ShapFactor = {
  feature: string;
  label: string;
  contribution: number;
  direction: "positive" | "negative";
};

export type Flight = {
  fa_flight_id: string;
  flight_number: string;
  airline_code: string;
  origin: string;
  destination: string;
  scheduled_out_utc: string;
  scheduled_in_utc: string;
  aircraft_type: string;
  risk: RiskLevel;
  delay_probability: number;
  predicted_delay: number;
  predicted_at_utc: string;
  has_actual: boolean;
  shap?: ShapFactor[];
};

export type MetricsSummary = {
  total_flights: number;
  high_risk: number;
  medium_risk: number;
  low_risk: number;
  avg_delay_probability: number;
  predicted_positive_rate: number;
  model_version: string;
  last_tick_utc: string;
};

export type HourlyBucket = {
  hour: string;
  total: number;
  high_risk: number;
  avg_proba: number;
};

export type ModelInfo = {
  active_model: string;
  version: string;
  live_auc: number | null;
  live_brier: number | null;
  n_actuals: number | null;
  threshold: number;
};

async function get<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    next: { revalidate: 60 },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  flights:       () => get<Flight[]>("/flights"),
  flight:        (id: string) => get<Flight>(`/flights/${encodeURIComponent(id)}`),
  summary:       () => get<MetricsSummary>("/metrics/summary"),
  hourly:        () => get<HourlyBucket[]>("/metrics/hourly"),
  model:         () => get<ModelInfo>("/metrics/model"),
};

// Helpers
export function riskLabel(risk: RiskLevel) {
  return { low: "Bajo", medium: "Medio", high: "Alto" }[risk];
}

export function fmtTime(utc: string) {
  if (!utc) return "--:--";
  const d = new Date(utc);
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

export function fmtProba(p: number) {
  return `${Math.round(p * 100)}%`;
}
