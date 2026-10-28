import { createHash } from "node:crypto";
import { and, desc, eq, gte, inArray, like, or } from "drizzle-orm";
import { Router } from "express";
import type { Request } from "express";
import { getDb } from "../db";
import { jobs, memberAccounts, memberCvReports, memberFavorites, memberJobAlertEvents, memberProfiles } from "../../drizzle/schema";
import { clearMemberSession, getMemberId, hashMemberPassword, isMemberAuthConfigured, requireMember, setMemberSession, verifyMemberPassword } from "./member-auth";
import { requireSameOrigin } from "./auth";
import { decodeCvBase64, extractCvText, inspectCvUpload, InvalidCvUploadError } from "./member-cv";
import { extractJobAdvertText, InvalidJobAdvertError } from "./member-job-advert";
import { scoreCvAts } from "./cv-ats-scoring";
import { isJobAlertEmailConfigured } from "./job-email-alerts";

const router = Router();
router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
const attempts = new Map<string, { count: number; resetAt: number }>();
const cvCheckAttempts = new Map<number, { count: number; resetAt: number }>();
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
  return { id: row.id, displayName: row.displayName, email: row.email, isActive: row.isActive, createdAt: row.createdAt, lastSignedIn: row.lastSignedIn, alertsEnabled: row.alertsEnabled, emailAlertsEnabled: row.emailAlertsEnabled === true, alertCategories: parseList(row.alertCategories), alertLocations: parseList(row.alertLocations) };
}
function safeProfile(row: any) {
  return row ? { fullName: row.fullName, phoneNumber: row.phoneNumber, location: row.location, profession: row.profession, directoryOptIn: row.directoryOptIn, cvFileName: row.cvFileName, updatedAt: row.updatedAt } : { fullName: "", phoneNumber: "", location: "", profession: "", directoryOptIn: false, cvFileName: null, updatedAt: null };
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
  let emailAlertSchemaAvailable = true;
  let emailAlertsEnabled = false;
  try {
    const [emailPreference] = await db.select({ emailAlertsEnabled: memberAccounts.emailAlertsEnabled }).from(memberAccounts).where(eq(memberAccounts.id, memberId)).limit(1);
    await db.select({ jobId: memberJobAlertEvents.jobId }).from(memberJobAlertEvents).limit(1);
    emailAlertsEnabled = emailPreference?.emailAlertsEnabled === true;
  } catch { emailAlertSchemaAvailable = false; }
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
  return res.json({ member: safeMember({ ...member, emailAlertsEnabled }), emailAlertSchemaAvailable, emailAlertsAvailable: emailAlertSchemaAvailable && isJobAlertEmailConfigured(), favorites: favorites.map(row => row.job), alerts });
});

router.put("/preferences", requireMember, async (req, res) => {
  if (!requireSameOrigin(req, res)) return;
  const clean = (value: unknown) => Array.isArray(value) && value.length <= 30 && value.every(item => typeof item === "string" && item.trim().length > 0 && item.trim().length <= 120) ? [...new Set(value.map(item => item.trim()))] : null;
  const categories = clean(req.body?.categories);
  const locations = clean(req.body?.locations);
  const enabled = req.body?.enabled;
  const emailAlertsEnabled = req.body?.emailAlertsEnabled;
  if (!categories || !locations || typeof enabled !== "boolean") return res.status(400).json({ error: "Choose valid alert preferences." });
  if (emailAlertsEnabled !== undefined && typeof emailAlertsEnabled !== "boolean") return res.status(400).json({ error: "Choose whether to receive email alerts." });
  if (enabled && !categories.length && !locations.length) return res.status(400).json({ error: "Choose at least one category or location before enabling alerts." });
  if (emailAlertsEnabled === true && !categories.length && !locations.length) return res.status(400).json({ error: "Choose at least one category or location before enabling email alerts." });
  if (emailAlertsEnabled === true && !isJobAlertEmailConfigured()) return res.status(503).json({ error: "Email alerts are not configured yet. Dashboard alerts remain available; please try again after the site administrator configures email delivery." });
  const db = await getDb();
  if (!db) return res.status(503).json({ error: "Your preferences could not be saved." });
  if (emailAlertsEnabled === true) {
    try {
      await db.select({ emailAlertsEnabled: memberAccounts.emailAlertsEnabled }).from(memberAccounts).where(eq(memberAccounts.id, Number(res.locals.memberId))).limit(1);
      await db.select({ jobId: memberJobAlertEvents.jobId }).from(memberJobAlertEvents).limit(1);
    } catch { return res.status(503).json({ error: "Email-alert storage is not installed yet. Ask the site administrator to apply migrations 0013 and 0014." }); }
  }
  const changes: Partial<typeof memberAccounts.$inferInsert> = { alertCategories: JSON.stringify(categories), alertLocations: JSON.stringify(locations), alertsEnabled: enabled };
  if (emailAlertsEnabled !== undefined) changes.emailAlertsEnabled = emailAlertsEnabled;
  try {
    await db.update(memberAccounts).set(changes).where(eq(memberAccounts.id, Number(res.locals.memberId)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!/email_alerts_enabled/i.test(message) || !/unknown column|doesn't exist|no such column/i.test(message)) throw error;
    if (emailAlertsEnabled !== false) return res.status(503).json({ error: "Email-alert storage is not installed yet. Ask the site administrator to apply migrations 0013 and 0014." });
    const { emailAlertsEnabled: _emailAlertsEnabled, ...legacyChanges } = changes;
    await db.update(memberAccounts).set(legacyChanges).where(eq(memberAccounts.id, Number(res.locals.memberId)));
  }
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

router.post("/cv-check", requireMember, async (req, res) => {
  if (!requireSameOrigin(req, res)) return;
  const memberId = Number(res.locals.memberId);
  const now = Date.now();
  const prior = cvCheckAttempts.get(memberId);
  if (prior && prior.resetAt > now && prior.count >= 10) return res.status(429).json({ error: "You have reached the CV checker limit. Please try again later." });
  if (!prior || prior.resetAt <= now) cvCheckAttempts.set(memberId, { count: 1, resetAt: now + 60 * 60_000 });
  else prior.count++;
  if (cvCheckAttempts.size > 1000) for (const [id, attempt] of cvCheckAttempts) if (attempt.resetAt <= now) cvCheckAttempts.delete(id);

  let uploadedBuffer: Buffer | null = null;
  let jobAdvertBuffer: Buffer | null = null;
  let cvText = "";
  let jobAdvertText = "";
  let targetText = "";
  try {
    const jobIdValue = req.body?.jobId;
    const jobDescription = typeof req.body?.jobDescription === "string" ? req.body.jobDescription.trim() : "";
    const jobAdvertFileName = req.body?.jobAdvertFileName;
    const jobAdvertBase64 = req.body?.jobAdvertBase64;
    const hasAdvertUpload = Boolean(jobAdvertFileName || jobAdvertBase64);
    if (jobDescription.length > 20_000) return res.status(400).json({ error: "A pasted job description must be no more than 20,000 characters." });
    if (jobDescription && jobDescription.length < 50) return res.status(400).json({ error: "A pasted job description must contain at least 50 characters." });
    if (hasAdvertUpload && (typeof jobAdvertFileName !== "string" || typeof jobAdvertBase64 !== "string")) return res.status(400).json({ error: "Choose the job-advert file again and retry." });
    if (jobIdValue !== undefined && jobIdValue !== null && jobIdValue !== "" && (jobDescription || hasAdvertUpload)) return res.status(400).json({ error: "Choose one published job or provide a custom job description/advert, not both." });
    if (jobIdValue === undefined && !jobDescription && !hasAdvertUpload && req.body?.targetMode === "custom") return res.status(400).json({ error: "Paste a job description or upload a job advert." });

    if (typeof req.body?.cvFileName !== "string") throw new InvalidCvUploadError("Choose a PDF or DOCX CV file.");
    const fileName = req.body.cvFileName;
    const extension = fileName.split(".").pop()?.toLowerCase();
    if (extension !== "pdf" && extension !== "docx") throw new InvalidCvUploadError("The CV Checker accepts PDF and DOCX files only.");
    uploadedBuffer = decodeCvBase64(req.body?.cvBase64);
    inspectCvUpload(fileName, uploadedBuffer);
    cvText = await extractCvText(fileName, uploadedBuffer);

    let targetLabel = "General CV review";
    if (jobIdValue !== undefined && jobIdValue !== null && jobIdValue !== "") {
      const jobId = Number(jobIdValue);
      if (!Number.isSafeInteger(jobId) || jobId < 1) return res.status(400).json({ error: "Choose a published job or provide a custom job description." });
      const db = await getDb();
      if (!db) return res.status(503).json({ error: "CV reports are temporarily unavailable." });
      const [job] = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.status, "published"))).limit(1);
      if (!job) return res.status(404).json({ error: "Published job not found." });
      targetText = [job.title, job.category, job.description, job.responsibilities, job.qualifications].filter(Boolean).join(" ");
      targetLabel = job.title.slice(0, 300);
    } else {
      let jobAdvertNotes: string[] = [];
      if (hasAdvertUpload) {
        jobAdvertBuffer = decodeCvBase64(jobAdvertBase64, "job advert");
        const extracted = await extractJobAdvertText(jobAdvertFileName, jobAdvertBuffer);
        jobAdvertText = extracted.text;
        jobAdvertNotes = extracted.notes;
      }
      targetText = [jobDescription, jobAdvertText].filter(Boolean).join("\n\n").slice(0, 40_000);
      if (jobDescription || hasAdvertUpload) {
        targetLabel = jobDescription && hasAdvertUpload ? "Pasted description + uploaded advert" : hasAdvertUpload ? "Uploaded job advert" : "Custom job description";
      }
      const report = { ...scoreCvAts(cvText, targetText), sourceNotes: jobAdvertNotes };
      const db = await getDb();
      if (!db) return res.status(503).json({ error: "CV reports are temporarily unavailable." });
      const inserted = await db.insert(memberCvReports).values({ memberId, score: report.score, targetLabel, reportJson: JSON.stringify(report) });
      const reportId = Number((inserted as any)?.[0]?.insertId ?? 0);
      if (!reportId) return res.status(500).json({ error: "The CV report could not be saved." });
      const [saved] = await db.select({ createdAt: memberCvReports.createdAt }).from(memberCvReports).where(and(eq(memberCvReports.id, reportId), eq(memberCvReports.memberId, memberId))).limit(1);
      return res.json({ report: { ...report, id: reportId, targetLabel, createdAt: saved?.createdAt ?? new Date() } });
    }

    const report = { ...scoreCvAts(cvText, targetText), sourceNotes: [] as string[] };
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "CV reports are temporarily unavailable." });
    const inserted = await db.insert(memberCvReports).values({ memberId, score: report.score, targetLabel, reportJson: JSON.stringify(report) });
    const reportId = Number((inserted as any)?.[0]?.insertId ?? 0);
    if (!reportId) return res.status(500).json({ error: "The CV report could not be saved." });
    const [saved] = await db.select({ createdAt: memberCvReports.createdAt }).from(memberCvReports).where(and(eq(memberCvReports.id, reportId), eq(memberCvReports.memberId, memberId))).limit(1);
    return res.json({ report: { ...report, id: reportId, targetLabel, createdAt: saved?.createdAt ?? new Date() } });
  } catch (error) {
    if (error instanceof InvalidCvUploadError || error instanceof InvalidJobAdvertError) return res.status(400).json({ error: error.message });
    const errorMessage = error instanceof Error ? error.message : "";
    if (/gm_member_cv_reports/i.test(errorMessage) && /does not exist|unknown table|no such table/i.test(errorMessage)) return res.status(503).json({ error: "CV report storage is not installed yet. Ask the site administrator to apply migration 0012, then retry." });
    return res.status(500).json({ error: "The CV check could not be completed or saved. Your uploaded files were not retained; please try again." });
  } finally {
    uploadedBuffer?.fill(0);
    jobAdvertBuffer?.fill(0);
    cvText = "";
    jobAdvertText = "";
    targetText = "";
  }
});

router.get("/cv-reports", requireMember, async (_req, res) => {
  const memberId = Number(res.locals.memberId);
  const db = await getDb();
  if (!db) return res.status(503).json({ error: "Saved CV reports are temporarily unavailable." });
  const rows = await db.select({ id: memberCvReports.id, score: memberCvReports.score, targetLabel: memberCvReports.targetLabel, reportJson: memberCvReports.reportJson, createdAt: memberCvReports.createdAt })
    .from(memberCvReports).where(eq(memberCvReports.memberId, memberId)).orderBy(desc(memberCvReports.createdAt)).limit(50);
  const reports = rows.flatMap(row => {
    try { return [{ id: row.id, score: row.score, targetLabel: row.targetLabel, createdAt: row.createdAt, report: JSON.parse(row.reportJson) }]; }
    catch { return []; }
  });
  return res.json({ reports });
});

router.delete("/cv-reports/:reportId", requireMember, async (req, res) => {
  if (!requireSameOrigin(req, res)) return;
  const reportId = Number(req.params.reportId);
  if (!Number.isSafeInteger(reportId) || reportId < 1) return res.status(400).json({ error: "Invalid CV report." });
  const db = await getDb();
  if (!db) return res.status(503).json({ error: "The CV report could not be deleted." });
  const removed = await db.delete(memberCvReports).where(and(eq(memberCvReports.id, reportId), eq(memberCvReports.memberId, Number(res.locals.memberId))));
  return res.json({ deleted: Number((removed as any)?.[0]?.affectedRows ?? 0) > 0 });
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

export function createMemberRouter() { return router; }
