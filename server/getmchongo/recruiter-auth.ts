import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import type { NextFunction, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookie } from "cookie";
import { and, eq } from "drizzle-orm";
import { recruiterAccounts } from "../../drizzle/schema";
import { getDb } from "../db";
const scrypt = promisify(scryptCallback);
const COOKIE = "gm_recruiter_session";
const ISSUER = "get-mchongo-recruiters";
const AUDIENCE = "get-mchongo-recruiter-dashboard";
const SESSION_DAYS = 7;
export const isRecruiterAuthConfigured = () =>
  Boolean(
    process.env.RECRUITER_SESSION_SECRET &&
      Buffer.byteLength(process.env.RECRUITER_SESSION_SECRET, "utf8") >= 32
  );
function key() {
  const secret = process.env.RECRUITER_SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) return null;
  return createHash("sha256")
    .update("get-mchongo-recruiter-session-v1\0")
    .update(secret)
    .digest();
}
function local(req: Request) {
  try {
    const u = new URL(req.get("origin") ?? "");
    return (
      u.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}
function cookieOptions(req: Request) {
  const dev = local(req);
  return {
    httpOnly: true,
    path: "/",
    secure: !dev,
    sameSite: dev ? ("lax" as const) : ("none" as const),
    maxAge: SESSION_DAYS * 86400000,
  };
}
export async function hashRecruiterPassword(password: string) {
  const salt = randomBytes(16);
  const digest = (await scrypt(password, salt, 64)) as Buffer;
  return { salt: salt.toString("hex"), hash: digest.toString("hex") };
}
export async function verifyRecruiterPassword(
  password: string,
  saltHex: string,
  hashHex: string
) {
  try {
    const salt = Buffer.from(saltHex, "hex"),
      expected = Buffer.from(hashHex, "hex");
    if (salt.length !== 16 || expected.length !== 64) return false;
    const actual = (await scrypt(password, salt, 64)) as Buffer;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
export async function setRecruiterSession(
  req: Request,
  res: Response,
  id: number
) {
  const signingKey = key();
  if (!signingKey) throw new Error("Recruiter sessions are not configured.");
  const token = await new SignJWT({ role: "recruiter" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(String(id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(signingKey);
  res.cookie(COOKIE, token, cookieOptions(req));
}
export async function getRecruiterId(req: Request): Promise<number | null> {
  const signingKey = key(),
    token = parseCookie(req.headers.cookie ?? "")[COOKIE];
  if (!signingKey || !token) return null;
  try {
    const { payload } = await jwtVerify(token, signingKey, {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
      maxTokenAge: `${SESSION_DAYS}d`,
    });
    const id = Number(payload.sub);
    return payload.role === "recruiter" && Number.isSafeInteger(id) && id > 0
      ? id
      : null;
  } catch {
    return null;
  }
}
export function clearRecruiterSession(req: Request, res: Response) {
  res.clearCookie(COOKIE, { ...cookieOptions(req), maxAge: 0 });
}
export async function requireRecruiter(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const id = await getRecruiterId(req);
  if (!id) {
    clearRecruiterSession(req, res);
    return res
      .status(401)
      .json({ error: "Sign in to access your recruiter dashboard." });
  }
  const db = await getDb();
  if (!db)
    return res
      .status(503)
      .json({ error: "Recruiter accounts are temporarily unavailable." });
  const [row] = await db
    .select({ id: recruiterAccounts.id, isActive: recruiterAccounts.isActive })
    .from(recruiterAccounts)
    .where(
      and(eq(recruiterAccounts.id, id), eq(recruiterAccounts.isActive, true))
    )
    .limit(1);
  if (!row) {
    clearRecruiterSession(req, res);
    return res
      .status(401)
      .json({ error: "Sign in to access your recruiter dashboard." });
  }
  res.locals.recruiterId = id;
  next();
}
