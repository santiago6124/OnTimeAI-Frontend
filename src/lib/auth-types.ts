export type Role = "superadmin" | "admin" | "user";

export type SessionUser = {
  username: string;
  role: Role;
};

export const AUTH_COOKIE_NAME = "auth-token";
export const AUTH_MAX_AGE_SECONDS = 60 * 60 * 8;

export function isRole(value: unknown): value is Role {
  return value === "superadmin" || value === "admin" || value === "user";
}

/** Only allow same-origin application paths after authentication. */
export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
