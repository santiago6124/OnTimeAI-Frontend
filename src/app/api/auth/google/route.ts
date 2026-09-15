import { NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  AUTH_MAX_AGE_SECONDS,
  isRole,
  isUserType,
  type SessionUser,
} from "@/lib/auth-types";

const BACKEND =
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

/** Exchange a Google ID token for our session cookie. The Backend stays the auth authority. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Solicitud inválida" }, { status: 400 });
  }

  const idToken = (body as { id_token?: unknown } | null)?.id_token;
  if (typeof idToken !== "string" || !idToken) {
    return NextResponse.json(
      { detail: "Falta el token de Google" },
      { status: 400 },
    );
  }

  try {
    const exchange = await fetch(`${BACKEND}/auth/google`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: idToken }),
      signal: AbortSignal.timeout(10_000),
    });
    const exchanged = (await exchange.json().catch(() => ({}))) as {
      access_token?: string;
      user_type?: unknown;
      is_new_user?: boolean;
      detail?: string;
    };
    if (!exchange.ok || !exchanged.access_token) {
      return NextResponse.json(
        { detail: exchanged.detail ?? "No se pudo validar la cuenta de Google" },
        { status: exchange.status || 401 },
      );
    }

    const me = await fetch(`${BACKEND}/auth/me`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${exchanged.access_token}` },
      signal: AbortSignal.timeout(10_000),
    });
    const user = (await me.json().catch(() => ({}))) as Partial<SessionUser>;
    if (!me.ok || typeof user.username !== "string" || !isRole(user.role)) {
      return NextResponse.json(
        { detail: "No se pudo validar la sesión" },
        { status: 502 },
      );
    }

    const userType = isUserType(exchanged.user_type) ? exchanged.user_type : null;
    const response = NextResponse.json({
      username: user.username,
      role: user.role,
      userType,
      isNewUser: exchanged.is_new_user === true || userType === null,
    });
    response.cookies.set(AUTH_COOKIE_NAME, exchanged.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: AUTH_MAX_AGE_SECONDS,
      path: "/",
      priority: "high",
    });
    return response;
  } catch {
    return NextResponse.json(
      { detail: "El servicio de autenticación no está disponible" },
      { status: 503 },
    );
  }
}
