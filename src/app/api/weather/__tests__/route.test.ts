/**
 * CP-COB-FE-07 — `/api/weather`: el agregador de METARs para el mapa.
 *
 * Lo que garantiza: el CORS es exacto a los orígenes del WebView nativo (nada
 * de comodín); los códigos ICAO se normalizan y deduplican; una lista vacía o
 * de más de 150 estaciones es 400 antes de ir a AWC; la respuesta se cachea
 * en el borde y una falla de AWC se informa como 502 con el mensaje y la URL
 * que se pidió, también con CORS.
 *
 * AWC es un `fetch` falso; los logs de `weather-api` se silencian.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, OPTIONS } from "@/app/api/weather/route";
import { ATL_REGIONAL_STATIONS, type AwcMetar } from "@/lib/weather-api";

function metar(icaoId: string): AwcMetar {
  return {
    icaoId,
    lat: 33.6,
    lon: -84.4,
    temp: 20,
    dewp: 10,
    wdir: 180,
    wspd: 8,
    visib: "10+",
    altim: 1013,
    rawOb: `${icaoId} 091253Z AUTO`,
    obsTime: 0,
    reportTime: "2026-08-09T00:00:00Z",
  };
}

const llamadas: string[] = [];

function awc(cuerpo: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL) => {
      llamadas.push(String(url));
      return new Response(JSON.stringify(cuerpo), { status, statusText: status === 200 ? "OK" : "Unavailable" });
    }),
  );
}

function pedido(query = "", origin?: string) {
  return new Request(`http://localhost:3000/api/weather${query}`, {
    headers: origin ? { origin } : {},
  });
}

beforeEach(() => {
  llamadas.length = 0;
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("OPTIONS /api/weather", () => {
  it.each(["capacitor://localhost", "https://localhost"])("permite el origen nativo %s", async (origin) => {
    // Act
    const respuesta = await OPTIONS(pedido("", origin));

    // Assert: refleja el origen exacto y avisa a la caché que varía por él.
    expect(respuesta.status).toBe(204);
    expect(respuesta.headers.get("access-control-allow-origin")).toBe(origin);
    expect(respuesta.headers.get("vary")).toBe("Origin");
    expect(respuesta.headers.get("access-control-allow-methods")).toBe("GET, OPTIONS");
  });

  it("no abre CORS a otros orígenes ni sin origen", async () => {
    expect((await OPTIONS(pedido("", "https://otro.sitio"))).headers.get("access-control-allow-origin")).toBeNull();
    expect((await OPTIONS(pedido())).headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("GET /api/weather", () => {
  it("sin ids pide la red regional de ATL y responde cacheable", async () => {
    // Arrange
    awc([metar("KMIA"), metar("KATL")]);

    // Act
    const respuesta = await GET(pedido());
    const cuerpo = await respuesta.json();

    // Assert
    expect(respuesta.status).toBe(200);
    expect(new URL(llamadas[0]).searchParams.get("ids")).toBe(ATL_REGIONAL_STATIONS.join(","));
    expect(respuesta.headers.get("cache-control")).toBe("s-maxage=300, stale-while-revalidate=600");
    expect(cuerpo.stations.map((s: { code: string }) => s.code)).toEqual(["MIA", "ATL"]);
    expect(cuerpo.atlRaw).toBe("KATL 091253Z AUTO");
    expect(cuerpo.rawPayload).toHaveLength(2);
    expect(cuerpo.requestUrl).toContain(`ids=${ATL_REGIONAL_STATIONS.join(",")}`);
    expect(typeof cuerpo.elapsedMs).toBe("number");
    expect(Number.isNaN(Date.parse(cuerpo.fetchedAt))).toBe(false);
  });

  it("normaliza los ids: mayúsculas, sin espacios y sin repetidos", async () => {
    awc([metar("KATL"), metar("KMIA")]);

    await GET(pedido("?ids=%20katl,%20kmia%20,KATL,,"));

    expect(new URL(llamadas[0]).searchParams.get("ids")).toBe("KATL,KMIA");
  });

  it("sin KATL en la respuesta atlRaw es null", async () => {
    awc([metar("KMIA")]);

    const cuerpo = await (await GET(pedido("?ids=KMIA"))).json();

    expect(cuerpo.atlRaw).toBeNull();
  });

  it("una lista vacía es 400 antes de ir a AWC", async () => {
    awc([]);

    const respuesta = await GET(pedido("?ids=,%20,"));

    expect(respuesta.status).toBe(400);
    await expect(respuesta.json()).resolves.toEqual({ error: "Solicitá entre 1 y 150 estaciones" });
    expect(llamadas).toHaveLength(0);
  });

  it("más de 150 estaciones es 400", async () => {
    awc([]);
    const ids = Array.from({ length: 151 }, (_, i) => `K${String(i).padStart(3, "0")}`).join(",");

    const respuesta = await GET(pedido(`?ids=${ids}`));

    expect(respuesta.status).toBe(400);
    expect(llamadas).toHaveLength(0);
  });

  it("una falla de AWC es 502 con el mensaje, la URL pedida y CORS", async () => {
    awc({ error: "down" }, 503);

    const respuesta = await GET(pedido("?ids=KATL", "capacitor://localhost"));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(502);
    expect(cuerpo.error).toBe("AWC devolvió 503 Unavailable");
    expect(cuerpo.requestUrl).toBe("https://aviationweather.gov/api/data/metar?ids=KATL&format=json&taf=false");
    expect(typeof cuerpo.elapsedMs).toBe("number");
    expect(respuesta.headers.get("access-control-allow-origin")).toBe("capacitor://localhost");
  });

  it("el 200 también lleva CORS cuando lo pide el WebView", async () => {
    awc([metar("KATL")]);

    const respuesta = await GET(pedido("?ids=KATL", "https://localhost"));

    expect(respuesta.headers.get("access-control-allow-origin")).toBe("https://localhost");
    expect(respuesta.headers.get("vary")).toBe("Origin");
  });
});
