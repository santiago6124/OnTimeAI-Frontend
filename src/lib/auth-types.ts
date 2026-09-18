import { LIVE_ENABLED } from "@/lib/mobile-env";

export type Role = "superadmin" | "admin" | "user";

/**
 * Product segment stored on the account: operations (B2B) or traveller (B2C).
 * The UI calls these "airline" and "passenger"; see profileIdForUserType.
 */
export type UserType = "b2b" | "b2c";

export type SessionUser = {
  username: string;
  role: Role;
  userType?: UserType | null;
};

export const AUTH_COOKIE_NAME = "auth-token";
export const AUTH_MAX_AGE_SECONDS = 60 * 60 * 8;

export function isRole(value: unknown): value is Role {
  return value === "superadmin" || value === "admin" || value === "user";
}

export function isUserType(value: unknown): value is UserType {
  return value === "b2b" || value === "b2c";
}

/** Bridge between the API vocabulary (b2b/b2c) and the UI profiles. */
export function profileIdForUserType(
  userType: UserType,
): "airline" | "passenger" {
  return userType === "b2b" ? "airline" : "passenger";
}

export function userTypeForProfileId(
  profile: "airline" | "passenger",
): UserType {
  return profile === "airline" ? "b2b" : "b2c";
}

/**
 * Landing page for each profile: travellers get the lite view, operators the
 * dashboard. In the bundled app /live does not exist (see LIVE_ENABLED), so
 * travellers land on the dashboard there — a redirect to a missing route would
 * hydrate into the 404 page right after logging in.
 */
export function homePathFor(userType: UserType | null | undefined): string {
  return userType === "b2c" && LIVE_ENABLED ? "/live" : "/";
}

/** Only allow same-origin application paths after authentication. */
export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
