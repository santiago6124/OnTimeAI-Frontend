/**
 * CP-COB-FE-23 — `ProfileProvider` / `useProfile`: qué perfil ve cada rol y
 * quién puede pisarlo.
 *
 * Lo que garantiza: para un usuario común manda el tipo de la cuenta (y sin
 * tipo, pasajero); admin y superadmin arrancan en aerolínea si la cuenta no
 * dice otra cosa; `setProfile` no hace nada para quien no puede elegir, y
 * para quien sí escribe la cookie que lee el servidor y recarga; `null`
 * borra el override. Se renderiza con `react-dom/server`: el snapshot del
 * servidor no tiene override, que es lo que ve el primer render.
 */
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PROFILES, ProfileProvider, useProfile } from "@/components/providers/profile-provider";
import { SessionProvider } from "@/components/providers/session-provider";
import type { SessionUser } from "@/lib/auth-types";

type Perfil = ReturnType<typeof useProfile>;

function capturar(user: SessionUser | null) {
  const caja: { valor?: Perfil } = {};
  function Sonda() {
    caja.valor = useProfile();
    return null;
  }
  renderToString(
    <SessionProvider user={user}>
      <ProfileProvider>
        <Sonda />
      </ProfileProvider>
    </SessionProvider>,
  );
  return caja.valor as Perfil;
}

/** Lo mínimo de navegador que `setProfile` toca: la cookie y la recarga. */
function navegador() {
  const documento = { cookie: "" };
  const reload = vi.fn();
  vi.stubGlobal("document", documento);
  vi.stubGlobal("window", { location: { reload } });
  return { documento, reload };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useProfile", () => {
  it("fuera del provider lanza", () => {
    function Sonda() {
      useProfile();
      return null;
    }
    expect(() => renderToString(<Sonda />)).toThrow("useProfile must be used within ProfileProvider");
  });

  it("PROFILES ofrece exactamente los dos perfiles", () => {
    expect(PROFILES.map((p) => p.id)).toEqual(["airline", "passenger"]);
  });
});

describe("perfil según la cuenta", () => {
  it.each([
    ["usuario de operaciones", { username: "a", role: "user", userType: "b2b" }, "airline", "airline"],
    ["usuario viajero", { username: "a", role: "user", userType: "b2c" }, "passenger", "passenger"],
    ["usuario sin tipo", { username: "a", role: "user", userType: null }, "passenger", null],
    ["admin sin tipo", { username: "a", role: "admin", userType: null }, "airline", null],
    ["superadmin viajero", { username: "a", role: "superadmin", userType: "b2c" }, "passenger", "passenger"],
  ] as Array<[string, SessionUser, string, string | null]>)(
    "%s ve %s",
    (_caso, user, profile, accountProfile) => {
      // Act
      const perfil = capturar(user);

      // Assert
      expect(perfil.profile).toBe(profile);
      expect(perfil.accountProfile).toBe(accountProfile);
      expect(perfil.overridden).toBe(false);
    },
  );

  it("sin sesión es pasajero", () => {
    expect(capturar(null).profile).toBe("passenger");
  });
});

describe("setProfile", () => {
  it("para un usuario común no hace nada: ni cookie ni recarga", () => {
    const perfil = capturar({ username: "a", role: "user", userType: "b2c" });
    const { documento, reload } = navegador();

    perfil.setProfile("airline");

    expect(documento.cookie).toBe("");
    expect(reload).not.toHaveBeenCalled();
  });

  it("para un admin escribe la cookie por un año y recarga", () => {
    const perfil = capturar({ username: "a", role: "admin", userType: "b2b" });
    const { documento, reload } = navegador();

    perfil.setProfile("passenger");

    expect(documento.cookie).toBe("ontimeai-profile=passenger; path=/; max-age=31536000; samesite=lax");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("null borra el override con una fecha pasada", () => {
    const perfil = capturar({ username: "a", role: "superadmin", userType: null });
    const { documento, reload } = navegador();

    perfil.setProfile(null);

    expect(documento.cookie).toBe("ontimeai-profile=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax");
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
