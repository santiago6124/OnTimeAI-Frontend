import { describe, expect, it } from "vitest";

import type { Flight } from "@/lib/api";
import {
  computeOperationalImpact,
  formatMinutes,
} from "@/lib/operational-impact";

const NOW = Date.parse("2026-09-04T12:00:00Z");

function flight(overrides: Partial<Flight> = {}): Flight {
  return {
    fa_flight_id: "DAL100-1",
    flight_number: "DL100",
    airline_code: "DL",
    origin: "ATL",
    destination: "MIA",
    scheduled_out_utc: "2026-09-04T13:00:00+00:00",
    scheduled_in_utc: "2026-09-04T15:00:00+00:00",
    estimated_out_utc: "2026-09-04T13:00:00+00:00",
    estimated_in_utc: "2026-09-04T15:00:00+00:00",
    actual_out_utc: null,
    actual_off_utc: null,
    actual_on_utc: null,
    actual_in_utc: null,
    aircraft_type: "A320",
    risk: "low",
    delay_probability: 0.1,
    predicted_delay: 0,
    predicted_at_utc: "2026-09-04T11:45:00+00:00",
    has_actual: false,
    arr_delay_min: null,
    departure_delay_min: null,
    ...overrides,
  };
}

describe("computeOperationalImpact", () => {
  it("adds probabilities of pending flights into an expected count", () => {
    const impact = computeOperationalImpact(
      [
        flight({ delay_probability: 0.8 }),
        flight({ delay_probability: 0.5 }),
        flight({ delay_probability: 0.2 }),
      ],
      NOW,
    );
    expect(impact.notDeparted).toBe(3);
    expect(impact.expectedDelays).toBeCloseTo(1.5);
  });

  it("excludes flights that already departed", () => {
    const impact = computeOperationalImpact(
      [
        flight({ delay_probability: 0.9, actual_out_utc: "2026-09-04T11:00:00+00:00" }),
        flight({ delay_probability: 0.9, actual_off_utc: "2026-09-04T11:05:00+00:00" }),
        flight({ delay_probability: 0.4 }),
      ],
      NOW,
    );
    expect(impact.notDeparted).toBe(1);
    expect(impact.expectedDelays).toBeCloseTo(0.4);
  });

  it("takes the median of observed delays, not the mean", () => {
    // Media = 145, mediana = 30. La cola larga no debe inflar el total.
    const landed = [20, 30, 40, 490].map((min) =>
      flight({ has_actual: true, arr_delay_min: min, actual_out_utc: "2026-09-04T09:00:00+00:00" }),
    );
    const impact = computeOperationalImpact(
      [...landed, flight({ delay_probability: 1 })],
      NOW,
    );
    expect(impact.medianDelayMin).toBe(35);
    expect(impact.anticipatedMinutes).toBeCloseTo(35);
  });

  it("ignores landed flights that were not actually delayed", () => {
    const impact = computeOperationalImpact(
      [
        flight({ has_actual: true, arr_delay_min: -12, actual_out_utc: "2026-09-04T09:00:00+00:00" }),
        flight({ has_actual: true, arr_delay_min: 4, actual_out_utc: "2026-09-04T09:00:00+00:00" }),
        flight({ has_actual: true, arr_delay_min: 60, actual_out_utc: "2026-09-04T09:00:00+00:00" }),
      ],
      NOW,
    );
    expect(impact.actualsSampleSize).toBe(1);
    expect(impact.medianDelayMin).toBe(60);
  });

  it("reports no estimate until there are actuals to anchor it", () => {
    const impact = computeOperationalImpact([flight({ delay_probability: 0.9 })], NOW);
    expect(impact.medianDelayMin).toBeNull();
    expect(impact.anticipatedMinutes).toBeNull();
  });

  it("counts only high-risk departures still inside the action window", () => {
    const impact = computeOperationalImpact(
      [
        // Riesgo alto dentro de la ventana: cuenta.
        flight({ risk: "high", estimated_out_utc: "2026-09-04T13:00:00+00:00" }),
        // Riesgo alto pero sale en 4 h: fuera de la ventana.
        flight({ risk: "high", estimated_out_utc: "2026-09-04T16:00:00+00:00" }),
        // Dentro de la ventana pero riesgo bajo.
        flight({ risk: "low", estimated_out_utc: "2026-09-04T13:00:00+00:00" }),
        // Riesgo alto con salida ya pasada: ya no es accionable.
        flight({ risk: "high", estimated_out_utc: "2026-09-04T11:00:00+00:00" }),
      ],
      NOW,
    );
    expect(impact.actionableFlights).toBe(1);
  });

  it("reads offset timestamps as UTC", () => {
    // Con "+00:00" interpretado como hora local, en Argentina el vuelo
    // aparecería 3 h corrido y saldría de la ventana.
    const impact = computeOperationalImpact(
      [flight({ risk: "high", estimated_out_utc: "2026-09-04T13:30:00+00:00" })],
      NOW,
    );
    expect(impact.actionableFlights).toBe(1);
  });

  it("survives an empty payload", () => {
    const impact = computeOperationalImpact([], NOW);
    expect(impact).toMatchObject({
      notDeparted: 0,
      expectedDelays: 0,
      medianDelayMin: null,
      anticipatedMinutes: null,
      actionableFlights: 0,
    });
  });
});

describe("formatMinutes", () => {
  it("keeps sub-hour totals in minutes", () => {
    expect(formatMinutes(0)).toBe("0 min");
    expect(formatMinutes(45.4)).toBe("45 min");
  });

  it("splits longer totals into hours and minutes", () => {
    expect(formatMinutes(60)).toBe("1 h 00 m");
    expect(formatMinutes(2545)).toBe("42 h 25 m");
  });
});
