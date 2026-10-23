/**
 * CP-COB-FE-12 — `src/lib/contacto.ts`: los canales públicos que las tiendas
 * exigen tienen que derivar del mismo repositorio y la fecha de la política
 * tiene que ser una fecha.
 */
import { describe, expect, it } from "vitest";

import { ISSUES_URL, PRIVACIDAD_ACTUALIZADA, REPO_URL } from "@/lib/contacto";

describe("contacto", () => {
  it("las issues cuelgan del repositorio público", () => {
    expect(REPO_URL).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/);
    expect(ISSUES_URL).toBe(`${REPO_URL}/issues`);
  });

  it("la fecha de la política es ISO y no está en el futuro", () => {
    expect(PRIVACIDAD_ACTUALIZADA).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Date.parse(PRIVACIDAD_ACTUALIZADA)).toBeLessThanOrEqual(Date.now());
  });
});
