import { describe, expect, it } from "vitest";
import { requireSameOrigin } from "./auth";

describe("Get Mchongo administrator request origin guard", () => {
  it("rejects a missing Origin header instead of allowing a cookie-authenticated mutation", () => {
    let statusCode = 200;
    let responseBody: unknown;
    const req = { get: () => undefined } as any;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(body: unknown) { responseBody = body; return this; },
    } as any;
    expect(requireSameOrigin(req, res)).toBe(false);
    expect(statusCode).toBe(403);
    expect(responseBody).toMatchObject({ error: "Request origin is required." });
  });
});
