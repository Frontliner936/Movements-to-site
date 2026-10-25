import { describe, expect, it } from "vitest";
import { hashMemberPassword, verifyMemberPassword } from "./member-auth";

describe("member password storage", () => {
  it("uses a unique salt for each credential and verifies without storing plaintext", async () => {
    const password = "a-long-random-test-password-123";
    const first = await hashMemberPassword(password);
    const second = await hashMemberPassword(password);
    expect(first.salt).not.toBe(second.salt);
    expect(first.hash).not.toBe(password);
    expect(first.hash).not.toBe(second.hash);
    await expect(verifyMemberPassword(password, first.salt, first.hash)).resolves.toBe(true);
    await expect(verifyMemberPassword("incorrect-password", first.salt, first.hash)).resolves.toBe(false);
  });
});
