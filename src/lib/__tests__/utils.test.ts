/**
 * CP-COB-FE-10 — `cn()`: combina clases condicionales y deja que
 * tailwind-merge resuelva los conflictos a favor de la última.
 */
import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("ignora falsos y nulos y aplana arrays y objetos", () => {
    expect(cn("a", false, null, undefined, ["b", { c: true, d: false }])).toBe("a b c");
  });

  it("ante dos utilidades de Tailwind en conflicto gana la última", () => {
    expect(cn("p-2 text-sm", "p-4")).toBe("text-sm p-4");
  });

  it("sin argumentos devuelve vacío", () => {
    expect(cn()).toBe("");
  });
});
