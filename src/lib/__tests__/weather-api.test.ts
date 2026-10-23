/**
 * CP-COB-FE-03 — `src/lib/weather-api.ts`: el cliente de METARs de
 * aviationweather.gov y su traducción a estaciones del mapa.
 *
 * Cubre `fetchMetars` (URL, cabeceras, y cada forma de fallar: red, HTTP,
 * JSON inválido, no-array, cero estaciones), el parseo de visibilidad en los
 * formatos que manda AWC ("10+", "1 1/2", "3/4", "5"), la derivación de
 * condición e impacto a partir de `wxString`, `fltCat`, viento y
 * visibilidad, la limpieza del nombre de estación y `fetchWeatherStations`.
 *
 * AWC es un `fetch` falso; los logs del módulo se silencian.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ATL_REGIONAL_STATIONS,
  fetchMetars,
  fetchWeatherStations,
  metarToStation,
  WeatherApiError,
  type AwcMetar,
} from "@/lib/weather-api";

function metar(overrides: Partial<AwcMetar> = {}): AwcMetar {
  return {
    icaoId: "KATL",
    lat: 33.64,
    lon: -84.43,
    temp: 20,
    dewp: 10,
    wdir: 180,
    wspd: 8,
    visib: "10+",
    altim: 1013,
    rawOb: "KATL 091253Z 18008KT 10SM CLR 20/10 A2992",
    obsTime: 0,
    reportTime: "2026-08-09T00:00:00Z",
    ...overrides,
  };
}

const llamadas: Array<{ url: string; init: RequestInit }> = [];

function awc(cuerpo: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init: RequestInit = {}) => {
      llamadas.push({ url: String(url), init });
      const texto = typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo);
      return new Response(texto, { status, statusText: status === 200 ? "OK" : "Error" });
    }),
  );
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

describe("metarToStation", () => {
  it("preserves missing observations instead of inventing zeroes", () => {
    const metar: AwcMetar = {
      icaoId: "KATL",
      lat: 33.64,
      lon: -84.43,
      temp: null,
      dewp: null,
      wdir: null,
      wspd: null,
      visib: null,
      altim: null,
      rawOb: "KATL AUTO",
      obsTime: 0,
      reportTime: "2026-08-09T00:00:00Z",
    };

    expect(metarToStation(metar)).toMatchObject({
      temperatureF: null,
      windKt: null,
      windDeg: null,
      visibilitySm: null,
    });
  });

  it("convierte Celsius a Fahrenheit redondeado y saca la K del ICAO", () => {
    // Arrange: 20 °C son 68 °F exactos; 21,7 °C son 71,06 → 71.
    const estacion = metarToStation(metar({ temp: 21.7, wspd: 8.4 }));

    // Assert
    expect(estacion.code).toBe("ATL");
    expect(estacion.temperatureF).toBe(71);
    expect(estacion.windKt).toBe(8);
    expect(estacion.lat).toBe(33.64);
    expect(estacion.lng).toBe(-84.43);
  });

  it.each([
    ["10+", 10],
    ["1 1/2", 2],
    ["3/4", 1],
    ["5", 5],
    [7, 7],
    ["abc", null],
    ["abc+", null],
    [null, null],
  ])("lee la visibilidad %j como %j millas", (visib, esperada) => {
    expect(metarToStation(metar({ visib })).visibilitySm).toBe(esperada);
  });
});

describe("condición derivada del METAR", () => {
  it.each([
    ["TSRA", "storm"],
    ["SQ", "storm"],
    ["BR", "fog"],
    ["FZFG", "fog"],
    ["-RA", "rain"],
    ["DZ", "rain"],
    ["SN", "rain"],
  ])("wxString %s → %s", (wxString, condition) => {
    expect(metarToStation(metar({ wxString })).condition).toBe(condition);
  });

  it("sin fenómeno, visibilidad menor a 3 millas es niebla", () => {
    expect(metarToStation(metar({ visib: "2" })).condition).toBe("fog");
  });

  it("sin fenómeno ni niebla, OVC o BKN es nublado y lo demás despejado", () => {
    expect(metarToStation(metar({ clouds: [{ cover: "OVC", base: 800 }] })).condition).toBe("cloudy");
    expect(metarToStation(metar({ clouds: [{ cover: "BKN" }] })).condition).toBe("cloudy");
    expect(metarToStation(metar({ clouds: [{ cover: "FEW" }] })).condition).toBe("clear");
    expect(metarToStation(metar()).condition).toBe("clear");
  });
});

describe("impacto derivado del METAR", () => {
  it.each([
    ["LIFR", "high"],
    ["IFR", "high"],
    ["MVFR", "medium"],
  ])("la categoría de vuelo %s manda: %s", (fltCat, impact) => {
    expect(metarToStation(metar({ fltCat, wspd: 0, visib: "10+" })).impact).toBe(impact);
  });

  it.each([
    ["tormenta", { wxString: "TS" }],
    ["visibilidad menor a 1 milla", { visib: "1/2" }],
    ["viento sostenido sobre 25 kt", { wspd: 26 }],
    ["ráfagas sobre 30 kt", { wgst: 31 }],
  ])("sin categoría, %s es impacto alto", (_caso, overrides) => {
    expect(metarToStation(metar({ fltCat: "VFR", ...overrides })).impact).toBe("high");
  });

  it.each([
    ["lluvia", { wxString: "RA" }],
    ["visibilidad menor a 5 millas", { visib: "4" }],
    ["viento sobre 15 kt", { wspd: 16 }],
  ])("sin categoría, %s es impacto medio", (_caso, overrides) => {
    expect(metarToStation(metar({ fltCat: "VFR", ...overrides })).impact).toBe("medium");
  });

  it("buen tiempo es impacto bajo", () => {
    expect(metarToStation(metar({ fltCat: "VFR", wspd: 10, visib: "10+" })).impact).toBe("low");
  });
});

describe("nombre de la estación", () => {
  it.each([
    [undefined, "KATL"],
    ["Atlanta, GA, US", "Atlanta"],
    ["Atlanta/Hartsfield-Jackson, GA", "Atlanta"],
    ["/", "KATL"],
  ])("%j → %s", (name, esperado) => {
    expect(metarToStation(metar({ name })).name).toBe(esperado);
  });
});

describe("fetchMetars", () => {
  it("pide las estaciones en JSON y devuelve el array tal cual", async () => {
    // Arrange
    awc([metar(), metar({ icaoId: "KMIA" })]);

    // Act
    const datos = await fetchMetars(["KATL", "KMIA"]);

    // Assert
    expect(datos.map((m) => m.icaoId)).toEqual(["KATL", "KMIA"]);
    const url = new URL(llamadas[0].url);
    expect(url.origin + url.pathname).toBe("https://aviationweather.gov/api/data/metar");
    expect(url.searchParams.get("ids")).toBe("KATL,KMIA");
    expect(url.searchParams.get("format")).toBe("json");
    expect(url.searchParams.get("taf")).toBe("false");
    expect((llamadas[0].init.headers as Record<string, string>).Accept).toBe("application/json");
  });

  it("sin red lanza WeatherApiError con la causa original", async () => {
    const causa = new TypeError("fetch failed");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw causa;
      }),
    );

    const promesa = fetchMetars(["KATL"]);

    await expect(promesa).rejects.toBeInstanceOf(WeatherApiError);
    await expect(fetchMetars(["KATL"])).rejects.toMatchObject({
      message: "No se pudo contactar Aviation Weather Center (fetch failed)",
      cause: causa,
    });
  });

  it("un HTTP que no es 2xx lanza con el código", async () => {
    awc("gateway timeout", 504);

    await expect(fetchMetars(["KATL"])).rejects.toMatchObject({
      name: "WeatherApiError",
      message: "AWC devolvió 504 Error",
    });
  });

  it("un cuerpo que no es JSON lanza", async () => {
    awc("<html>mantenimiento</html>");

    await expect(fetchMetars(["KATL"])).rejects.toMatchObject({
      message: "Respuesta de AWC no es JSON válido",
    });
  });

  it("un JSON que no es un array lanza", async () => {
    awc({ error: "bad ids" });

    await expect(fetchMetars(["KATL"])).rejects.toMatchObject({
      message: "Respuesta inesperada de AWC: se esperaba un array",
    });
  });

  it("cero estaciones es un error, no un mapa vacío", async () => {
    awc([]);

    await expect(fetchMetars(["KXXX"])).rejects.toMatchObject({
      message: "AWC devolvió cero estaciones — verificá los códigos ICAO",
    });
  });
});

describe("fetchWeatherStations", () => {
  it("por defecto pide la red regional de ATL y separa el METAR crudo de KATL", async () => {
    awc([metar({ icaoId: "KMIA", rawOb: "KMIA ..." }), metar()]);

    const resultado = await fetchWeatherStations();

    expect(new URL(llamadas[0].url).searchParams.get("ids")).toBe(ATL_REGIONAL_STATIONS.join(","));
    expect(resultado.requestUrl).toContain(`ids=${ATL_REGIONAL_STATIONS.join(",")}`);
    expect(resultado.stations.map((s) => s.code)).toEqual(["MIA", "ATL"]);
    expect(resultado.atlRaw).toBe("KATL 091253Z 18008KT 10SM CLR 20/10 A2992");
    expect(resultado.rawPayload).toHaveLength(2);
    expect(Number.isNaN(Date.parse(resultado.fetchedAt))).toBe(false);
  });

  it("sin KATL en la respuesta, atlRaw es null", async () => {
    awc([metar({ icaoId: "KMIA" })]);

    const resultado = await fetchWeatherStations(["KMIA"]);

    expect(resultado.atlRaw).toBeNull();
  });
});
