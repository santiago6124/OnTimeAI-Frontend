import type { WeatherStation } from "./mock-data";

export const ATL_REGIONAL_STATIONS = [
  "KATL",
  "KCLT",
  "KMCO",
  "KMIA",
  "KDFW",
  "KIAH",
  "KORD",
  "KDTW",
  "KBOS",
  "KJFK",
  "KDEN",
  "KPHX",
  "KLAS",
  "KLAX",
  "KSFO",
  "KSEA",
];

export type AwcMetar = {
  icaoId: string;
  name?: string;
  lat: number;
  lon: number;
  temp: number | null;
  dewp: number | null;
  wdir: number | null;
  wspd: number | null;
  wgst?: number | null;
  visib: string | number | null;
  altim: number | null;
  wxString?: string | null;
  clouds?: Array<{ cover: string; base?: number | null }>;
  rawOb: string;
  obsTime: number;
  reportTime: string;
  fltCat?: "VFR" | "MVFR" | "IFR" | "LIFR" | string;
};

const AWC_URL = "https://aviationweather.gov/api/data/metar";

export class WeatherApiError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "WeatherApiError";
  }
}

export async function fetchMetars(
  ids: string[],
  { revalidate = 300 }: { revalidate?: number } = {},
): Promise<AwcMetar[]> {
  const url = new URL(AWC_URL);
  url.searchParams.set("ids", ids.join(","));
  url.searchParams.set("format", "json");
  url.searchParams.set("taf", "false");

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate },
    });
  } catch (e) {
    throw new WeatherApiError(
      `No se pudo contactar Aviation Weather Center (${
        e instanceof Error ? e.message : "network error"
      })`,
      e,
    );
  }

  if (!res.ok) {
    throw new WeatherApiError(
      `AWC devolvió ${res.status} ${res.statusText}`,
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch (e) {
    throw new WeatherApiError("Respuesta de AWC no es JSON válido", e);
  }

  if (!Array.isArray(data)) {
    throw new WeatherApiError(
      "Respuesta inesperada de AWC: se esperaba un array",
    );
  }

  if (data.length === 0) {
    throw new WeatherApiError(
      "AWC devolvió cero estaciones — verificá los códigos ICAO",
    );
  }

  return data as AwcMetar[];
}

function parseVisibility(v: string | number | null): number {
  if (v == null) return 10;
  if (typeof v === "number") return v;
  const trimmed = v.trim();
  if (trimmed.endsWith("+")) {
    const n = parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(n) ? n : 10;
  }
  if (trimmed.includes("/")) {
    let total = 0;
    for (const part of trimmed.split(/\s+/)) {
      if (part.includes("/")) {
        const [num, den] = part.split("/").map(Number);
        if (den) total += num / den;
      } else {
        total += Number(part) || 0;
      }
    }
    return total || 10;
  }
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : 10;
}

function deriveCondition(m: AwcMetar): WeatherStation["condition"] {
  const wx = (m.wxString ?? "").toUpperCase();
  if (/TS|SQ/.test(wx)) return "storm";
  if (/FG|FZFG|BR/.test(wx)) return "fog";
  if (/RA|DZ|SH|PL/.test(wx)) return "rain";
  if (/SN/.test(wx)) return "rain";

  const vis = parseVisibility(m.visib);
  if (vis < 3) return "fog";

  const clouds = m.clouds ?? [];
  const hasOvc = clouds.some((c) => c.cover === "OVC");
  const hasBkn = clouds.some((c) => c.cover === "BKN");
  if (hasOvc || hasBkn) return "cloudy";

  return "clear";
}

function deriveImpact(m: AwcMetar): WeatherStation["impact"] {
  const cat = m.fltCat;
  if (cat === "LIFR" || cat === "IFR") return "high";
  if (cat === "MVFR") return "medium";

  const vis = parseVisibility(m.visib);
  const wind = m.wspd ?? 0;
  const gust = m.wgst ?? 0;
  const wx = (m.wxString ?? "").toUpperCase();

  if (/TS|SQ/.test(wx) || vis < 1 || wind > 25 || gust > 30) return "high";
  if (/RA|SN|FG|BR/.test(wx) || vis < 5 || wind > 15) return "medium";
  return "low";
}

function cleanStationName(raw: string | undefined, icao: string): string {
  if (!raw) return icao;
  const firstChunk = raw.split(",")[0]?.trim() ?? raw;
  return firstChunk.replace(/\/.*$/, "").trim() || icao;
}

export function metarToStation(m: AwcMetar): WeatherStation {
  const tempF =
    m.temp != null ? Math.round((m.temp * 9) / 5 + 32) : 0;
  const vis = Math.round(parseVisibility(m.visib));

  return {
    code: m.icaoId.replace(/^K/, ""),
    name: cleanStationName(m.name, m.icaoId),
    lat: m.lat,
    lng: m.lon,
    temperatureF: tempF,
    windKt: Math.round(m.wspd ?? 0),
    windDeg: m.wdir ?? 0,
    visibilitySm: vis,
    condition: deriveCondition(m),
    impact: deriveImpact(m),
  };
}

export async function fetchWeatherStations(
  ids: string[] = ATL_REGIONAL_STATIONS,
): Promise<{ stations: WeatherStation[]; atlRaw: string | null; fetchedAt: string }> {
  const metars = await fetchMetars(ids);
  const stations = metars.map(metarToStation);
  const atl = metars.find((m) => m.icaoId === "KATL");
  return {
    stations,
    atlRaw: atl?.rawOb ?? null,
    fetchedAt: new Date().toISOString(),
  };
}
