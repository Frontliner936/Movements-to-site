import { afterEach, describe, expect, it, vi } from "vitest";
import { ADMIN_EMAIL, isAdmin, requireSameOrigin } from "./auth";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function requestWithBearer(token = "test-access-token") {
  return {
    get(name: string) {
      return name.toLowerCase() === "authorization" ? `Bearer ${token}` : undefined;
    },
  } as any;
}

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

describe("Supabase administrator identity verification", () => {
  it("allows only a verified Supabase account matching the configured admin email", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "user-1",
          email: ADMIN_EMAIL.toUpperCase(),
          email_confirmed_at: "2026-01-01T00:00:00.000Z",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetcher);

    await expect(isAdmin(requestWithBearer())).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledWith(
      "https://example.supabase.co/auth/v1/user",
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: "sb_publishable_test",
          authorization: "Bearer test-access-token",
        }),
      })
    );
  });

  it("rejects unverified users and users with any other email", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: "user-1", email: ADMIN_EMAIL, email_confirmed_at: null }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "user-2",
            email: "someone@example.com",
            email_confirmed_at: "2026-01-01T00:00:00.000Z",
          }),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetcher);

    await expect(isAdmin(requestWithBearer())).resolves.toBe(false);
    await expect(isAdmin(requestWithBearer())).resolves.toBe(false);
  });

  it("fails closed when the Supabase environment or bearer token is missing", async () => {
    await expect(isAdmin(requestWithBearer())).resolves.toBe(false);

    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    await expect(isAdmin(requestWithBearer(""))).resolves.toBe(false);
  });
});
