import { describe, expect, it } from "vitest";

import { toUTCDate } from "@/lib/api";

/**
 * Réplica de las reglas del SystemHealthCard. Se testean acá porque son la
 * parte del componente que puede fallar en silencio: un umbral mal puesto
 * muestra "Normal" sobre una base que ya está en problemas.
 */
function storageStatus(sizeMb: number) {
  if (sizeMb >= 1500) return "red";
  if (sizeMb >= 100) return "amber";
  return "green";
}

const STALE_AFTER_MIN = 30;

function isStale(last: string, now: number) {
  return (now - toUTCDate(last).getTime()) / 60_000 > STALE_AFTER_MIN;
}

describe("storageStatus", () => {
  it("marks a small database as healthy", () => {
    expect(storageStatus(0)).toBe("green");
    expect(storageStatus(99.9)).toBe("green");
  });

  it("warns from 100 MB onwards", () => {
    expect(storageStatus(100)).toBe("amber");
    // Tamaño real medido en producción el 2026-09-04.
    expect(storageStatus(710.21)).toBe("amber");
    expect(storageStatus(1499)).toBe("amber");
  });

  it("escalates past the 1.5 GB mark", () => {
    expect(storageStatus(1500)).toBe("red");
    expect(storageStatus(2100)).toBe("red");
  });
});

describe("isStale", () => {
  const now = Date.parse("2026-09-04T17:00:00Z");

  it("accepts a prediction from the current cycle", () => {
    expect(isStale("2026-09-04T16:50:00+00:00", now)).toBe(false);
  });

  it("flags a gap longer than two pipeline cycles", () => {
    expect(isStale("2026-09-04T16:20:00+00:00", now)).toBe(true);
  });

  it("reads offset timestamps as UTC, not local time", () => {
    // El backend serializa con "+00:00". Si se interpretara como hora local,
    // en Argentina (UTC-3) daría 3 horas de diferencia y todo saldría vencido.
    expect(isStale("2026-09-04T16:45:00+00:00", now)).toBe(false);
  });
});
