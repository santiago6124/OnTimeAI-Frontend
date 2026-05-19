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
