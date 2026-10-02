/**
 * Las horas se muestran en 24 h, siempre.
 *
 * El reloj del navbar mostraba `20:05:53 UTC` mientras el detalle de vuelo
 * decía `1/10 11:59 p. m.` para el mismo huso. Dos formatos de reloj en la
 * misma pantalla.
 *
 * La causa no se ve leyendo el código: `es-AR` con `{ hour: "2-digit",
 * minute: "2-digit" }` y sin `hour12` resuelve a reloj de 12 horas. En el uso
 * cotidiano el español rioplatense escribe 23:59, pero el default de ICU para
 * estas opciones es h12, así que la llamada se lee correcta y renderiza mal.
 *
 * Por eso el test compara contra la cadena completa y no contra una expresión
 * regular laxa: lo que hay que fijar es exactamente lo que ve el usuario.
 */
import { describe, expect, it } from "vitest";

import { fmtTime, toUTCDate } from "@/lib/api";

describe("fmtTime", () => {
  it("usa reloj de 24 horas", () => {
    expect(fmtTime("2026-10-01T23:59:00")).toBe("01/10 23:59");
  });

  it("no cuela ninguna marca de a. m. / p. m.", () => {
    for (const hora of ["00:30", "09:15", "13:45", "23:59"]) {
      const salida = fmtTime(`2026-10-01T${hora}:00`);
      expect(salida).not.toMatch(/[ap]\.?\s?m\.?/i);
    }
  });

  it("la medianoche es 00:00 y no 24:00 ni 12:00 a. m.", () => {
    expect(fmtTime("2026-10-02T00:00:00")).toBe("02/10 00:00");
  });

  it("el mediodía es 12:00", () => {
    expect(fmtTime("2026-10-02T12:00:00")).toBe("02/10 12:00");
  });

  it("mantiene el formato dd/MM que pide la convención del proyecto", () => {
    // Día y mes con dos dígitos, en ese orden: `02/10`, no `10/2` ni `2/10`.
    expect(fmtTime("2026-10-02T08:05:00")).toBe("02/10 08:05");
  });

  it("interpreta la marca como UTC aunque no traiga Z", () => {
    // El backend devuelve ISO sin sufijo. Sin forzar UTC, JS lo lee como hora
    // local y en Argentina el resultado se corre tres horas.
    expect(fmtTime("2026-10-02T12:00:00")).toBe(fmtTime("2026-10-02T12:00:00Z"));
    expect(toUTCDate("2026-10-02T12:00:00").toISOString()).toBe(
      "2026-10-02T12:00:00.000Z",
    );
  });

  it("devuelve un guion para una marca vacía", () => {
    expect(fmtTime("")).toBe("--");
  });
});
