import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeRedirectPath("/expenses?page=2")).toBe("/expenses?page=2");
  });

  it.each([null, undefined, "", "https://evil.example", "//evil.example", "/\\evil.example", "expenses"])(
    "falls back for %s",
    (value) => {
      expect(safeRedirectPath(value)).toBe("/");
    },
  );
});
