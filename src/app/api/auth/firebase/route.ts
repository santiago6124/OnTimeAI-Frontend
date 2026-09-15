/**
 * Cambia un ID token de Firebase por la sesión propia.
 *
 * Espeja al handler de Google: el token de Firebase se valida del lado del
 * backend, que devuelve un JWT nuestro y lo deja en una cookie HttpOnly. El
 * token de Firebase no se guarda: sirve una sola vez para probar quién es.
 */
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

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Solicitud inválida" }, { status: 400 });
  }

  const { id_token: idToken } = (body ?? {}) as { id_token?: unknown };
  if (typeof idToken !== "string" || !idToken) {
    return NextResponse.json({ detail: "Falta el token" }, { status: 400 });
  }

  try {
    const exchanged = await fetch(`${BACKEND}/auth/firebase`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: idToken }),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = (await exchanged.json().catch(() => ({}))) as {
      access_token?: string;
      user_type?: unknown;
      is_new_user?: boolean;
      detail?: string;
    };
    if (!exchanged.ok || !payload.access_token) {
      // El 403 de "falta verificar el correo" tiene que llegar tal cual: es
      // accionable y distinto de un token inválido.
      return NextResponse.json(
        { detail: payload.detail ?? "No se pudo iniciar sesión" },
        { status: exchanged.status || 401 },
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

    const userType = isUserType(payload.user_type) ? payload.user_type : null;
    const response = NextResponse.json({
      username: user.username,
      role: user.role,
      userType,
      isNewUser: payload.is_new_user === true || userType === null,
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
