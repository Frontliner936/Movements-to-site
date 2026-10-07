import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookie } from "cookie";

export const ADMIN_EMAIL = "frontlinertech@gmail.com";
const COOKIE = "gm_admin_session";
const ISSUER = "get-mchongo-admin";
const AUDIENCE = "get-mchongo-dashboard";
const SESSION_HOURS = 8;

function sessionKey() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("Admin login is not configured.");
  return createHash("sha256").update("get-mchongo-session-v1\0").update(password).digest();
}

function localPlainHttp(req: Request) {
  const origin = req.get("origin");
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname.toLowerCase());
  } catch { return false; }
}

function cookieOptions(req: Request) {
  const local = localPlainHttp(req);
  return {
    httpOnly: true,
    path: "/",
    secure: !local,
    sameSite: local ? "lax" as const : "none" as const,
    maxAge: SESSION_HOURS * 60 * 60 * 1000,
  };
}

function safeEquals(actual: string, expected: string) {
  const a = Buffer.from(actual, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function login(req: Request, res: Response) {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const configuredPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!configuredPassword || !safeEquals(email, ADMIN_EMAIL) || !safeEquals(password, configuredPassword)) {
    return res.status(401).json({ error: "Email or password is incorrect." });
  }
  const token = await new SignJWT({ role: "admin", email: ADMIN_EMAIL })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject("admin")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(sessionKey());
  res.cookie(COOKIE, token, cookieOptions(req));
  return res.json({ authenticated: true, email: ADMIN_EMAIL });
}

export async function isAdmin(req: Request) {
  const raw = parseCookie(req.headers.cookie ?? "")[COOKIE];
  if (!raw) return false;
  try {
    const { payload } = await jwtVerify(raw, sessionKey(), {
      algorithms: ["HS256"], issuer: ISSUER, audience: AUDIENCE, maxTokenAge: `${SESSION_HOURS}h`,
    });
    return payload.sub === "admin" && payload.role === "admin" && payload.email === ADMIN_EMAIL;
  } catch {
    return false;
  }
}

export function logout(req: Request, res: Response) {
  res.clearCookie(COOKIE, { ...cookieOptions(req), maxAge: 0 });
  return res.json({ authenticated: false });
}

export function requireSameOrigin(req: Request, res: Response) {
  const origin = req.get("origin");
  if (!origin) { res.status(403).json({ error: "Request origin is required." }); return false; }
  let originHost: string;
  try { originHost = new URL(origin).host.toLowerCase(); }
  catch { res.status(403).json({ error: "Request origin is not allowed." }); return false; }
  const expected = (req.get("x-forwarded-host") ?? req.get("host") ?? "").split(",")[0].trim().toLowerCase();
  if (expected && originHost === expected) return true;
  // A direct HTTPS deployment can terminate TLS before Express and rebase Host.
  const forwardedHost = req.get("x-forwarded-host");
  if (forwardedHost && originHost === forwardedHost.split(",")[0].trim().toLowerCase()) return true;
  res.status(403).json({ error: "Request origin is not allowed." });
  return false;
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase()) && !requireSameOrigin(req, res)) return;
  if (!(await isAdmin(req))) return res.status(401).json({ error: "Admin login required." });
  next();
}
