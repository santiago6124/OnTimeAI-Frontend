import { describe, expect, it } from "vitest";

import { flightToTrack } from "@/hooks/use-real-flight-tracks";
import type { Flight } from "@/lib/api";

function flight(overrides: Partial<Flight> = {}): Flight {
  return {
    fa_flight_id: "DAL100-1",
    flight_number: "DL 100",
    airline_code: "DL",
    origin: "ATL",
    destination: "MIA",
    scheduled_out_utc: "2026-08-09T10:00:00Z",
    scheduled_in_utc: "2026-08-09T12:00:00Z",
    estimated_out_utc: "2026-08-09T10:00:00Z",
    estimated_in_utc: "2026-08-09T12:00:00Z",
    actual_out_utc: null,
    actual_off_utc: null,
    actual_on_utc: null,
    actual_in_utc: null,
    aircraft_type: "A320",
    risk: "medium",
    delay_probability: 0.22,
    predicted_delay: 0,
    predicted_at_utc: "2026-08-09T09:45:00Z",
    has_actual: false,
    arr_delay_min: null,
    departure_delay_min: null,
    ...overrides,
  };
}

describe("flightToTrack", () => {
  it("keeps an undeparted flight at its origin", () => {
    const track = flightToTrack(flight(), Date.parse("2026-08-09T11:00:00Z"));
    expect(track).not.toBeNull();
    expect(track?.isDeparted).toBe(false);
    expect(track?.progress).toBe(0);
    expect(track?.currentLat).toBeCloseTo(track?.originLat ?? 0);
    expect(track?.currentLng).toBeCloseTo(track?.originLng ?? 0);
  });

  it("interpolates progress only after a confirmed departure", () => {
    const track = flightToTrack(
      flight({ actual_out_utc: "2026-08-09T10:00:00Z", departure_delay_min: 0 }),
      Date.parse("2026-08-09T11:00:00Z"),
    );
    expect(track?.progress).toBeCloseTo(0.5);
  });

  it("uses wheels-up when the provider has no gate-out timestamp", () => {
    const track = flightToTrack(
      flight({ actual_off_utc: "2026-08-09T10:10:00Z", departure_delay_min: 10 }),
      Date.parse("2026-08-09T11:05:00Z"),
    );
    expect(track?.isDeparted).toBe(true);
    expect(track?.progress).toBeCloseTo(0.5);
  });
});
