import { desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { jobs, pendingJobs, sources } from "../../drizzle/schema";
import { collectFromSource, type SourceSettings, type SourceType } from "./collector";
import { candidateFingerprint, findDuplicateMatches } from "./duplicates";

function settingsOf(raw: string | null): SourceSettings {
  if (!raw) return {};
  try { const value = JSON.parse(raw); return value && typeof value === "object" ? value as SourceSettings : {}; }
  catch { return {}; }
}
function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "The source could not be collected.";
  return message.replace(/https?:\/\/\S+/gi, "source URL").replace(/[\r\n\t]+/g, " ").slice(0, 500);
}

export async function runSource(sourceId: number) {
  const db = await getDb();
  if (!db) throw new Error("The job database is unavailable.");
  const [source] = await db.select().from(sources).where(eq(sources.id, sourceId)).limit(1);
  if (!source) throw new Error("Source not found.");
  try {
    const candidates = await collectFromSource(source.type as SourceType, source.url, settingsOf(source.settings));
    const [existingJobs, existingPending] = await Promise.all([
      db.select({ id: jobs.id, title: jobs.title, companyName: jobs.companyName, applicationUrl: jobs.applicationUrl, description: jobs.description }).from(jobs).orderBy(desc(jobs.createdAt)),
      db.select({ id: pendingJobs.id, title: pendingJobs.title, companyName: pendingJobs.companyName, applicationUrl: pendingJobs.applicationUrl, description: pendingJobs.description, status: pendingJobs.status }).from(pendingJobs).where(eq(pendingJobs.status, "pending")).orderBy(desc(pendingJobs.createdAt)),
    ]);
    const records = [
      ...existingJobs.map(item => ({ ...item, recordType: "job" as const, recordId: item.id })),
      ...existingPending.map(item => ({ ...item, recordType: "pending" as const, recordId: item.id })),
    ];
    let added = 0;
    let duplicatesFlagged = 0;
    let alreadySeen = 0;
    let skipped = 0;
    for (const candidate of candidates) {
      if (!candidate.title.trim()) { skipped++; continue; }
      const fingerprint = candidateFingerprint(source.id, candidate);
      const duplicateMatches = findDuplicateMatches(candidate, records);
      const values = {
        sourceId: source.id, sourceName: source.name, sourceFingerprint: fingerprint,
        sourceUrl: candidate.sourceUrl?.slice(0, 2048) ?? null, title: candidate.title.slice(0, 300),
        companyName: candidate.companyName?.slice(0, 240) ?? null, category: candidate.category?.slice(0, 120) ?? null,
        location: candidate.location?.slice(0, 240) ?? null, deadline: candidate.deadline?.slice(0, 240) ?? null,
        description: candidate.description, responsibilities: candidate.responsibilities, qualifications: candidate.qualifications,
        howToApply: candidate.howToApply, applicationUrl: candidate.applicationUrl?.slice(0, 2048) ?? null,
        imageUrl: candidate.imageUrl?.slice(0, 2048) ?? null, rawContext: candidate.rawContext,
        duplicateMatches: JSON.stringify(duplicateMatches), status: "pending" as const,
      };
      try {
        const result = await db.insert(pendingJobs).values(values);
        const insertedId = Number((result as any)?.[0]?.insertId ?? 0);
        added++;
        if (duplicateMatches.length) duplicatesFlagged++;
        records.push({ id: insertedId, recordId: insertedId, title: values.title, companyName: values.companyName, applicationUrl: values.applicationUrl, description: values.description, status: "pending", recordType: "pending" });
      } catch (error: any) {
        if (error?.code === "ER_DUP_ENTRY" || error?.errno === 1062) { alreadySeen++; continue; }
        throw error;
      }
    }
    await db.update(sources).set({ lastRunAt: new Date(), lastRunError: null, lastRunCount: added, totalJobsFound: source.totalJobsFound + added }).where(eq(sources.id, source.id));
    return { sourceId: source.id, sourceName: source.name, candidatesFound: candidates.length, newPending: added, duplicatesFlagged, alreadySeen, skipped, error: null as string | null };
  } catch (error) {
    const message = safeError(error);
    await db.update(sources).set({ lastRunAt: new Date(), lastRunError: message, lastRunCount: 0 }).where(eq(sources.id, source.id));
    throw new Error(message);
  }
}

export async function runActiveSources() {
  const db = await getDb();
  if (!db) throw new Error("The job database is unavailable.");
  const active = await db.select({ id: sources.id, name: sources.name }).from(sources).where(eq(sources.isActive, true));
  const results: Array<{ id: number; name: string; result?: Awaited<ReturnType<typeof runSource>>; error?: string }> = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(3, active.length) }, async () => {
    while (next < active.length) {
      const current = active[next++];
      try { results.push({ id: current.id, name: current.name, result: await runSource(current.id) }); }
      catch (error) { results.push({ id: current.id, name: current.name, error: safeError(error) }); }
    }
  });
  await Promise.all(workers);
  return { sourcesScanned: active.length, newPending: results.reduce((sum, item) => sum + (item.result?.newPending ?? 0), 0), errors: results.filter(item => item.error).length, results };
}
