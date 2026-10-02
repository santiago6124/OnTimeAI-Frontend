import { describe, expect, it } from "vitest";

import {
  isUserType,
  profileIdForUserType,
  safeReturnPath,
  userTypeForProfileId,
} from "@/lib/auth-types";

describe("safeReturnPath", () => {
  it("accepts same-origin application paths", () => {
    expect(safeReturnPath("/flights?risk=high")).toBe("/flights?risk=high");
  });

  it.each([
    "https://evil.example/path",
    "//evil.example/path",
    "javascript:alert(1)",
    "flights",
    "",
    null,
  ])("rejects unsafe return path %s", (value) => {
    expect(safeReturnPath(value)).toBe("/");
  });
});

describe("isUserType", () => {
  it.each(["b2b", "b2c"])("accepts %s", (value) => {
    expect(isUserType(value)).toBe(true);
  });

  it.each(["airline", "passenger", "", null, undefined, 1])(
    "rejects %s",
    (value) => {
      expect(isUserType(value)).toBe(false);
    },
  );
});

describe("profile mapping", () => {
  it("maps the API vocabulary to the UI profiles", () => {
    expect(profileIdForUserType("b2b")).toBe("airline");
    expect(profileIdForUserType("b2c")).toBe("passenger");
  });

  it.each(["b2b", "b2c"] as const)("round-trips %s", (userType) => {
    expect(userTypeForProfileId(profileIdForUserType(userType))).toBe(userType);
  });
});

