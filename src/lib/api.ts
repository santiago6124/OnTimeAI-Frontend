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
  estimated_out_utc: string;
  estimated_in_utc: string;
  actual_out_utc: string | null;
  aircraft_type: string;
  risk: RiskLevel;
  delay_probability: number;
  predicted_delay: number;
  predicted_at_utc: string;
  has_actual: boolean;
  arr_delay_min: number | null;
  departure_delay_min: number | null;
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

export type WeatherData = {
  airport_code: string;
  valid_utc: string;
  temperature_c: number | null;
  dewpoint_c: number | null;
  humidity_pct: number | null;
  wind_direction: number | null;
  wind_knots: number | null;
  gust_knots: number | null;
  altimeter_inhg: number | null;
  precip_mm: number | null;
  visibility_miles: number | null;
  wx_codes: string | null;
  precip_flag: boolean;
  low_visibility: boolean;
  strong_wind: boolean;
};

export type RouteMetric = {
  origin: string;
  dest: string;
  route: string;
  total_flights: number;
  on_time_rate: number;
  avg_delay_min: number;
};

export type RouteHistoryPoint = {
  date: string;
  total: number;
  on_time_rate: number;
  avg_delay_min: number;
};

export type PredictionPoint = {
  predicted_at_utc: string;
  delay_probability: number;
  predicted_delay: number;
};

export type ManagedUser = {
  id: number;
  username: string;
  role: "superadmin" | "admin" | "user";
  active: 0 | 1;
  created_at: string;
};

export type UserPreferences = {
  theme: string;
  palette: string;
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

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
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
    throw new ApiError(401, "Unauthorized");
  }
  if (!res.ok) throw new ApiError(res.status, `API ${path} → ${res.status}`);
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
  flights: (status?: string, departuresWithinMin?: number) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (departuresWithinMin !== undefined)
      params.set("departures_within_min", String(departuresWithinMin));
    const qs = params.toString();
    return get<Flight[]>(`/flights${qs ? `?${qs}` : ""}`);
  },
  flight:        (id: string) => get<Flight>(`/flights/${encodeURIComponent(id)}`),
  flightHistory: (id: string) => get<PredictionPoint[]>(`/flight-history/${encodeURIComponent(id)}`),
  weather:       (code: string) => get<WeatherData>(`/weather/${code}`),
  routes:        () => get<RouteMetric[]>("/metrics/routes"),
  routeHistory:  (origin: string, dest: string) => get<RouteHistoryPoint[]>(`/metrics/routes/${origin}/${dest}/history`),
  summary:       () => get<MetricsSummary>("/metrics/summary"),
  hourly:        () => get<HourlyBucket[]>("/metrics/hourly"),
  model:         () => get<ModelInfo>("/metrics/model"),
  testCases:     () => get<TestCasesResponse>("/test-cases"),
  // User management (superadmin)
  listUsers:     () => get<ManagedUser[]>("/admin/users"),
  createUser:    (username: string, password: string, role: string) =>
    get<{ ok: boolean }>("/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password, role }) }),
  updateUser:    (username: string, patch: { password?: string; role?: string; active?: boolean }) =>
    get<{ ok: boolean }>(`/admin/users/${encodeURIComponent(username)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }),
  deleteUser:    (username: string) =>
    get<void>(`/admin/users/${encodeURIComponent(username)}`, { method: "DELETE" }),
  // User preferences
  getPreferences:    () => get<UserPreferences>("/users/me/preferences"),
  updatePreferences: (prefs: Partial<UserPreferences>) =>
    get<{ ok: boolean }>("/users/me/preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(prefs) }),
};

// Helpers
export function riskLabel(risk: RiskLevel) {
  return { low: "Bajo", medium: "Medio", high: "Alto" }[risk];
}

/**
 * Parsea un string ISO como UTC aunque no tenga el sufijo Z.
 * "2026-05-28T00:00:00" sin Z → JS lo interpreta como hora local → error de 3h en Argentina.
 * Con Z forzado → siempre UTC.
 */
export function toUTCDate(utc: string): Date {
  return new Date(/[Z+]/.test(utc) ? utc : utc + "Z");
}

export function fmtTime(utc: string) {
  if (!utc) return "--";
  const d = toUTCDate(utc);
  const date = d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
  const time = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${date} ${time}`;
}

export function fmtProba(p: number) {
  return `${Math.round(p * 100)}%`;
}
