/**
 * Horarios que ve el viajero en el detalle de un vuelo.
 *
 * El caso que motivó esto: un vuelo demorado sin `estimated_in_utc` mostraba la
 * llegada programada, que quedaba antes de la salida estimada.
 */
import { describe, expect, it } from "vitest";

import { toUTCDate } from "@/lib/api";
import { llegadaEstimada, salidaEstimada } from "@/lib/horarios-viajero";

// DL2250 del 12/11/2026: programado 18:50 → 21:17, salida estimada 22:22.
const DL2250 = {
  scheduled_out_utc: "2026-11-12T18:50:00+00:00",
  estimated_out_utc: "2026-11-12T22:22:00+00:00",
  scheduled_in_utc: "2026-11-12T21:17:00+00:00",
  estimated_in_utc: null as unknown as string,
};

describe("salidaEstimada", () => {
  it("devuelve la estimada cuando el vuelo se corrió", () => {
    expect(salidaEstimada(DL2250)).toBe(DL2250.estimated_out_utc);
  });

  it("no la muestra si el corrimiento es de un minuto o menos", () => {
    const enHorario = { ...DL2250, estimated_out_utc: "2026-11-12T18:51:00+00:00" };
    expect(salidaEstimada(enHorario)).toBeNull();
  });

  it("no la muestra si falta la salida estimada o la programada", () => {
    expect(salidaEstimada({ ...DL2250, estimated_out_utc: "" })).toBeNull();
    expect(salidaEstimada({ ...DL2250, scheduled_out_utc: "" })).toBeNull();
  });
});

describe("llegadaEstimada", () => {
  it("usa la estimada de la fuente cuando existe", () => {
    const conEstimada = { ...DL2250, estimated_in_utc: "2026-11-13T00:40:00+00:00" };
    expect(llegadaEstimada(conEstimada)).toEqual({
      hora: "2026-11-13T00:40:00+00:00",
      proyectada: false,
    });
  });

  it("sin estimada de llegada, proyecta la programada con la demora de salida", () => {
    const { hora, proyectada } = llegadaEstimada(DL2250);
    expect(proyectada).toBe(true);
    // 21:17 + 3 h 32 min de demora = 00:49 del día siguiente.
    expect(hora).toBe("2026-11-13T00:49:00.000Z");
  });

  it("la llegada nunca queda antes de la salida", () => {
    const { hora } = llegadaEstimada(DL2250);
    expect(toUTCDate(hora as string).getTime()).toBeGreaterThan(
      toUTCDate(DL2250.estimated_out_utc).getTime(),
    );
  });

  it("sin demora de salida no inventa una estimación", () => {
    const enHorario = { ...DL2250, estimated_out_utc: DL2250.scheduled_out_utc };
    expect(llegadaEstimada(enHorario)).toEqual({ hora: null, proyectada: false });
  });

  it("sin llegada programada no puede proyectar", () => {
    expect(llegadaEstimada({ ...DL2250, scheduled_in_utc: "" })).toEqual({
      hora: null,
      proyectada: false,
    });
  });
});
