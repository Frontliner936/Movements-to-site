import type { NextFunction, Request, Response } from "express";

export const ADMIN_EMAIL = "frontlinertech@gmail.com";

type SupabaseUser = {
  id?: string;
  email?: string;
  email_confirmed_at?: string | null;
};

function supabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    "";
  if (!url || !publishableKey) return null;

  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" &&
      !(parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))
    ) {
      return null;
    }
    return { url: parsed.origin, publishableKey };
  } catch {
    return null;
  }
}

export async function getSupabaseUser(
  req: Request,
  fetcher: typeof fetch = fetch
): Promise<SupabaseUser | null> {
  const authorization = req.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(authorization);
  const config = supabaseConfig();
  if (!match || !config) return null;

  try {
    const response = await fetcher(`${config.url}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: config.publishableKey,
        authorization: `Bearer ${match[1]}`,
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const user = (await response.json()) as SupabaseUser;
    return typeof user.id === "string" && typeof user.email === "string"
      ? user
      : null;
  } catch {
    return null;
  }
}

export async function isAdmin(req: Request): Promise<boolean> {
  const user = await getSupabaseUser(req);
  return (
    Boolean(user?.email_confirmed_at) &&
    user?.email?.trim().toLowerCase() === ADMIN_EMAIL
  );
}

export function requireSameOrigin(req: Request, res: Response) {
  const origin = req.get("origin");
  if (!origin) {
    res.status(403).json({ error: "Request origin is required." });
    return false;
  }
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    res.status(403).json({ error: "Request origin is not allowed." });
    return false;
  }
  const expected = (req.get("x-forwarded-host") ?? req.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (expected && originHost === expected) return true;
  // A direct HTTPS deployment can terminate TLS before Express and rebase Host.
  const forwardedHost = req.get("x-forwarded-host");
  if (
    forwardedHost &&
    originHost === forwardedHost.split(",")[0].trim().toLowerCase()
  ) {
    return true;
  }
  res.status(403).json({ error: "Request origin is not allowed." });
  return false;
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase()) &&
    !requireSameOrigin(req, res)
  ) {
    return;
  }
  if (!(await isAdmin(req))) {
    return res.status(401).json({ error: "Admin login required." });
  }
  next();
}
