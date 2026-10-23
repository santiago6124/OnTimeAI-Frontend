/**
 * CP-COB-FE-22 — `SessionProvider` / `useSession`: el contexto de sesión que
 * leen las páginas. `useSession` fuera del provider tiene que fallar fuerte,
 * no devolver "sin usuario" en silencio. Se renderiza con `react-dom/server`.
 */
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SessionProvider, useSession } from "@/components/providers/session-provider";
import type { SessionUser } from "@/lib/auth-types";

function Sonda() {
  const { user } = useSession();
  return <span>{user ? `${user.username}:${user.role}` : "anónimo"}</span>;
}

function render(user: SessionUser | null, children: ReactNode = <Sonda />) {
  return renderToString(<SessionProvider user={user}>{children}</SessionProvider>);
}

describe("useSession", () => {
  it("fuera del provider lanza", () => {
    expect(() => renderToString(<Sonda />)).toThrow("useSession must be used within SessionProvider");
  });

  it("dentro del provider devuelve el usuario", () => {
    // Arrange / Act
    const html = render({ username: "ana", role: "admin", userType: "b2b" });

    // Assert
    expect(html).toBe("<span>ana:admin</span>");
  });

  it("acepta una sesión vacía", () => {
    expect(render(null)).toBe("<span>anónimo</span>");
  });
});
