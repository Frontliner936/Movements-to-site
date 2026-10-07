import { and, count, desc, eq, inArray, like, or } from "drizzle-orm";
import { Router } from "express";
import type { Request } from "express";
import { getDb } from "../db";
import { companies, jobs, jobReactions } from "../../drizzle/schema";

const visitorKey = (req: Request) => {
  const value = String(req.get("x-visitor-key") ?? "");
  return /^[a-z0-9-]{16,64}$/i.test(value) ? value : null;
};
const companyHref = (company: typeof companies.$inferSelect | null) => company ? `/companies/${company.id}` : null;

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
      companyDescription: company?.description ?? null,
      companyLogoUrl: company?.logoUrl ?? null,
      companyHref: companyHref(company),
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
