import { NextResponse } from "next/server";
import {
  ATL_REGIONAL_STATIONS,
  fetchMetars,
  metarToStation,
} from "@/lib/weather-api";

export const revalidate = 300;

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

  const requestUrl = `https://aviationweather.gov/api/data/metar?ids=${ids.join(",")}&format=json&taf=false`;

  try {
    const metars = await fetchMetars(ids);
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
