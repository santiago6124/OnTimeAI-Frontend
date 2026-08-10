import { describe, expect, it } from "vitest";

import { metarToStation, type AwcMetar } from "@/lib/weather-api";

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
});
