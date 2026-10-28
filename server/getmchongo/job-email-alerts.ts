import { and, asc, eq, lte, sql } from "drizzle-orm";
import { createTransport, type Transporter } from "nodemailer";
import { jobs, memberAccounts, memberJobAlertDeliveries, memberJobAlertEvents } from "../../drizzle/schema";
import { getDb } from "../db";

type Job = typeof jobs.$inferSelect;
type MemberAlertPreferences = { alertCategories: string | null; alertLocations: string | null };
type MailConfig = { host: string; port: number; secure: boolean; user: string; password: string; fromEmail: string; fromName: string; siteOrigin: string };

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>.]+(?:\.[^\s@<>.]+)*\.[^\s@<>.]{2,}$/;
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 12;
const EVENT_BATCH_SIZE = 12;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 20 * 60_000, 60 * 60_000, 6 * 60 * 60_000];

function selectedValues(raw: string | null): string[] {
  try {
    const value = JSON.parse(raw ?? "[]");
    return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean))].slice(0, 30) : [];
  } catch { return []; }
}

export function jobMatchesAlertPreferences(job: Pick<Job, "category" | "location">, preferences: MemberAlertPreferences) {
  const categories = selectedValues(preferences.alertCategories);
  const locations = selectedValues(preferences.alertLocations);
  if (!categories.length && !locations.length) return false;
  if (categories.length && (!job.category || !categories.some(value => value.toLocaleLowerCase() === job.category!.trim().toLocaleLowerCase()))) return false;
  if (locations.length && (!job.location || !locations.some(value => job.location!.toLocaleLowerCase().includes(value.toLocaleLowerCase())))) return false;
  return true;
}

function publicSiteOrigin() {
  let raw = process.env.PUBLIC_SITE_ORIGIN?.trim();
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (!raw && railwayDomain && /^[a-z0-9.-]+(?::\d+)?$/i.test(railwayDomain)) raw = `https://${railwayDomain}`;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") return null;
    return url.origin;
  } catch { return null; }
}

function mailConfig(): MailConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? "");
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const fromEmail = process.env.SMTP_FROM_EMAIL?.trim();
  const fromName = (process.env.SMTP_FROM_NAME?.trim() || "Get Mchongo").replace(/[\r\n]/g, " ").slice(0, 100);
  const siteOrigin = publicSiteOrigin();
  const secureValue = process.env.SMTP_SECURE?.trim().toLowerCase();
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !password || !fromEmail || !EMAIL_RE.test(fromEmail) || !siteOrigin) return null;
  if (secureValue && !["true", "false"].includes(secureValue)) return null;
  return { host, port, secure: secureValue ? secureValue === "true" : port === 465, user, password, fromEmail, fromName, siteOrigin };
}

export function isJobAlertEmailConfigured() { return mailConfig() !== null; }

/** Must be called inside the same DB transaction that newly publishes the job. */
export async function recordJobPublicationEvent(tx: any, jobId: number) {
  try {
    await tx.insert(memberJobAlertEvents).values({ jobId }).onDuplicateKeyUpdate({ set: { status: sql`${memberJobAlertEvents.status}` } });
    return true;
  } catch (error) {
    const code = (error as { code?: string })?.code;
    const message = error instanceof Error ? error.message : "";
    if (code === "ER_NO_SUCH_TABLE" || (/gm_member_job_alert_events/i.test(message) && /doesn't exist|does not exist|unknown table/i.test(message))) {
      console.warn("[job-alert-email] Email-alert outbox migration is not installed; job publication will continue without email notifications.");
      return false;
    }
    throw error;
  }
}

function affectedRows(result: unknown) {
  const first = Array.isArray(result) ? result[0] : result;
  return Number((first as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function buildMessage(config: MailConfig, deliveryId: number, recipient: string, displayName: string, job: Job) {
  const title = job.title.trim().slice(0, 300);
  const company = job.companyName?.trim() || "Employer not listed";
  const location = job.location?.trim() || (job.isRemote ? "Remote" : "Location not listed");
  const category = job.category?.trim() || "General";
  const url = `${config.siteOrigin}/jobs/${job.id}`;
  const preferencesUrl = `${config.siteOrigin}/dashboard`;
  const safeTitle = escapeHtml(title);
  const safeCompany = escapeHtml(company);
  const safeLocation = escapeHtml(location);
  const safeCategory = escapeHtml(category);
  const safeName = escapeHtml(displayName.trim().slice(0, 100) || "there");
  const safeUrl = escapeHtml(url);
  const fromDomain = config.fromEmail.split("@").pop() || "mail.getmchongo.com";
  const subjectTitle = title.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").slice(0, 140);
  const deadline = job.deadline?.trim() ? `\nDeadline: ${job.deadline.trim().slice(0, 240)}` : "";
  return {
    from: { name: config.fromName, address: config.fromEmail },
    to: recipient,
    messageId: `<job-alert-${deliveryId}@${fromDomain}>`,
    subject: `New matching job: ${subjectTitle}`,
    text: `Hello ${displayName.trim() || "there"},\n\nA newly published job matches your email alert preferences.\n\n${title}\nCompany: ${company}\nLocation: ${location}\nCategory: ${category}${deadline}\n\nView the job: ${url}\n\nYou received this because you opted in to matching-job emails. Manage your preferences or turn off email alerts from your member dashboard: ${preferencesUrl}\n\nGet Mchongo`,
    html: `<!doctype html><html><body style="margin:0;background:#f6f7f2;font-family:Arial,sans-serif;color:#203b31"><div style="max-width:620px;margin:24px auto;padding:28px 24px;background:#fffefa;border:1px solid #e4e9e0"><p style="margin:0 0 14px;color:#82621e;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Get Mchongo · Job alert</p><h1 style="margin:0 0 12px;font-size:24px;line-height:1.2">A new job matches your preferences</h1><p style="margin:0 0 20px;color:#63766a">Hello ${safeName}, we found a newly published opportunity based on the categories and locations you selected.</p><div style="padding:18px;background:#f3f7f0;border-left:3px solid #b78a2a"><h2 style="margin:0 0 10px;font-size:20px"><a href="${safeUrl}" style="color:#185b43;text-decoration:none">${safeTitle}</a></h2><p style="margin:5px 0;color:#52665a">${safeCompany}</p><p style="margin:5px 0;color:#52665a">${safeLocation} · ${safeCategory}</p>${job.deadline?.trim() ? `<p style="margin:5px 0;color:#52665a">Deadline: ${escapeHtml(job.deadline.trim().slice(0, 240))}</p>` : ""}</div><p style="margin:22px 0"><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#17694f;color:#ffffff;font-weight:700;text-decoration:none;border-radius:3px">View job details</a></p><p style="font-size:12px;line-height:1.6;color:#748278">You received this email because you opted in to matching-job alerts. <a href="${escapeHtml(preferencesUrl)}" style="color:#17694f">Manage preferences or turn alerts off</a> in your member dashboard.</p></div></body></html>`,
  };
}

let cachedTransport: Transporter | null = null;
let cachedTransportKey = "";
function smtpTransport(config: MailConfig) {
  const key = JSON.stringify([config.host, config.port, config.secure, config.user, config.password, config.fromEmail]);
  if (!cachedTransport || cachedTransportKey !== key) {
    cachedTransport?.close();
    cachedTransport = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
      tls: { rejectUnauthorized: true },
    });
    cachedTransportKey = key;
  }
  return cachedTransport;
}

let lastWorkerWarningAt = 0;
function warnWorker(message: string) {
  if (Date.now() - lastWorkerWarningAt < 60_000) return;
  lastWorkerWarningAt = Date.now();
  console.warn(`[job-alert-email] ${message}`);
}

async function processPublicationEvents(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const events = await db.select({ jobId: memberJobAlertEvents.jobId }).from(memberJobAlertEvents)
    .where(eq(memberJobAlertEvents.status, "pending")).orderBy(asc(memberJobAlertEvents.createdAt)).limit(EVENT_BATCH_SIZE);
  for (const event of events) {
    try {
      await db.transaction(async tx => {
        const [lockedEvent] = await tx.select({ jobId: memberJobAlertEvents.jobId }).from(memberJobAlertEvents)
          .where(and(eq(memberJobAlertEvents.jobId, event.jobId), eq(memberJobAlertEvents.status, "pending"))).limit(1).for("update");
        if (!lockedEvent) return;
        const [job] = await tx.select().from(jobs).where(eq(jobs.id, event.jobId)).limit(1);
        if (job?.status === "published") {
          const members = await tx.select({ id: memberAccounts.id, email: memberAccounts.email, alertCategories: memberAccounts.alertCategories, alertLocations: memberAccounts.alertLocations })
            .from(memberAccounts).where(and(eq(memberAccounts.isActive, true), eq(memberAccounts.emailAlertsEnabled, true)));
          const matching = members.filter(member => EMAIL_RE.test(member.email) && jobMatchesAlertPreferences(job, member));
          for (let start = 0; start < matching.length; start += 100) {
            const batch = matching.slice(start, start + 100).map(member => ({ memberId: member.id, jobId: job.id }));
            if (batch.length) await tx.insert(memberJobAlertDeliveries).values(batch).onDuplicateKeyUpdate({ set: { status: sql`${memberJobAlertDeliveries.status}` } });
          }
        }
        await tx.update(memberJobAlertEvents).set({ status: "processed", processedAt: new Date() })
          .where(and(eq(memberJobAlertEvents.jobId, event.jobId), eq(memberJobAlertEvents.status, "pending")));
      });
    } catch { warnWorker("Could not expand a published-job outbox event; it remains queued for retry."); }
  }
}

async function sendPendingDelivery(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, deliveryId: number, now: Date) {
  const config = mailConfig();
  if (!config) return;
  const claim = await db.update(memberJobAlertDeliveries).set({
    status: "sending",
    attemptCount: sql`${memberJobAlertDeliveries.attemptCount} + 1`,
    attemptedAt: now,
  }).where(and(eq(memberJobAlertDeliveries.id, deliveryId), eq(memberJobAlertDeliveries.status, "pending"), lte(memberJobAlertDeliveries.nextAttemptAt, now)));
  if (affectedRows(claim) !== 1) return;

  await db.transaction(async tx => {
    // Lock the member preference row through SMTP submission: an opt-out save waits for an already-started send,
    // while any opt-out committed before this lock is acquired cancels the unsent message.
    const [delivery] = await tx.select({
      memberId: memberAccounts.id,
      recipient: memberAccounts.email,
      displayName: memberAccounts.displayName,
      isActive: memberAccounts.isActive,
      emailAlertsEnabled: memberAccounts.emailAlertsEnabled,
      alertCategories: memberAccounts.alertCategories,
      alertLocations: memberAccounts.alertLocations,
      jobId: jobs.id,
      jobStatus: jobs.status,
      title: jobs.title,
      companyName: jobs.companyName,
      category: jobs.category,
      location: jobs.location,
      isRemote: jobs.isRemote,
      deadline: jobs.deadline,
      attemptCount: memberJobAlertDeliveries.attemptCount,
    }).from(memberJobAlertDeliveries)
      .innerJoin(memberAccounts, eq(memberJobAlertDeliveries.memberId, memberAccounts.id))
      .innerJoin(jobs, eq(memberJobAlertDeliveries.jobId, jobs.id))
      .where(eq(memberJobAlertDeliveries.id, deliveryId)).limit(1).for("update");

    if (!delivery || !delivery.isActive || !delivery.emailAlertsEnabled || delivery.jobStatus !== "published" || !EMAIL_RE.test(delivery.recipient) || !jobMatchesAlertPreferences(delivery, delivery)) {
      await tx.update(memberJobAlertDeliveries).set({ status: "cancelled", attemptedAt: null }).where(eq(memberJobAlertDeliveries.id, deliveryId));
      return;
    }

    const job = {
      id: delivery.jobId,
      title: delivery.title,
      companyName: delivery.companyName,
      category: delivery.category,
      location: delivery.location,
      isRemote: delivery.isRemote,
      deadline: delivery.deadline,
    } as Job;
    try {
      await smtpTransport(config).sendMail(buildMessage(config, deliveryId, delivery.recipient, delivery.displayName, job));
    } catch {
      const attempt = Number(delivery.attemptCount ?? 1);
      const delay = RETRY_DELAYS_MS[Math.min(Math.max(attempt - 1, 0), RETRY_DELAYS_MS.length - 1)];
      await tx.update(memberJobAlertDeliveries).set({ status: attempt >= MAX_ATTEMPTS ? "failed" : "pending", nextAttemptAt: new Date(Date.now() + delay), attemptedAt: null }).where(eq(memberJobAlertDeliveries.id, deliveryId));
      warnWorker(`A delivery attempt failed; attempt ${attempt} of ${MAX_ATTEMPTS}.`);
      return;
    }
    await tx.update(memberJobAlertDeliveries).set({ status: "sent", sentAt: new Date(), attemptedAt: null }).where(eq(memberJobAlertDeliveries.id, deliveryId));
  });
}

let workerStarted = false;
let workerBusy = false;
export function startJobAlertEmailWorker() {
  if (workerStarted) return;
  workerStarted = true;
  const run = () => {
    if (workerBusy) return;
    workerBusy = true;
    void processJobAlertEmailBatch().catch(() => warnWorker("Worker cycle failed; pending outbox items will be retried."))
      .finally(() => { workerBusy = false; });
  };
  run();
  const timer = setInterval(run, 15_000);
  timer.unref?.();
}

async function processJobAlertEmailBatch() {
  const db = await getDb();
  if (!db) return;
  await processPublicationEvents(db);
  if (!mailConfig()) return;
  const now = new Date();
  const staleClaim = new Date(now.getTime() - 10 * 60_000);
  await db.update(memberJobAlertDeliveries).set({ status: "pending", attemptedAt: null, nextAttemptAt: now })
    .where(and(eq(memberJobAlertDeliveries.status, "sending"), lte(memberJobAlertDeliveries.attemptedAt, staleClaim)));
  const pending = await db.select({ id: memberJobAlertDeliveries.id }).from(memberJobAlertDeliveries)
    .where(and(eq(memberJobAlertDeliveries.status, "pending"), lte(memberJobAlertDeliveries.nextAttemptAt, now)))
    .orderBy(asc(memberJobAlertDeliveries.createdAt)).limit(BATCH_SIZE);
  for (const item of pending) {
    try { await sendPendingDelivery(db, item.id, now); }
    catch { warnWorker("Could not process a queued delivery; it will be retried after its claim expires."); }
  }
}
