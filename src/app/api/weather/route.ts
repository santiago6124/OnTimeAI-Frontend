import { NextResponse } from "next/server";
import {
  ATL_REGIONAL_STATIONS,
  fetchMetars,
  metarToStation,
} from "@/lib/weather-api";

export const revalidate = 300;

const ALLOWED_STATIONS = new Set(ATL_REGIONAL_STATIONS);
const MAX_STATIONS = 20;

export async function GET(request: Request) {
  const started = Date.now();
  const { searchParams } = new URL(request.url);

  const idsParam = searchParams.get("ids");
  const ids = idsParam
    ? idsParam
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    : ATL_REGIONAL_STATIONS;

  const uniqueIds = [...new Set(ids)];
  const invalid = uniqueIds.filter((id) => !ALLOWED_STATIONS.has(id));
  if (invalid.length > 0 || uniqueIds.length === 0 || uniqueIds.length > MAX_STATIONS) {
    return NextResponse.json(
      {
        error: invalid.length > 0
          ? `Estaciones no permitidas: ${invalid.join(", ")}`
          : `Solicitá entre 1 y ${MAX_STATIONS} estaciones`,
      },
      { status: 400 },
    );
  }

  const requestUrl = `https://aviationweather.gov/api/data/metar?ids=${uniqueIds.join(",")}&format=json&taf=false`;

  try {
    const metars = await fetchMetars(uniqueIds);
    const stations = metars.map(metarToStation);
    const atl = metars.find((m) => m.icaoId === "KATL");

    return NextResponse.json(
      {
        stations,
        atlRaw: atl?.rawOb ?? null,
        rawPayload: metars,
        requestUrl,
        fetchedAt: new Date().toISOString(),
        elapsedMs: Date.now() - started,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: message,
        requestUrl,
        elapsedMs: Date.now() - started,
      },
      { status: 502 },
    );
  }
}
