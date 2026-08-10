import { describe, expect, it } from "vitest";

import { safeReturnPath } from "@/lib/auth-types";

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
