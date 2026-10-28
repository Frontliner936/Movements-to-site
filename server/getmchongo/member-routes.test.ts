import { describe, expect, it } from "vitest";
import { isValidMemberPassword } from "./member-routes";

describe("isValidMemberPassword", () => {
  it("requires six characters, uppercase, lowercase and a symbol, but not a number", () => {
    expect(isValidMemberPassword("Abcdef!")).toBe(true);
    expect(isValidMemberPassword("Abc!1")).toBe(false);
    expect(isValidMemberPassword("abcdef!")).toBe(false);
    expect(isValidMemberPassword("ABCDEF!")).toBe(false);
    expect(isValidMemberPassword("Abcdef1")).toBe(false);
    expect(isValidMemberPassword("Abcdef !")).toBe(true);
    expect(isValidMemberPassword(`Abcdef!${"x".repeat(123)}`)).toBe(false);
  });
});
