import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import {
  AUTH_COOKIE_NAME,
  isRole,
  type Role,
  type SessionUser,
} from "@/lib/auth-types";

const BACKEND =
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

export async function getServerToken(): Promise<string | null> {
  return (await cookies()).get(AUTH_COOKIE_NAME)?.value ?? null;
}

/** Verify the browser token with the Backend, which remains the auth authority. */
export const getVerifiedSession = cache(async (): Promise<SessionUser | null> => {
  const token = await getServerToken();
  if (!token) return null;

  try {
    const response = await fetch(`${BACKEND}/auth/me`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as Partial<SessionUser>;
    if (typeof payload.username !== "string" || !isRole(payload.role)) return null;
    return { username: payload.username, role: payload.role };
  } catch {
    return null;
  }
});

export async function getServerRole(): Promise<Role> {
  return (await getVerifiedSession())?.role ?? "user";
}
