import type { SessionUser } from "@/lib/auth-types";

const SERVER_BASE =
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";
const CLIENT_BASE = "/api/backend";

export type RiskLevel = "low" | "medium" | "high";

export type ShapFactor = {
  feature: string;
  label: string;
  contribution: number;
  direction: "positive" | "negative";
  value?: string | null;
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

export type OperationalContext = {
  gdp_origin_delay_min: number | null;
  gdp_destination_delay_min: number | null;
  intermediate_departure_delay_min: number | null;
  adsb_eta_delay_min: number | null;
  adsb_holding_min: number | null;
};

export type PredictionPoint = {
  predicted_at_utc: string;
  delay_probability: number;
  base_probability: number;
  operational_adjustment: number;
  predicted_delay: number;
  threshold_used: number | null;
  threshold_strategy: string | null;
  prediction_phase: "PRE_DEPARTURE" | "EN_ROUTE" | "POST_LANDING";
  operational_context: OperationalContext;
  shap: ShapFactor[];
};

type PredictionPointPayload = Partial<PredictionPoint> & Pick<PredictionPoint, "predicted_at_utc" | "delay_probability" | "predicted_delay">;

function normalizePredictionPoint(point: PredictionPointPayload): PredictionPoint {
  const baseProbability = point.base_probability ?? point.delay_probability;
  const phase = point.prediction_phase;
  return {
    predicted_at_utc: point.predicted_at_utc,
    delay_probability: point.delay_probability,
    base_probability: baseProbability,
    operational_adjustment:
      point.operational_adjustment ?? point.delay_probability - baseProbability,
    predicted_delay: point.predicted_delay,
    threshold_used: point.threshold_used ?? null,
    threshold_strategy: point.threshold_strategy ?? null,
    prediction_phase:
      phase === "EN_ROUTE" || phase === "POST_LANDING"
        ? phase
        : "PRE_DEPARTURE",
    operational_context: point.operational_context ?? {
      gdp_origin_delay_min: null,
      gdp_destination_delay_min: null,
      intermediate_departure_delay_min: null,
      adsb_eta_delay_min: null,
      adsb_holding_min: null,
    },
    shap: point.shap ?? [],
  };
}

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
  if (typeof window !== "undefined") return {};

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
  const base = typeof window === "undefined" ? SERVER_BASE : CLIENT_BASE;
  const res = await fetch(`${base}${path}`, {
    cache: "no-store",
    signal: options?.signal ?? AbortSignal.timeout(15_000),
    ...options,
    headers: { ...authHdrs, ...(options?.headers ?? {}) },
  });
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      if (!window.location.pathname.startsWith("/login")) {
        window.location.replace("/login");
      }
    }
    throw new ApiError(401, "La sesión venció. Volvé a ingresar.");
  }
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as
      | { detail?: string; error?: string }
      | null;
    throw new ApiError(
      res.status,
      payload?.detail ?? payload?.error ?? `API ${path} → ${res.status}`,
    );
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export async function apiLogin(username: string, password: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(10_000),
  });
  const payload = (await res.json().catch(() => null)) as
    | (Partial<SessionUser> & { detail?: string })
    | null;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      payload?.detail ?? "No se pudo iniciar sesión.",
    );
  }
  return payload as SessionUser;
}

export async function apiLogout() {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new ApiError(response.status, "No se pudo cerrar la sesión");
}

export const BASE_URL = CLIENT_BASE;

export const api = {
  request:        <T>(path: string, options?: RequestInit) => get<T>(path, options),
  flights: (status?: string, departuresWithinMin?: number) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (departuresWithinMin !== undefined)
      params.set("departures_within_min", String(departuresWithinMin));
    const qs = params.toString();
    return get<Flight[]>(`/flights${qs ? `?${qs}` : ""}`);
  },
  flight:        (id: string) => get<Flight>(`/flights/${encodeURIComponent(id)}`),
  flightHistory: async (id: string) => {
    const history = await get<PredictionPointPayload[]>(`/flight-history/${encodeURIComponent(id)}`);
    return history.map(normalizePredictionPoint);
  },
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
