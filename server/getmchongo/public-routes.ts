import { createHash, randomUUID } from "node:crypto";
import { and, count, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { Router } from "express";
import type { Request } from "express";
import { getDb } from "../db";
import { companies, jobs, jobReactions, jobViewers, pendingJobs } from "../../drizzle/schema";
import { requireSameOrigin } from "./auth";
import { findDuplicateMatches } from "./duplicates";
import { getJobShareImageUrl, getPublicSiteOrigin } from "./share-meta";

const visitorKey = (req: Request) => {
  const value = String(req.get("x-visitor-key") ?? "");
  return /^[a-z0-9-]{16,64}$/i.test(value) ? value : null;
};
const companyHref = (company: typeof companies.$inferSelect | null) => company ? `/companies/${company.id}` : null;
const submittedText = (value: unknown, maximum: number) => typeof value === "string" && value.trim() ? value.trim().slice(0, maximum) : null;
function submittedUrl(value: unknown, maximum = 2048) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.toString().slice(0, maximum) : null;
  } catch { return null; }
}
function submittedImage(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const candidate = value.trim();
  if (candidate.startsWith("/manus-storage/") && !candidate.includes("..")) return candidate.slice(0, 2048);
  return submittedUrl(candidate);
}

async function addReactionSummary(rows: Array<{ job: typeof jobs.$inferSelect; company: typeof companies.$inferSelect | null }>, viewer: string | null) {
  const db = await getDb();
  const ids = rows.map(row => row.job.id);
  const counts = new Map<number, { like: number; save: number }>();
  const active = new Map<number, Set<string>>();
  if (db && ids.length) {
    const totals = await db.select({ jobId: jobReactions.jobId, kind: jobReactions.kind, amount: count() })
      .from(jobReactions).where(inArray(jobReactions.jobId, ids)).groupBy(jobReactions.jobId, jobReactions.kind);
    for (const total of totals) {
      const entry = counts.get(total.jobId) ?? { like: 0, save: 0 };
      entry[total.kind] = Number(total.amount);
      counts.set(total.jobId, entry);
    }
    if (viewer) {
      const mine = await db.select({ jobId: jobReactions.jobId, kind: jobReactions.kind }).from(jobReactions)
        .where(and(inArray(jobReactions.jobId, ids), eq(jobReactions.visitorKey, viewer)));
      for (const item of mine) {
        const entry = active.get(item.jobId) ?? new Set<string>();
        entry.add(item.kind); active.set(item.jobId, entry);
      }
    }
  }
  return rows.map(({ job, company }) => {
    const summary = counts.get(job.id) ?? { like: 0, save: 0 };
    const chosen = active.get(job.id) ?? new Set<string>();
    return {
      ...job,
      companyName: job.companyName ?? company?.name ?? null,
      companyDescription: job.companyDescription ?? company?.description ?? null,
      companyLogoUrl: job.companyLogoUrl ?? company?.logoUrl ?? null,
      companyWebsiteUrl: job.companyWebsiteUrl ?? company?.websiteUrl ?? null,
      companyHref: companyHref(company),
      shareImageUrl: getJobShareImageUrl(job, company, getPublicSiteOrigin()),
      likeCount: summary.like, saveCount: summary.save,
      liked: chosen.has("like"), saved: chosen.has("save"),
    };
  });
}

export function createPublicRouter() {
  const router = Router();
  router.get("/jobs", async (req, res) => {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Job listings are temporarily unavailable." });
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 160) : "";
    const category = typeof req.query.category === "string" ? req.query.category.trim().slice(0, 120) : "";
    const location = typeof req.query.location === "string" ? req.query.location.trim().slice(0, 160) : "";
    const predicates = [eq(jobs.status, "published")];
    if (q) {
      const term = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
      const searchPredicate = or(like(jobs.title, term), like(jobs.companyName, term), like(companies.name, term));
      if (searchPredicate) predicates.push(searchPredicate);
    }
    if (category) predicates.push(eq(jobs.category, category));
    if (location) predicates.push(like(jobs.location, `%${location.replace(/[\\%_]/g, "\\$&")}%`));
    const rows = await db.select({ job: jobs, company: companies }).from(jobs)
      .leftJoin(companies, eq(jobs.companyId, companies.id))
      .where(and(...predicates)).orderBy(desc(jobs.publishedAt), desc(jobs.createdAt)).limit(200);
    const mapped = await addReactionSummary(rows, visitorKey(req));
    const taxonomy = await db.select({ category: jobs.category, location: jobs.location }).from(jobs).where(eq(jobs.status, "published"));
    const categories = [...new Set(taxonomy.map(item => item.category).filter((item): item is string => !!item))].sort();
    const locations = [...new Set(taxonomy.map(item => item.location).filter((item): item is string => !!item))].sort();
    return res.json({ jobs: mapped, total: mapped.length, categories, locations });
  });

  router.get("/jobs/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(404).json({ error: "Listing not found." });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Job listings are temporarily unavailable." });
    const rows = await db.select({ job: jobs, company: companies }).from(jobs)
      .leftJoin(companies, eq(jobs.companyId, companies.id))
      .where(and(eq(jobs.id, id), eq(jobs.status, "published"))).limit(1);
    if (!rows.length) return res.status(404).json({ error: "Listing not found." });
    const mapped = await addReactionSummary(rows, visitorKey(req));
    return res.json({ job: mapped[0] });
  });

  router.post("/submissions", async (req, res) => {
    if (!requireSameOrigin(req, res)) return;
    if (submittedText(req.body?.fax, 300)) return res.status(201).json({ submitted: true, pendingReview: true });
    const title = submittedText(req.body?.title, 300);
    const companyName = submittedText(req.body?.companyName, 240);
    const description = submittedText(req.body?.description, 30_000);
    const responsibilities = submittedText(req.body?.responsibilities, 12_000);
    const qualifications = submittedText(req.body?.qualifications, 12_000);
    const howToApply = submittedText(req.body?.howToApply, 8_000);
    const applicationUrl = submittedUrl(req.body?.applicationUrl);
    const sourceUrl = submittedUrl(req.body?.sourceUrl);
    const companyWebsiteUrl = submittedUrl(req.body?.companyWebsiteUrl);
    const imageUrl = submittedImage(req.body?.imageUrl);
    const companyLogoUrl = submittedImage(req.body?.companyLogoUrl);
    if (!title || !companyName || !description) return res.status(400).json({ error: "Enter the job title, company or institution, and job description." });
    if (!applicationUrl && !howToApply) return res.status(400).json({ error: "Add an application link or clear instructions for how to apply." });
    if ((req.body?.applicationUrl && !applicationUrl) || (req.body?.sourceUrl && !sourceUrl) || (req.body?.companyWebsiteUrl && !companyWebsiteUrl) || (req.body?.imageUrl && !imageUrl) || (req.body?.companyLogoUrl && !companyLogoUrl)) {
      return res.status(400).json({ error: "One of the supplied website or image links is invalid. Use public HTTP or HTTPS URLs." });
    }
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Job submissions are temporarily unavailable. Please try again." });
    try {
      const candidate = { title, companyName, applicationUrl, description };
      const [existingJobs, existingPending] = await Promise.all([
        db.select({ id: jobs.id, title: jobs.title, companyName: jobs.companyName, companyProfileName: companies.name, applicationUrl: jobs.applicationUrl, description: jobs.description })
          .from(jobs).leftJoin(companies, eq(jobs.companyId, companies.id)),
        db.select({ id: pendingJobs.id, title: pendingJobs.title, companyName: pendingJobs.companyName, applicationUrl: pendingJobs.applicationUrl, description: pendingJobs.description })
          .from(pendingJobs).where(eq(pendingJobs.status, "pending")),
      ]);
      const records = [
        ...existingJobs.map(item => ({ ...item, companyName: item.companyName ?? item.companyProfileName, recordType: "job" as const, recordId: item.id })),
        ...existingPending.map(item => ({ ...item, recordType: "pending" as const, recordId: item.id })),
      ];
      const duplicateMatches = findDuplicateMatches(candidate, records);
      const sourceFingerprint = createHash("sha256").update(`public-submission:${randomUUID()}`).digest("hex");
      await db.insert(pendingJobs).values({
        sourceId: 0, sourceName: "Public employer submission", sourceFingerprint, sourceUrl,
        title, companyName, companyDescription: submittedText(req.body?.companyDescription, 12_000),
        companyLogoUrl, companyWebsiteUrl, category: submittedText(req.body?.category, 120),
        location: submittedText(req.body?.location, 240), deadline: submittedText(req.body?.deadline, 240),
        description, responsibilities, qualifications, howToApply, applicationUrl, imageUrl,
        rawContext: "Submitted through the public Get Mchongo job form. This listing is private until an administrator reviews it.",
        duplicateMatches: JSON.stringify(duplicateMatches), status: "pending",
      });
      return res.status(201).json({ submitted: true, pendingReview: true });
    } catch {
      return res.status(500).json({ error: "Your job could not be submitted. Please try again." });
    }
  });

  router.post("/jobs/:id/view", async (req, res) => {
    const id = Number(req.params.id);
    const rawViewer = String(req.get("x-job-viewer-key") ?? "");
    if (!Number.isSafeInteger(id) || id < 1 || !/^[a-z0-9-]{16,64}$/i.test(rawViewer)) return res.status(400).json({ error: "A valid job and anonymous browser key are required." });
    const viewerHash = createHash("sha256").update(rawViewer).digest("hex");
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Visitor analytics are temporarily unavailable." });
    const [job] = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.id, id), eq(jobs.status, "published"))).limit(1);
    if (!job) return res.status(404).json({ error: "Listing not found." });
    await db.insert(jobViewers).values({ jobId: id, visitorKey: viewerHash })
      .onDuplicateKeyUpdate({ set: { lastViewedAt: sql`CURRENT_TIMESTAMP` } });
    return res.json({ recorded: true });
  });

  router.get("/companies/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(404).json({ error: "Company profile not found." });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Company profiles are temporarily unavailable." });
    const [company] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
    if (!company) return res.status(404).json({ error: "Company profile not found." });
    const rows = await db.select({ job: jobs, company: companies }).from(jobs)
      .leftJoin(companies, eq(jobs.companyId, companies.id))
      .where(and(eq(jobs.status, "published"), eq(jobs.companyId, id))).orderBy(desc(jobs.publishedAt));
    const mapped = await addReactionSummary(rows, visitorKey(req));
    return res.json({ company, jobs: mapped });
  });

  router.post("/jobs/:id/react/:kind", async (req, res) => {
    const id = Number(req.params.id);
    const kind = req.params.kind;
    const visitor = visitorKey(req);
    if (!Number.isSafeInteger(id) || id < 1 || !["like", "save"].includes(kind) || !visitor) return res.status(400).json({ error: "A valid job and visitor key are required." });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Reactions are temporarily unavailable." });
    const [job] = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.id, id), eq(jobs.status, "published"))).limit(1);
    if (!job) return res.status(404).json({ error: "Listing not found." });
    const match = and(eq(jobReactions.jobId, id), eq(jobReactions.visitorKey, visitor), eq(jobReactions.kind, kind as "like" | "save"));
    const [existing] = await db.select({ id: jobReactions.id }).from(jobReactions).where(match).limit(1);
    if (existing) await db.delete(jobReactions).where(eq(jobReactions.id, existing.id));
    else await db.insert(jobReactions).values({ jobId: id, visitorKey: visitor, kind: kind as "like" | "save" });
    const [summary] = await db.select({ amount: count() }).from(jobReactions).where(and(eq(jobReactions.jobId, id), eq(jobReactions.kind, kind as "like" | "save")));
    return res.json({ active: !existing, count: Number(summary?.amount ?? 0) });
  });
  return router;
}
