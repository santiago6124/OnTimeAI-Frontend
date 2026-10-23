/**
 * CP-COB-FE-24 — `NativeSessionGate`: mientras la sesión no está resuelta no
 * monta a los hijos. Si los montara, cada página dispararía sus fetch con el
 * token todavía sin leer del almacenamiento nativo y cobraría 401 en el
 * arranque. Se renderiza con `react-dom/server`, donde los efectos no corren:
 * es exactamente el estado "resolviendo".
 */
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { NativeSessionGate } from "@/components/providers/native-session-provider";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));

describe("NativeSessionGate", () => {
  it("mientras resuelve dibuja un fondo y no a los hijos", () => {
    // Act
    const html = renderToString(
      createElement(NativeSessionGate, null, createElement("main", null, "contenido privado")),
    );

    // Assert
    expect(html).not.toContain("contenido privado");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("min-h-screen");
  });
});
