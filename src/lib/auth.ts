const TOKEN_KEY = "ontimeai-auth-token";
const COOKIE_NAME = "auth-token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  // Cookie for Next.js middleware (edge can't read localStorage)
  const maxAge = 60 * 60 * 8; // 8 hours, matches backend JWT expiry
  document.cookie = `${COOKIE_NAME}=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export type Role = "superadmin" | "admin" | "user";

function decodeJwtRole(token: string): Role {
  try {
    const part = token.split(".")[1];
    if (!part) return "user";
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { role?: string };
    const r = payload.role;
    if (r === "superadmin" || r === "admin") return r;
    return "user";
  } catch {
    return "user";
  }
}

export function getRole(): Role {
  const token = getToken();
  if (!token) return "user";
  return decodeJwtRole(token);
}

/** true for admin and superadmin */
export function isAdmin(): boolean {
  const r = getRole();
  return r === "admin" || r === "superadmin";
}

// Call only from Server Components (uses next/headers)
export async function getServerRole(): Promise<Role> {
  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    const token = store.get("auth-token")?.value;
    if (!token) return "user";
    return decodeJwtRole(token);
  } catch {
    return "user";
  }
}
