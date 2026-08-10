import { NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  AUTH_MAX_AGE_SECONDS,
  isRole,
  type SessionUser,
} from "@/lib/auth-types";

const BACKEND =
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

export async function POST(request: Request) {
  let credentials: unknown;
  try {
    credentials = await request.json();
  } catch {
    return NextResponse.json({ detail: "Solicitud inválida" }, { status: 400 });
  }

  try {
    const login = await fetch(`${BACKEND}/auth/login`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
      signal: AbortSignal.timeout(10_000),
    });
    const loginBody = (await login.json().catch(() => ({}))) as {
      access_token?: string;
      detail?: string;
    };
    if (!login.ok || !loginBody.access_token) {
      return NextResponse.json(
        { detail: loginBody.detail ?? "Credenciales incorrectas" },
        { status: login.status || 401 },
      );
    }

    const me = await fetch(`${BACKEND}/auth/me`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${loginBody.access_token}` },
      signal: AbortSignal.timeout(10_000),
    });
    const user = (await me.json().catch(() => ({}))) as Partial<SessionUser>;
    if (!me.ok || typeof user.username !== "string" || !isRole(user.role)) {
      return NextResponse.json(
        { detail: "No se pudo validar la sesión" },
        { status: 502 },
      );
    }

    const response = NextResponse.json({
      username: user.username,
      role: user.role,
    });
    response.cookies.set(AUTH_COOKIE_NAME, loginBody.access_token, {
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
