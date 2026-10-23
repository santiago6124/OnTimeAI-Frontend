/**
 * CP-COB-FE-19 — `useIsMobile`: en el servidor no hay `matchMedia`, así que el
 * snapshot del servidor tiene que ser "escritorio" sin tocar `window`. Se
 * renderiza con `react-dom/server`, que es lo único que corre en este entorno.
 */
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { useIsMobile } from "@/hooks/use-mobile";

function Sonda() {
  return createElement("span", null, String(useIsMobile()));
}

describe("useIsMobile en el servidor", () => {
  it("dibuja escritorio sin consultar matchMedia", () => {
    // Arrange: no hay `window` en este entorno.
    expect(typeof window).toBe("undefined");

    // Act
    const html = renderToString(createElement(Sonda));

    // Assert
    expect(html).toBe("<span>false</span>");
  });
});
