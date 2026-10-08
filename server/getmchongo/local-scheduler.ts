import { eq } from "drizzle-orm";
import { scanSchedules } from "../../drizzle/schema";
import { getDb } from "../db";
import { runActiveSources } from "./source-runner";

// Existing schedule rows store UTC cron hours; the admin UI labels each slot in EAT (UTC+3).
const TIME_ZONE = "UTC";
const RUN_INTERVAL_MS = 30_000;
const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
let started = false;
let running = false;
let lastStartedSlot = "";

function partsFor(date: Date) {
  return Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
}

function scheduledHours(expression: string): string[] {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 6 || fields[0] !== "0" || fields[1] !== "0" || fields[3] !== "*" || fields[4] !== "*" || fields[5] !== "*") return [];
  const hours = fields[2].split(",");
  return hours.every(hour => /^(?:[0-9]|1[0-9]|2[0-3])$/.test(hour)) ? hours.map(hour => hour.padStart(2, "0")) : [];
}

async function checkAndRun() {
  if (running) return;
  const now = new Date();
  const current = partsFor(now);
  if (current.minute !== "00") return;
  const db = await getDb();
  if (!db) return;
  const [schedule] = await db.select().from(scanSchedules).where(eq(scanSchedules.id, 1)).limit(1);
  if (!schedule?.enabled || !scheduledHours(schedule.cronExpression).includes(current.hour)) return;
  const slot = `${current.year}-${current.month}-${current.day}-${current.hour}`;
  if (lastStartedSlot === slot) return;
  if (schedule.lastRunAt) {
    const lastRun = partsFor(new Date(schedule.lastRunAt));
    if (`${lastRun.year}-${lastRun.month}-${lastRun.day}-${lastRun.hour}` === slot) {
      lastStartedSlot = slot;
      return;
    }
  }

  running = true;
  lastStartedSlot = slot;
  try {
    await db.update(scanSchedules).set({ lastRunAt: now }).where(eq(scanSchedules.id, 1));
    const result = await runActiveSources();
    console.info(`[LocalScheduler] Source scan completed: ${result.sourcesScanned} sources, ${result.newPending} new items, ${result.errors} errors.`);
  } catch (error) {
    console.error("[LocalScheduler] Scheduled source scan failed:", error instanceof Error ? error.message : error);
  } finally {
    running = false;
  }
}

/** Start once per Node process; schedule times are read from the existing database row in EAT. */
export function startLocalScanScheduler() {
  if (started) return;
  started = true;
  const timer = setInterval(() => { void checkAndRun().catch(error => console.error("[LocalScheduler] Tick failed:", error)); }, RUN_INTERVAL_MS);
  timer.unref();
  void checkAndRun().catch(error => console.error("[LocalScheduler] Initial check failed:", error));
}
