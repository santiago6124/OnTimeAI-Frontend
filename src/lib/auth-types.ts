
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

/** Only allow same-origin application paths after authentication. */
export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
