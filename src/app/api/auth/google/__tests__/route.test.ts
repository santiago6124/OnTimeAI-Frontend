import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/auth/google/route";
import { AUTH_COOKIE_NAME } from "@/lib/auth-types";

const TOKEN = "header.payload.signature";

function request(body: unknown) {
  return new Request("http://localhost:3000/api/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Stub the two Backend calls the handler makes: the exchange, then /auth/me. */
function stubBackend(options: {
  exchange: { status: number; body: unknown };
  me?: { status: number; body: unknown };
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL) => {
      const href = String(url);
      if (href.endsWith("/auth/google")) {
        return new Response(JSON.stringify(options.exchange.body), {
          status: options.exchange.status,
        });
      }
      const me = options.me ?? { status: 200, body: {} };
      return new Response(JSON.stringify(me.body), { status: me.status });
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/auth/google", () => {
  it("rejects a body that is not JSON", async () => {
    const response = await POST(request("no-json"));
    expect(response.status).toBe(400);
  });

  it.each([{}, { id_token: "" }, { id_token: 42 }])(
    "rejects a missing id_token (%j)",
    async (body) => {
      const response = await POST(request(body));
      expect(response.status).toBe(400);
    },
  );

  it("propagates the Backend rejection instead of masking it", async () => {
    stubBackend({
      exchange: { status: 401, body: { detail: "ID token de Google inválido" } },
    });
    const response = await POST(request({ id_token: TOKEN }));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      detail: "ID token de Google inválido",
    });
  });

  it("sets an HttpOnly session cookie on success", async () => {
    stubBackend({
      exchange: {
        status: 200,
        body: { access_token: "jwt-123", user_type: "b2b", is_new_user: false },
      },
      me: { status: 200, body: { username: "a@b.com", role: "user" } },
    });

    const response = await POST(request({ id_token: TOKEN }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      username: "a@b.com",
      role: "user",
      userType: "b2b",
      isNewUser: false,
    });

    const cookie = response.cookies.get(AUTH_COOKIE_NAME);
    expect(cookie?.value).toBe("jwt-123");
    expect(cookie?.httpOnly).toBe(true);
  });

  it("flags onboarding when the account has no profile yet", async () => {
    stubBackend({
      exchange: {
        status: 200,
        body: { access_token: "jwt-123", user_type: null, is_new_user: true },
      },
      me: { status: 200, body: { username: "a@b.com", role: "user" } },
    });

    const response = await POST(request({ id_token: TOKEN }));
    await expect(response.json()).resolves.toMatchObject({
      userType: null,
      isNewUser: true,
    });
  });

  it("treats a returning account without a profile as pending onboarding", async () => {
    stubBackend({
      exchange: {
        status: 200,
        body: { access_token: "jwt-123", user_type: null, is_new_user: false },
      },
      me: { status: 200, body: { username: "a@b.com", role: "user" } },
    });

    const response = await POST(request({ id_token: TOKEN }));
    await expect(response.json()).resolves.toMatchObject({ isNewUser: true });
  });

  it("refuses a session the Backend cannot describe", async () => {
    stubBackend({
      exchange: { status: 200, body: { access_token: "jwt-123" } },
      me: { status: 200, body: { username: "a@b.com", role: "wizard" } },
    });

    const response = await POST(request({ id_token: TOKEN }));
    expect(response.status).toBe(502);
  });
});
