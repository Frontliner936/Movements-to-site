import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, max } from "drizzle-orm";
import { Router } from "express";
import type { Request, Response } from "express";
import { getDb } from "../db";
import { companies, contactMessages, jobs, jobReactions, jobViewers, pendingJobs, scanSchedules, sources } from "../../drizzle/schema";
import { createHeartbeatJob, updateHeartbeatJob } from "../_core/heartbeat";
import { ADMIN_EMAIL, isAdmin, login, logout, requireAdmin, requireSameOrigin } from "./auth";
import { runSource } from "./source-runner";
import { validateSourceUrl, type SourceType } from "./collector";

const router = Router();
const loginAttempts = new Map<string, { count: number; until: number }>();
const now = () => new Date();
const textValue = (value: unknown, maximum: number) => typeof value === "string" && value.trim() ? value.trim().slice(0, maximum) : null;
const safeHttpUrl = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.toString().slice(0, 2048) : null;
  } catch { return null; }
};
const safeAssetUrl = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  if (value.startsWith("/manus-storage/") && !value.includes("..")) return value.slice(0, 2048);
  return safeHttpUrl(value);
};
const slug = (name: string) => name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100) || "company";
const idParam = (req: Request) => {
  const id = Number(req.params.id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};
const sendDbUnavailable = (res: Response) => res.status(503).json({ error: "Administration is temporarily unavailable." });

router.get("/session", async (req, res) => res.json({ authenticated: await isAdmin(req), email: await isAdmin(req) ? ADMIN_EMAIL : null }));
router.post("/login", async (req, res) => {
  if (!requireSameOrigin(req, res)) return;
  const remote = String(req.ip ?? "unknown");
  const nowMs = Date.now();
  const attempt = loginAttempts.get(remote);
  if (attempt && attempt.until > nowMs && attempt.count >= 10) return res.status(429).json({ error: "Too many sign-in attempts. Try again later." });
  const result = await login(req, res);
  if (res.statusCode === 401) {
    const current = loginAttempts.get(remote);
    loginAttempts.set(remote, { count: (current && current.until > nowMs ? current.count : 0) + 1, until: nowMs + 15 * 60_000 });
  } else loginAttempts.delete(remote);
  return result;
});
router.post("/logout", requireAdmin, async (req, res) => logout(req, res));
router.use(requireAdmin);

router.get("/overview", async (_req, res) => {
  const db = await getDb(); if (!db) return sendDbUnavailable(res);
  const [jobCounts, companyCounts, sourceCounts, pendingCounts, recentRuns, schedule, unreadMessages] = await Promise.all([
    db.select({ status: jobs.status, total: count() }).from(jobs).groupBy(jobs.status),
    db.select({ total: count() }).from(companies),
    db.select({ active: sources.isActive, total: count() }).from(sources).groupBy(sources.isActive),
    db.select({ total: count() }).from(pendingJobs).where(eq(pendingJobs.status, "pending")),
    db.select({ id: sources.id, name: sources.name, lastRunAt: sources.lastRunAt, lastRunError: sources.lastRunError, lastRunCount: sources.lastRunCount, isActive: sources.isActive }).from(sources).orderBy(desc(sources.lastRunAt)).limit(8),
    db.select().from(scanSchedules).where(eq(scanSchedules.id, 1)).limit(1),
    db.select({ total: count() }).from(contactMessages).where(eq(contactMessages.isRead, false)),
  ]);
  return res.json({ jobs: Object.fromEntries(jobCounts.map(item => [item.status, Number(item.total)])), companies: Number(companyCounts[0]?.total ?? 0), sources: sourceCounts.reduce((sum, item) => sum + Number(item.total), 0), activeSources: sourceCounts.filter(item => item.active).reduce((sum, item) => sum + Number(item.total), 0), pending: Number(pendingCounts[0]?.total ?? 0), unreadMessages: Number(unreadMessages[0]?.total ?? 0), recentRuns, schedule: schedule[0] ?? { enabled: false, cronExpression: "0 0 6 * * *", heartbeatTaskUid: null, lastRunAt: null } });
});

router.get("/messages", async (_req, res) => {
  const db = await getDb(); if (!db) return sendDbUnavailable(res);
  const [messages, unread] = await Promise.all([
    db.select().from(contactMessages).orderBy(asc(contactMessages.isRead), desc(contactMessages.createdAt)).limit(500),
    db.select({ total: count() }).from(contactMessages).where(eq(contactMessages.isRead, false)),
  ]);
  return res.json({ messages, unreadMessages: Number(unread[0]?.total ?? 0) });
});

router.patch("/messages/:id/read", async (req, res) => {
  const id = idParam(req); if (!id) return res.status(400).json({ error: "Invalid message id." });
  if (typeof req.body?.isRead !== "boolean") return res.status(400).json({ error: "Choose whether the message is read." });
  const db = await getDb(); if (!db) return sendDbUnavailable(res);
  const [existing] = await db.select({ id: contactMessages.id }).from(contactMessages).where(eq(contactMessages.id, id)).limit(1);
  if (!existing) return res.status(404).json({ error: "Message not found." });
  await db.update(contactMessages).set({ isRead: req.body.isRead, readAt: req.body.isRead ? now() : null }).where(eq(contactMessages.id, id));
  return res.json({ updated: true });
});

router.get("/analytics/jobs", async (_req, res) => {
  const db = await getDb(); if (!db) return sendDbUnavailable(res);
  const published = await db.select({ job: jobs, company: companies }).from(jobs)
    .leftJoin(companies, eq(jobs.companyId, companies.id))
    .where(eq(jobs.status, "published")).orderBy(desc(jobs.publishedAt), desc(jobs.createdAt));
  const jobIds = published.map(row => row.job.id);
  const visitorCounts = jobIds.length ? await db.select({ jobId: jobViewers.jobId, uniqueVisitors: count(), lastViewedAt: max(jobViewers.lastViewedAt) })
    .from(jobViewers).where(inArray(jobViewers.jobId, jobIds)).groupBy(jobViewers.jobId) : [];
  const byJob = new Map(visitorCounts.map(item => [item.jobId, item]));
  const rows = published.map(({ job, company }) => {
    const stats = byJob.get(job.id);
    return {
      id: job.id, title: job.title, companyName: job.companyName ?? company?.name ?? null,
      location: job.location, publishedAt: job.publishedAt,
      uniqueVisitors: Number(stats?.uniqueVisitors ?? 0), lastViewedAt: stats?.lastViewedAt ?? null,
    };
  });
  return res.json({ jobs: rows });
});

function normalizeJob(body: any, old?: typeof jobs.$inferSelect) {
  const title = textValue(body.title ?? old?.title, 300);
  if (!title) throw new Error("Job title is required.");
  const rawStatus = body.status ?? old?.status ?? "draft";
  if (rawStatus !== "draft" && rawStatus !== "published") throw new Error("Job status must be draft or published.");
  const companyIdRaw = body.companyId === undefined ? old?.companyId : Number(body.companyId);
  const companyId = Number.isSafeInteger(companyIdRaw) && Number(companyIdRaw) > 0 ? Number(companyIdRaw) : null;
  const companyName = body.companyName === undefined ? old?.companyName ?? null : textValue(body.companyName, 240);
  const companyDescription = body.companyDescription === undefined ? old?.companyDescription ?? null : textValue(body.companyDescription, 12_000);
  const companyLogoUrl = body.companyLogoUrl === undefined ? old?.companyLogoUrl ?? null : safeAssetUrl(body.companyLogoUrl);
  const companyWebsiteUrl = body.companyWebsiteUrl === undefined ? old?.companyWebsiteUrl ?? null : safeHttpUrl(body.companyWebsiteUrl);
  const imageUrl = body.imageUrl === undefined ? old?.imageUrl ?? null : safeAssetUrl(body.imageUrl);
  const sourceUrl = body.sourceUrl === undefined ? old?.sourceUrl ?? null : safeHttpUrl(body.sourceUrl);
  const applicationUrl = body.applicationUrl === undefined ? old?.applicationUrl ?? null : safeHttpUrl(body.applicationUrl);
  const publishedAt = rawStatus === "published" ? (old?.status === "published" && old.publishedAt ? old.publishedAt : now()) : null;
  return {
    title, companyId, companyName, companyDescription, companyLogoUrl, companyWebsiteUrl,
    category: body.category === undefined ? old?.category ?? null : textValue(body.category, 120),
    location: body.location === undefined ? old?.location ?? null : textValue(body.location, 240),
    deadline: body.deadline === undefined ? old?.deadline ?? null : textValue(body.deadline, 240),
    description: body.description === undefined ? old?.description ?? null : textValue(body.description, 30_000),
    responsibilities: body.responsibilities === undefined ? old?.responsibilities ?? null : textValue(body.responsibilities, 12_000),
    qualifications: body.qualifications === undefined ? old?.qualifications ?? null : textValue(body.qualifications, 12_000),
    howToApply: body.howToApply === undefined ? old?.howToApply ?? null : textValue(body.howToApply, 8_000),
    applicationUrl, imageUrl, sourceUrl, status: rawStatus as "draft" | "published", publishedAt,
  };
}

router.get("/jobs", async (_req, res) => {
  const db = await getDb(); if (!db) return sendDbUnavailable(res);
  const rows = await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(1500);
  return res.json({ jobs: rows });
});
router.post("/jobs", async (req, res) => {
  const db = await getDb(); if (!db) return sendDbUnavailable(res);
  try {
    const input = normalizeJob(req.body);
    if (input.companyId) {
      const [company] = await db.select({ id: companies.id }).from(companies).where(eq(companies.id, input.companyId)).limit(1);
      if (!company) return res.status(400).json({ error: "Select an existing company profile or leave the company profile blank." });
    }
    const result = await db.insert(jobs).values(input);
    const id = Number((result as any)?.[0]?.insertId ?? 0);
    const [created] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    return res.status(201).json({ job: created });
  } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : "Job could not be saved." }); }
});
router.put("/jobs/:id", async (req, res) => {
  const id = idParam(req); if (!id) return res.status(400).json({ error: "Invalid job id." });
  const db = await getDb(); if (!db) return sendDbUnavailable(res);
  const [old] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  if (!old) return res.status(404).json({ error: "Job not found." });
  try {
    const input = normalizeJob(req.body, old);
    if (input.companyId) {
      const [company] = await db.select({ id: companies.id }).from(companies).where(eq(companies.id, input.companyId)).limit(1);
      if (!company) return res.status(400).json({ error: "Select an existing company profile or leave the company profile blank." });
    }
    await db.update(jobs).set(input).where(eq(jobs.id, id));
    const [updated] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    return res.json({ job: updated });
  } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : "Job could not be updated." }); }
});
router.delete("/jobs/:id", async (req, res) => {
  const id = idParam(req); if (!id) return res.status(400).json({ error: "Invalid job id." });
  const db = await getDb(); if (!db) return sendDbUnavailable(res);
  await db.delete(jobReactions).where(eq(jobReactions.jobId, id));
  await db.delete(jobs).where(eq(jobs.id, id));
  return res.json({ deleted: true });
});

router.get("/companies", async (_req, res) => {
  const db = await getDb(); if (!db) return sendDbUnavailable(res);
  return res.json({ companies: await db.select().from(companies).orderBy(companies.name).limit(1000) });
});
router.post("/companies", async (req, res) => {
  const db = await getDb(); if (!db) return sendDbUnavailable(res);
  const name = textValue(req.body?.name, 240);
  if (!name) return res.status(400).json({ error: "Company name is required." });
  const baseSlug = slug(name);
  try {
    const result = await db.insert(companies).values({ name, slug: `${baseSlug}-${randomUUID().slice(0, 6)}`, description: textValue(req.body.description, 12000), logoUrl: safeAssetUrl(req.body.logoUrl), websiteUrl: safeHttpUrl(req.body.websiteUrl), location: textValue(req.body.location, 240) });
    const id = Number((result as any)?.[0]?.insertId ?? 0);
    const [company] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
    return res.status(201).json({ company });
  } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : "Company profile could not be saved." }); }
});
router.put("/companies/:id", async (req, res) => {
  const id = idParam(req); if (!id) return res.status(400).json({ error: "Invalid company id." });
  const db = await getDb(); if (!db) return sendDbUnavailable(res);
  const [old] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  if (!old) return res.status(404).json({ error: "Company profile not found." });
  const name = textValue(req.body?.name, 240);
  if (!name) return res.status(400).json({ error: "Company name is required." });
  await db.update(companies).set({ name, description: textValue(req.body.description, 12000), logoUrl: safeAssetUrl(req.body.logoUrl), websiteUrl: safeHttpUrl(req.body.websiteUrl), location: textValue(req.body.location, 240) }).where(eq(companies.id, id));
  const [updated] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return res.json({ company: updated });
});
router.delete("/companies/:id", async (req, res) => {
  const id = idParam(req); if (!id) return res.status(400).json({ error: "Invalid company id." });
  const db = await getDb(); if (!db) return sendDbUnavailable(res);
  await db.update(jobs).set({ companyId: null }).where(eq(jobs.companyId, id));
  await db.delete(companies).where(eq(companies.id, id));
  return res.json({ deleted: true });
});

function parseSettings(input: any) {
  let value = input;
  if (typeof value === "string") { try { value = JSON.parse(value); } catch { throw new Error("Source settings must be valid JSON."); } }
  if (!value || typeof value !== "object" || Array.isArray(value)) value = {};
  const settings = {
    companyName: textValue(value.companyName, 240) ?? undefined,
    itemsPath: textValue(value.itemsPath, 240) ?? undefined,
    linkSelector: textValue(value.linkSelector, 160) ?? undefined,
    fieldMap: value.fieldMap && typeof value.fieldMap === "object" && !Array.isArray(value.fieldMap) ? value.fieldMap : undefined,
  };
  if (JSON.stringify(settings).length > 4000) throw new Error("Source settings exceed the allowed size.");
  return settings;
}
function validateSourceInput(body: any) {
  const name = textValue(body.name, 240);
  const type = body.type as SourceType;
  const url = safeHttpUrl(body.url);
  if (!name || !url || !["rss", "json", "career", "scraper"].includes(type)) throw new Error("Provide a source name, valid HTTP/HTTPS URL, and supported source type.");
  return { name, type, url, settings: JSON.stringify(parseSettings(body.settings)), isActive: body.isActive !== false };
}
router.get("/sources", async (_req, res) => {
  const db = await getDb(); if (!db) return sendDbUnavailable(res);
  const rows = await db.select().from(sources).orderBy(desc(sources.createdAt)).limit(1000);
  return res.json({ sources: rows.map(row => ({ ...row, settings: (() => { try { return JSON.parse(row.settings ?? "{}"); } catch { return {}; } })() })) });
});
router.post("/sources", async (req, res) => {
  const db = await getDb(); if (!db) return sendDbUnavailable(res);
  try {
    const input = validateSourceInput(req.body);
    await validateSourceUrl(input.url);
    const result = await db.insert(sources).values(input);
    const id = Number((result as any)?.[0]?.insertId ?? 0);
    const [created] = await db.select().from(sources).where(eq(sources.id, id)).limit(1);
    return res.status(201).json({ source: { ...created, settings: parseSettings(created.settings) } });
  } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : "Source could not be saved." }); }
});
router.put("/sources/:id", async (req, res) => {
  const id = idParam(req); if (!id) return res.status(400).json({ error: "Invalid source id." });
  const db = await getDb(); if (!db) return sendDbUnavailable(res);
  try {
    const input = validateSourceInput(req.body);
    await validateSourceUrl(input.url);
    await db.update(sources).set(input).where(eq(sources.id, id));
    const [updated] = await db.select().from(sources).where(eq(sources.id, id)).limit(1);
    if (!updated) return res.status(404).json({ error: "Source not found." });
    return res.json({ source: { ...updated, settings: parseSettings(updated.settings) } });
  } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : "Source could not be updated." }); }
});
router.delete("/sources/:id", async (req, res) => {
  const id = idParam(req); if (!id) return res.status(400).json({ error: "Invalid source id." });
  const db = await getDb(); if (!db) return sendDbUnavailable(res);
  await db.delete(sources).where(eq(sources.id, id));
  return res.json({ deleted: true });
});
router.post("/sources/:id/run", async (req, res) => {
  const id = idParam(req); if (!id) return res.status(400).json({ error: "Invalid source id." });
  try { return res.json({ result: await runSource(id) }); }
  catch (error) { return res.status(502).json({ error: error instanceof Error ? error.message : "Source scan failed." }); }
});

router.get("/pending", async (_req, res) => {
  const db = await getDb(); if (!db) return sendDbUnavailable(res);
  const rows = await db.select().from(pendingJobs).where(eq(pendingJobs.status, "pending")).orderBy(desc(pendingJobs.createdAt)).limit(1000);
  return res.json({ pending: rows.map(item => ({ ...item, duplicateMatches: (() => { try { return JSON.parse(item.duplicateMatches ?? "[]"); } catch { return []; } })() })) });
});
router.put("/pending/:id", async (req, res) => {
  const id = idParam(req); if (!id) return res.status(400).json({ error: "Invalid pending job id." });
  const db = await getDb(); if (!db) return sendDbUnavailable(res);
  const [old] = await db.select().from(pendingJobs).where(and(eq(pendingJobs.id, id), eq(pendingJobs.status, "pending"))).limit(1);
  if (!old) return res.status(404).json({ error: "Pending listing not found." });
  try {
    const values = normalizeJob({ ...req.body, status: "draft" }, { ...old, status: "draft", publishedAt: null } as any);
    await db.update(pendingJobs).set({ title: values.title, companyName: values.companyName, companyDescription: values.companyDescription, companyLogoUrl: values.companyLogoUrl, companyWebsiteUrl: values.companyWebsiteUrl, category: values.category, location: values.location, deadline: values.deadline, description: values.description, responsibilities: values.responsibilities, qualifications: values.qualifications, howToApply: values.howToApply, applicationUrl: values.applicationUrl, imageUrl: values.imageUrl }).where(eq(pendingJobs.id, id));
    const [fresh] = await db.select().from(pendingJobs).where(eq(pendingJobs.id, id)).limit(1);
    return res.json({ pending: fresh });
  } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : "Pending listing could not be updated." }); }
});
router.post("/pending/:id/approve", async (req, res) => {
  const id = idParam(req); if (!id) return res.status(400).json({ error: "Invalid pending job id." });
  const db = await getDb(); if (!db) return sendDbUnavailable(res);
  try {
    let publishedId = 0;
    let didPublish = false;
    await db.transaction(async tx => {
      const [pending] = await tx.select().from(pendingJobs).where(and(eq(pendingJobs.id, id), eq(pendingJobs.status, "pending"))).limit(1).for("update");
      if (!pending) return;
      let companyId: number | null = null;
      if (pending.companyName) {
        const match = await tx.select({ id: companies.id }).from(companies).where(eq(companies.name, pending.companyName)).limit(1);
        companyId = match[0]?.id ?? null;
      }
      const inserted = await tx.insert(jobs).values({ title: pending.title, companyId, companyName: pending.companyName, companyDescription: pending.companyDescription, companyLogoUrl: pending.companyLogoUrl, companyWebsiteUrl: pending.companyWebsiteUrl, category: pending.category, location: pending.location, deadline: pending.deadline, description: pending.description, responsibilities: pending.responsibilities, qualifications: pending.qualifications, howToApply: pending.howToApply, applicationUrl: pending.applicationUrl, imageUrl: pending.imageUrl, sourceUrl: pending.sourceUrl, sourceId: pending.sourceId, status: "published", publishedAt: now() });
      publishedId = Number((inserted as any)?.[0]?.insertId ?? 0);
      await tx.update(pendingJobs).set({ status: "approved", reviewedAt: now() }).where(and(eq(pendingJobs.id, id), eq(pendingJobs.status, "pending")));
      didPublish = true;
    });
    if (!didPublish) return res.status(404).json({ error: "Pending listing not found or already reviewed." });
    const [job] = await db.select().from(jobs).where(eq(jobs.id, publishedId)).limit(1);
    return res.json({ published: true, job });
  } catch (error) { return res.status(500).json({ error: error instanceof Error ? error.message : "Listing could not be approved." }); }
});
router.post("/pending/:id/reject", async (req, res) => {
  const id = idParam(req); if (!id) return res.status(400).json({ error: "Invalid pending job id." });
  const db = await getDb(); if (!db) return sendDbUnavailable(res);
  await db.update(pendingJobs).set({ status: "rejected", reviewedAt: now() }).where(and(eq(pendingJobs.id, id), eq(pendingJobs.status, "pending")));
  return res.json({ rejected: true });
});

const scheduleOptions = new Set(["0 0 6 * * *", "0 0 6,15 * * *", "0 0 0,12 * * *"]);
router.post("/schedule", async (req, res) => {
  const db = await getDb(); if (!db) return sendDbUnavailable(res);
  const enabled = req.body?.enabled === true;
  const cronExpression = String(req.body?.cronExpression ?? "0 0 6 * * *");
  if (!scheduleOptions.has(cronExpression)) return res.status(400).json({ error: "Choose one of the supported daily or twice-daily scan schedules." });
  const [existing] = await db.select().from(scanSchedules).where(eq(scanSchedules.id, 1)).limit(1);
  try {
    let heartbeatTaskUid = existing?.heartbeatTaskUid ?? null;
    if (enabled) {
      const spec = { cron: cronExpression, path: "/api/scheduled/get-mchongo-sources", method: "POST" as const, description: "Collect active Get Mchongo opportunity sources into admin review." };
      if (heartbeatTaskUid) await updateHeartbeatJob(heartbeatTaskUid, { cron: spec.cron, path: spec.path, method: spec.method, description: spec.description, enable: true }, "");
      else heartbeatTaskUid = (await createHeartbeatJob({ name: "get-mchongo-sources", ...spec }, "")).taskUid;
    } else if (heartbeatTaskUid) await updateHeartbeatJob(heartbeatTaskUid, { enable: false }, "");
    const values = { heartbeatTaskUid, cronExpression, enabled, updatedAt: now() };
    if (existing) await db.update(scanSchedules).set(values).where(eq(scanSchedules.id, 1));
    else await db.insert(scanSchedules).values({ id: 1, ...values });
    return res.json({ schedule: { ...values, lastRunAt: existing?.lastRunAt ?? null } });
  } catch (error) { return res.status(502).json({ error: error instanceof Error ? error.message : "The scan schedule could not be saved." }); }
});

router.post("/upload", async (req, res) => {
  const mime = String(req.body?.mimeType ?? "").toLowerCase();
  const encoded = typeof req.body?.base64 === "string" ? req.body.base64.replace(/^data:[^,]+,/, "") : "";
  if (!new Set(["image/png", "image/jpeg", "image/webp"]).has(mime) || !encoded || encoded.length > 7_000_000) return res.status(400).json({ error: "Upload a PNG, JPEG or WebP image no larger than 5 MB." });
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length > 5 * 1024 * 1024) return res.status(400).json({ error: "Image exceeds the 5 MB upload limit." });
  const signature = mime === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : mime === "image/jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff : bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  if (!signature) return res.status(400).json({ error: "Image file content does not match its image type." });
  const apiUrl = process.env.MANUS_API_URL; const apiKey = process.env.MANUS_API_KEY;
  if (!apiUrl || !apiKey) return res.status(503).json({ error: "Image storage is not available in this environment." });
  const suffix = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : "webp";
  const objectPath = `get-mchongo/uploads/${randomUUID()}.${suffix}`;
  try {
    const base = apiUrl.endsWith("/") ? apiUrl : `${apiUrl}/`;
    const presign = await fetch(new URL(`v1/storage/presign/put?path=${encodeURIComponent(objectPath)}`, base), { headers: { authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(10_000) });
    if (!presign.ok) return res.status(502).json({ error: "Could not prepare a secure image upload." });
    const payload = await presign.json() as { url?: string };
    if (!payload.url) return res.status(502).json({ error: "The image storage service did not return an upload URL." });
    const upload = await fetch(payload.url, { method: "PUT", headers: { "content-type": mime }, body: bytes, signal: AbortSignal.timeout(30_000) });
    if (!upload.ok) return res.status(502).json({ error: "The image could not be stored." });
    return res.json({ url: `/manus-storage/${objectPath}` });
  } catch { return res.status(502).json({ error: "The image upload failed. Please try again." }); }
});

export function createAdminRouter() { return router; }
