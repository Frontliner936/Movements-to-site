import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextFunction, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookie } from "cookie";
import { and, eq } from "drizzle-orm";
import { memberAccounts } from "../../drizzle/schema";
import { getDb } from "../db";

const scrypt = promisify(scryptCallback);
const MEMBER_COOKIE = "gm_member_session";
const MEMBER_ISSUER = "get-mchongo-members";
const MEMBER_AUDIENCE = "get-mchongo-member-dashboard";
const SESSION_DAYS = 7;
const KEY_LENGTH = 64;

function sessionKey(): Uint8Array | null {
  const configured = process.env.MEMBER_SESSION_SECRET;
  if (!configured || Buffer.byteLength(configured, "utf8") < 32) return null;
  return createHash("sha256").update("get-mchongo-member-session-v1\0").update(configured).digest();
}

export function isMemberAuthConfigured() { return sessionKey() !== null; }

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
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
}

export async function hashMemberPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH) as Buffer;
  return { salt: salt.toString("hex"), hash: hash.toString("hex") };
}

export async function verifyMemberPassword(password: string, saltHex: string, hashHex: string) {
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
    const actual = await scrypt(password, salt, KEY_LENGTH) as Buffer;
    return timingSafeEqual(actual, expected);
  } catch { return false; }
}

export async function setMemberSession(req: Request, res: Response, memberId: number) {
  const key = sessionKey();
  if (!key) throw new Error("Member login is not configured. Set MEMBER_SESSION_SECRET to a random value of at least 32 characters.");
  const token = await new SignJWT({ role: "member" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(MEMBER_ISSUER)
    .setAudience(MEMBER_AUDIENCE)
    .setSubject(String(memberId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key);
  res.cookie(MEMBER_COOKIE, token, cookieOptions(req));
}

export async function getMemberId(req: Request): Promise<number | null> {
  const key = sessionKey();
  if (!key) return null;
  const token = parseCookie(req.headers.cookie ?? "")[MEMBER_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"], issuer: MEMBER_ISSUER, audience: MEMBER_AUDIENCE, maxTokenAge: `${SESSION_DAYS}d`,
    });
    const id = Number(payload.sub);
    return payload.role === "member" && Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch { return null; }
}

async function activeMemberResult(req: Request): Promise<{ memberId: number | null; unavailable: boolean }> {
  const memberId = await getMemberId(req);
  if (!memberId) return { memberId: null, unavailable: false };
  const db = await getDb();
  if (!db) return { memberId: null, unavailable: true };
  const [member] = await db.select({ id: memberAccounts.id }).from(memberAccounts)
    .where(and(eq(memberAccounts.id, memberId), eq(memberAccounts.isActive, true))).limit(1);
  return { memberId: member?.id ?? null, unavailable: false };
}

export async function getActiveMemberId(req: Request): Promise<number | null> {
  return (await activeMemberResult(req)).memberId;
}

export function clearMemberSession(req: Request, res: Response) {
  res.clearCookie(MEMBER_COOKIE, { ...cookieOptions(req), maxAge: 0 });
}

export async function requireMember(req: Request, res: Response, next: NextFunction) {
  const result = await activeMemberResult(req);
  if (result.unavailable) return res.status(503).json({ error: "Member accounts are temporarily unavailable." });
  if (!result.memberId) {
    clearMemberSession(req, res);
    return res.status(401).json({ error: "Sign in to access your member dashboard." });
  }
  res.locals.memberId = result.memberId;
  next();
}
