/**
 * Alta propia con correo y contraseña.
 *
 * Espeja al handler de Google y no al de login: los dos crean una cuenta nueva
 * y tienen que mandar al onboarding, mientras que el login entra a una que ya
 * existe.
 *
 * Igual que los otros, el token nunca llega al navegador: viaja en una cookie
 * HttpOnly que el cliente no puede leer.
 */
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Solicitud inválida" }, { status: 400 });
  }

  const { email, password } = (body ?? {}) as {
    email?: unknown;
    password?: unknown;
  };
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { detail: "Faltan el correo o la contraseña" },
      { status: 400 },
    );
  }

  try {
    const created = await fetch(`${BACKEND}/auth/register`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = (await created.json().catch(() => ({}))) as {
      access_token?: string;
      detail?: string;
    };
    if (!created.ok || !payload.access_token) {
      // Se reenvía el mensaje del backend tal cual: distingue "ya existe una
      // cuenta con ese correo" de "la contraseña es corta", y esa diferencia
      // es la que necesita quien está en el formulario.
      return NextResponse.json(
        { detail: payload.detail ?? "No se pudo crear la cuenta" },
        { status: created.status || 400 },
      );
    }

    const me = await fetch(`${BACKEND}/auth/me`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${payload.access_token}` },
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
      userType: null,
      isNewUser: true,
    });
    response.cookies.set(AUTH_COOKIE_NAME, payload.access_token, {
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
