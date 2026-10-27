import { createHash } from "node:crypto";
import { and, desc, eq, gte, inArray, like, or } from "drizzle-orm";
import { Router } from "express";
import type { Request } from "express";
import { getDb } from "../db";
import { jobs, memberAccounts, memberFavorites, memberProfiles } from "../../drizzle/schema";
import { clearMemberSession, getMemberId, hashMemberPassword, isMemberAuthConfigured, requireMember, setMemberSession, verifyMemberPassword } from "./member-auth";
import { requireSameOrigin } from "./auth";
import { decodeCvBase64, extractCvText, inspectCvUpload, InvalidCvUploadError } from "./member-cv";

const router = Router();
router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
const attempts = new Map<string, { count: number; resetAt: number }>();
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>.]+(?:\.[^\s@<>.]+)*\.[^\s@<>.]{2,}$/;
const SAFE_MEMBER_FIELDS = { id: memberAccounts.id, displayName: memberAccounts.displayName, email: memberAccounts.email, isActive: memberAccounts.isActive, createdAt: memberAccounts.createdAt, lastSignedIn: memberAccounts.lastSignedIn, alertsEnabled: memberAccounts.alertsEnabled, alertCategories: memberAccounts.alertCategories, alertLocations: memberAccounts.alertLocations };
const SIGNUP_RESPONSE = { message: "If an account can be created for that email, it is ready. Sign in to continue." };
const parseList = (raw: string | null) => {
  try {
    const value = JSON.parse(raw ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 30) : [];
  } catch { return []; }
};
function allowAttempt(key: string) {
  const now = Date.now();
  const prior = attempts.get(key);
  if (!prior || prior.resetAt <= now) { attempts.set(key, { count: 1, resetAt: now + 15 * 60_000 }); return true; }
  if (prior.count >= 10) return false;
  prior.count += 1;
  return true;
}
function cleanAttempts() {
  if (attempts.size < 1000) return;
  const now = Date.now();
  for (const [key, item] of attempts) if (item.resetAt <= now) attempts.delete(key);
}
function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 320 && EMAIL_RE.test(email) ? email : null;
}
export function isValidMemberPassword(password: string) {
  return password.length >= 6 && password.length <= 128
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /[^A-Za-z0-9\s]/.test(password);
}
function loginKey(req: Request, email: string) {
  const ipHash = createHash("sha256").update(String(req.ip ?? "unknown")).digest("hex").slice(0, 20);
  return `${ipHash}:${email}`;
}
function safeMember(row: any) {
  return { id: row.id, displayName: row.displayName, email: row.email, isActive: row.isActive, createdAt: row.createdAt, lastSignedIn: row.lastSignedIn, alertsEnabled: row.alertsEnabled, alertCategories: parseList(row.alertCategories), alertLocations: parseList(row.alertLocations) };
}
function safeProfile(row: any) {
  return row ? { fullName: row.fullName, phoneNumber: row.phoneNumber, location: row.location, profession: row.profession, directoryOptIn: row.directoryOptIn, cvFileName: row.cvFileName, updatedAt: row.updatedAt } : { fullName: "", phoneNumber: "", location: "", profession: "", directoryOptIn: false, cvFileName: null, updatedAt: null };
}
function terms(value: string) {
  const stop = new Set("the and for with from this that your you are our all not will has have job role work team skills experience knowledge ability required preferred about into within across including using use years education degree successful candidate position responsibilities qualifications requirements description location apply application".split(" "));
  return [...new Set((value.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) ?? []).map(word => word.replace(/[.+-]+$/g, "")).filter(word => word.length >= 3 && !stop.has(word)))];
}
export function scoreCvForJob(cvText: string, jobText: string) {
  const jobTerms = terms(jobText).slice(0, 30);
  const cvTerms = new Set(terms(cvText));
  const allMatchedKeywords = jobTerms.filter(word => cvTerms.has(word));
  const matchedKeywords = allMatchedKeywords.slice(0, 20);
  const missingKeywords = jobTerms.filter(word => !cvTerms.has(word)).slice(0, 12);
  const keywordScore = jobTerms.length ? allMatchedKeywords.length / jobTerms.length : 0;
  const sectionPatterns = [/\b(experience|employment|work history)\b/i, /\b(education|qualification)\b/i, /\b(skills|competencies)\b/i, /\b(summary|profile|objective)\b/i, /\b(contact|email|phone|linkedin)\b/i];
  const sectionsFound = sectionPatterns.filter(pattern => pattern.test(cvText)).length;
  const lengthScore = cvText.trim().length >= 500 ? 1 : Math.min(1, cvText.trim().length / 500);
  const score = Math.max(0, Math.min(100, Math.round(keywordScore * 80 + (sectionsFound / sectionPatterns.length) * 15 + lengthScore * 5)));
  return { score, matchedKeywords, missingKeywords, sectionsFound, sectionCount: sectionPatterns.length };
}

router.get("/session", async (req, res) => {
  const memberId = await getMemberId(req);
  if (!memberId) return res.json({ authenticated: false, member: null });
  const db = await getDb();
  if (!db) return res.status(503).json({ error: "Member accounts are temporarily unavailable." });
  const [member] = await db.select(SAFE_MEMBER_FIELDS).from(memberAccounts).where(and(eq(memberAccounts.id, memberId), eq(memberAccounts.isActive, true))).limit(1);
  if (!member) return res.json({ authenticated: false, member: null });
  return res.json({ authenticated: true, member: safeMember(member) });
});

router.post("/signup", async (req, res) => {
  if (!requireSameOrigin(req, res)) return;
  if (!isMemberAuthConfigured()) return res.status(503).json({ error: "Member login is not configured yet. Ask the site administrator to finish setup." });
  cleanAttempts();
  const email = normalizeEmail(req.body?.email);
  const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim().replace(/\s+/g, " ") : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const key = loginKey(req, email ?? "invalid");
  if (!allowAttempt(key)) return res.status(429).json({ error: "Too many attempts. Please wait 15 minutes and try again." });
  if (!email || displayName.length < 2 || displayName.length > 100 || !isValidMemberPassword(password)) {
    return res.status(400).json({ error: "Enter a valid email, a name of 2–100 characters, and a password of 6–128 characters with uppercase, lowercase and a symbol. Numbers are optional." });
  }
  const db = await getDb();
  if (!db) return res.status(503).json({ error: "Member accounts are temporarily unavailable." });
  try {
    const credential = await hashMemberPassword(password);
    const [existing] = await db.select({ id: memberAccounts.id }).from(memberAccounts).where(eq(memberAccounts.email, email)).limit(1);
    if (existing) { attempts.delete(key); return res.json(SIGNUP_RESPONSE); }
    await db.insert(memberAccounts).values({ displayName, email, passwordHash: credential.hash, passwordSalt: credential.salt });
    attempts.delete(key);
    return res.json(SIGNUP_RESPONSE);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ER_DUP_ENTRY") return res.json(SIGNUP_RESPONSE);
    return res.status(500).json({ error: "Your account could not be created. Please try again." });
  }
});

router.post("/login", async (req, res) => {
  if (!requireSameOrigin(req, res)) return;
  if (!isMemberAuthConfigured()) return res.status(503).json({ error: "Member login is not configured yet. Ask the site administrator to finish setup." });
  cleanAttempts();
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const key = loginKey(req, email ?? "invalid");
  if (!allowAttempt(key)) return res.status(429).json({ error: "Too many attempts. Please wait 15 minutes and try again." });
  const db = await getDb();
  if (!db) return res.status(503).json({ error: "Member accounts are temporarily unavailable." });
  const [member] = email ? await db.select().from(memberAccounts).where(eq(memberAccounts.email, email)).limit(1) : [];
  const valid = !!member && member.isActive && password.length <= 128 && await verifyMemberPassword(password, member.passwordSalt, member.passwordHash);
  if (!valid || !member) return res.status(401).json({ error: "Email or password is incorrect." });
  try {
    await setMemberSession(req, res, member.id);
  } catch {
    return res.status(503).json({ error: "Member login is not configured yet. Ask the site administrator to finish setup." });
  }
  attempts.delete(key);
  await db.update(memberAccounts).set({ lastSignedIn: new Date() }).where(eq(memberAccounts.id, member.id));
  const [updated] = await db.select(SAFE_MEMBER_FIELDS).from(memberAccounts).where(eq(memberAccounts.id, member.id)).limit(1);
  return res.json({ member: safeMember(updated) });
});

router.post("/logout", async (req, res) => {
  if (!requireSameOrigin(req, res)) return;
  clearMemberSession(req, res);
  return res.json({ authenticated: false });
});

router.get("/dashboard", requireMember, async (_req, res) => {
  const memberId = Number(res.locals.memberId);
  const db = await getDb();
  if (!db) return res.status(503).json({ error: "Your dashboard is temporarily unavailable." });
  const [member] = await db.select(SAFE_MEMBER_FIELDS).from(memberAccounts).where(and(eq(memberAccounts.id, memberId), eq(memberAccounts.isActive, true))).limit(1);
  if (!member) return res.status(401).json({ error: "Sign in to access your member dashboard." });
  const favorites = await db.select({ job: jobs }).from(memberFavorites).innerJoin(jobs, eq(memberFavorites.jobId, jobs.id))
    .where(and(eq(memberFavorites.memberId, memberId), eq(jobs.status, "published"))).orderBy(desc(memberFavorites.createdAt)).limit(200);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const predicates = [eq(jobs.status, "published"), gte(jobs.publishedAt, since)];
  const categories = parseList(member.alertCategories);
  const locations = parseList(member.alertLocations);
  if (categories.length) predicates.push(inArray(jobs.category, categories));
  if (locations.length) {
    const locationPredicates = locations.map(location => like(jobs.location, `%${location.replace(/[\\%_]/g, "\\$&")}%`));
    const locationClause = or(...locationPredicates);
    if (locationClause) predicates.push(locationClause);
  }
  const alerts = member.alertsEnabled && (categories.length || locations.length)
    ? await db.select().from(jobs).where(and(...predicates)).orderBy(desc(jobs.publishedAt)).limit(25)
    : [];
  return res.json({ member: safeMember(member), favorites: favorites.map(row => row.job), alerts });
});

router.put("/preferences", requireMember, async (req, res) => {
  if (!requireSameOrigin(req, res)) return;
  const clean = (value: unknown) => Array.isArray(value) && value.length <= 30 && value.every(item => typeof item === "string" && item.trim().length > 0 && item.trim().length <= 120) ? [...new Set(value.map(item => item.trim()))] : null;
  const categories = clean(req.body?.categories);
  const locations = clean(req.body?.locations);
  const enabled = req.body?.enabled;
  if (!categories || !locations || typeof enabled !== "boolean") return res.status(400).json({ error: "Choose valid alert preferences." });
  if (enabled && !categories.length && !locations.length) return res.status(400).json({ error: "Choose at least one category or location before enabling alerts." });
  const db = await getDb();
  if (!db) return res.status(503).json({ error: "Your preferences could not be saved." });
  await db.update(memberAccounts).set({ alertCategories: JSON.stringify(categories), alertLocations: JSON.stringify(locations), alertsEnabled: enabled }).where(eq(memberAccounts.id, Number(res.locals.memberId)));
  return res.json({ saved: true });
});

router.get("/profile", requireMember, async (_req, res) => {
  const db = await getDb();
  if (!db) return res.status(503).json({ error: "Your profile is temporarily unavailable." });
  const [profile] = await db.select({ fullName: memberProfiles.fullName, phoneNumber: memberProfiles.phoneNumber, location: memberProfiles.location, profession: memberProfiles.profession, directoryOptIn: memberProfiles.directoryOptIn, cvFileName: memberProfiles.cvFileName, updatedAt: memberProfiles.updatedAt })
    .from(memberProfiles).where(eq(memberProfiles.memberId, Number(res.locals.memberId))).limit(1);
  return res.json({ profile: safeProfile(profile) });
});

router.put("/profile", requireMember, async (req, res) => {
  if (!requireSameOrigin(req, res)) return;
  const cleanText = (value: unknown, maximum: number) => typeof value === "string" && value.trim().length <= maximum ? value.trim() : null;
  const fullName = cleanText(req.body?.fullName, 150);
  const phoneNumber = cleanText(req.body?.phoneNumber, 40);
  const location = cleanText(req.body?.location, 160);
  const profession = cleanText(req.body?.profession, 160);
  const directoryOptIn = req.body?.directoryOptIn;
  const removeCv = req.body?.removeCv === true;
  if (fullName === null || phoneNumber === null || location === null || profession === null || typeof directoryOptIn !== "boolean" || (removeCv && req.body?.cvBase64)) {
    return res.status(400).json({ error: "Check the profile fields and try again." });
  }
  if (directoryOptIn && (fullName.length < 2 || !phoneNumber || !location || !profession)) {
    return res.status(400).json({ error: "Add your full name, phone number, location and profession before opting into the talent directory." });
  }

  let uploadedBuffer: Buffer | null = null;
  let uploadedFile: ReturnType<typeof inspectCvUpload> | null = null;
  if (req.body?.cvBase64 !== undefined) {
    try {
      uploadedBuffer = decodeCvBase64(req.body.cvBase64);
      if (typeof req.body?.cvFileName !== "string") throw new InvalidCvUploadError("Choose a supported CV file.");
      uploadedFile = inspectCvUpload(req.body.cvFileName, uploadedBuffer);
    } catch (error) {
      uploadedBuffer?.fill(0);
      return res.status(400).json({ error: error instanceof InvalidCvUploadError ? error.message : "Choose a supported CV file no larger than 5 MB." });
    }
  }

  const memberId = Number(res.locals.memberId);
  const db = await getDb();
  if (!db) { uploadedBuffer?.fill(0); return res.status(503).json({ error: "Your profile could not be saved right now." }); }
  try {
    const [existing] = await db.select({ cvFileName: memberProfiles.cvFileName, cvMimeType: memberProfiles.cvMimeType, cvData: memberProfiles.cvData })
      .from(memberProfiles).where(eq(memberProfiles.memberId, memberId)).limit(1);
    const values = {
      memberId, fullName, phoneNumber, location, profession, directoryOptIn,
      cvFileName: removeCv ? null : uploadedFile?.fileName ?? existing?.cvFileName ?? null,
      cvMimeType: removeCv ? null : uploadedFile?.mimeType ?? existing?.cvMimeType ?? null,
      cvData: removeCv ? null : uploadedBuffer ?? existing?.cvData ?? null,
    };
    await db.insert(memberProfiles).values(values).onDuplicateKeyUpdate({ set: values });
    const [saved] = await db.select({ fullName: memberProfiles.fullName, phoneNumber: memberProfiles.phoneNumber, location: memberProfiles.location, profession: memberProfiles.profession, directoryOptIn: memberProfiles.directoryOptIn, cvFileName: memberProfiles.cvFileName, updatedAt: memberProfiles.updatedAt })
      .from(memberProfiles).where(eq(memberProfiles.memberId, memberId)).limit(1);
    return res.json({ profile: safeProfile(saved) });
  } finally {
    uploadedBuffer?.fill(0);
  }
});

router.post("/favorites/:jobId", requireMember, async (req, res) => {
  if (!requireSameOrigin(req, res)) return;
  const jobId = Number(req.params.jobId);
  if (!Number.isSafeInteger(jobId) || jobId < 1) return res.status(400).json({ error: "Invalid job." });
  const memberId = Number(res.locals.memberId);
  const db = await getDb();
  if (!db) return res.status(503).json({ error: "Favorites are temporarily unavailable." });
  const [job] = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.status, "published"))).limit(1);
  if (!job) return res.status(404).json({ error: "Published job not found." });
  const [existing] = await db.select({ id: memberFavorites.id }).from(memberFavorites).where(and(eq(memberFavorites.memberId, memberId), eq(memberFavorites.jobId, jobId))).limit(1);
  if (existing) {
    await db.delete(memberFavorites).where(eq(memberFavorites.id, existing.id));
    return res.json({ saved: false });
  }
  await db.insert(memberFavorites).values({ memberId, jobId });
  return res.json({ saved: true });
});

router.post("/cv-match", requireMember, async (req, res) => {
  if (!requireSameOrigin(req, res)) return;
  const jobId = Number(req.body?.jobId);
  if (!Number.isSafeInteger(jobId) || jobId < 1) return res.status(400).json({ error: "Choose a published job to compare with your CV." });
  let uploadedBuffer: Buffer | null = null;
  let cvText = "";
  try {
    uploadedBuffer = decodeCvBase64(req.body?.cvBase64);
    if (typeof req.body?.cvFileName !== "string") throw new InvalidCvUploadError("Choose a supported CV file.");
    cvText = await extractCvText(req.body.cvFileName, uploadedBuffer);
  } catch (error) {
    uploadedBuffer?.fill(0);
    return res.status(400).json({ error: error instanceof InvalidCvUploadError ? error.message : "The CV could not be read. Try another PDF, DOC, DOCX, TXT or RTF file." });
  }
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "CV matching is temporarily unavailable." });
    const [job] = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.status, "published"))).limit(1);
    if (!job) return res.status(404).json({ error: "Published job not found." });
    const jobText = [job.title, job.category, job.description, job.responsibilities, job.qualifications].filter(Boolean).join(" ");
    return res.json({ ...scoreCvForJob(cvText, jobText), jobTitle: job.title, retained: false, note: "This is a basic keyword and structure estimate—not a hiring decision or guarantee. Your uploaded CV and extracted text are not saved." });
  } finally {
    uploadedBuffer.fill(0);
    cvText = "";
  }
});

export function createMemberRouter() { return router; }
