import { getToken } from "@/lib/auth";

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

export type CP01Result = {
  fa_flight_id: string;
  flight_number: string;
  airline_code: string;
  origin: string;
  destination: string;
  scheduled_out_utc: string;
  predicted_proba: number;
  predicted_risk: RiskLevel;
  actual_delay_min: number;
  shap: ShapFactor[];
  passed: boolean;
};

export type CP02Result = {
  n_actuals: number;
  auc: number | null;
  brier: number | null;
  actual_delay_rate: number | null;
  passed: boolean;
};

export type TestCasesResponse = {
  cp01: CP01Result | null;
  cp02: CP02Result;
};

async function getAuthHeaders(): Promise<HeadersInit> {
  if (typeof window !== "undefined") {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
  // Server Component: read token from cookie via next/headers
  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    const token = store.get("auth-token")?.value;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function get<T>(path: string, options?: RequestInit): Promise<T> {
  const authHdrs = await getAuthHeaders();
  const res = await fetch(`${BASE}${path}`, {
    cache: "no-store",
    ...options,
    headers: { ...authHdrs, ...(options?.headers ?? {}) },
  });
  if (res.status === 401) {
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiLogin(username: string, password: string) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Credenciales incorrectas");
  return res.json() as Promise<{ access_token: string; token_type: string }>;
}

export const BASE_URL = BASE;

export const api = {
  flights:       () => get<Flight[]>("/flights"),
  flight:        (id: string) => get<Flight>(`/flights/${encodeURIComponent(id)}`),
  summary:       () => get<MetricsSummary>("/metrics/summary"),
  hourly:        () => get<HourlyBucket[]>("/metrics/hourly"),
  model:         () => get<ModelInfo>("/metrics/model"),
  testCases:     () => get<TestCasesResponse>("/test-cases"),
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
