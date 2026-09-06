import { NextResponse } from "next/server";
import {
  ATL_REGIONAL_STATIONS,
  fetchMetars,
  metarToStation,
} from "@/lib/weather-api";

export const revalidate = 300;

const MAX_STATIONS = 150;

/**
 * Orígenes del WebView de la app nativa.
 *
 * Este handler agrega METARs de aviationweather.gov, que no manda cabeceras
 * CORS: por eso el bundle empaquetado no puede llamar al origen de arriba y
 * tiene que pasar por acá. Y para eso este handler necesita permitirlo, porque
 * el bundle corre en otro origen.
 *
 * Son los esquemas locales que fija Capacitor: `capacitor://localhost` en iOS,
 * `https://localhost` en Android cuando sirve los assets del binario. La lista
 * es exacta a propósito — un comodín acá abriría el endpoint a cualquier sitio.
 *
 * Es seguro: el endpoint es público (el matcher de `proxy.ts` excluye `api/`),
 * no lee cookies ni token, y devuelve datos meteorológicos abiertos. No se
 * manda `Access-Control-Allow-Credentials`, así que ninguna cookie viaja.
 */
const NATIVE_ORIGINS = new Set(["capacitor://localhost", "https://localhost"]);

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin || !NATIVE_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    // La respuesta se cachea con `s-maxage=300`. Sin esto, la primera respuesta
    // servida a un origen se reutilizaría para los demás con su ACAO pegado.
    Vary: "Origin",
  };
}

/**
 * Preflight.
 *
 * Un GET con `Accept` no lo dispara —es una cabecera de la safelist de CORS—,
 * así que hoy no se usa. Está para que agregar una cabecera al fetch del cliente
 * no rompa la app en el teléfono sin que nada lo avise.
 */
export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(request),
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Accept, Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function GET(request: Request) {
  const cors = corsHeaders(request);
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
  if (uniqueIds.length === 0 || uniqueIds.length > MAX_STATIONS) {
    return NextResponse.json(
      { error: `Solicitá entre 1 y ${MAX_STATIONS} estaciones` },
      { status: 400, headers: cors },
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
          ...cors,
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
      { status: 502, headers: cors },
    );
  }
}
