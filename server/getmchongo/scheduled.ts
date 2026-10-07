import { jwtVerify } from "jose";
import { parse as parseCookie } from "cookie";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { scanSchedules } from "../../drizzle/schema";
import { runActiveSources } from "./source-runner";

async function resolveTaskUid(req: Request) {
  const token = parseCookie(req.headers.cookie ?? "").app_session_id;
  const jwtSecret = process.env.MANUS_JWT_SECRET;
  const projectId = process.env.MANUS_PROJECT_ID;
  const oauthApi = process.env.MANUS_OAUTH_API_URL;
  if (!token || !jwtSecret || !projectId || !oauthApi) throw new Error("Scheduled callback credentials are missing.");
  const { payload } = await jwtVerify(token, new TextEncoder().encode(jwtSecret), { algorithms: ["HS256"] });
  if (payload.appId !== projectId || typeof payload.openId !== "string" || !payload.openId.startsWith("cron_")) throw new Error("Scheduled callback identity is not valid for this project.");
  const base = oauthApi.endsWith("/") ? oauthApi : `${oauthApi}/`;
  const response = await fetch(new URL("webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt", base), {
    method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(8_000),
    body: JSON.stringify({ jwt_token: token, project_id: projectId }),
  });
  if (!response.ok) throw new Error("Scheduled callback identity could not be verified.");
  const identity = await response.json() as { taskUid?: string; projectId?: string; project_id?: string };
  if (identity.projectId && identity.projectId !== projectId) throw new Error("Scheduled callback belongs to another project.");
  if (identity.taskUid && typeof identity.taskUid === "string") return identity.taskUid;
  throw new Error("Scheduled callback did not include a task identity.");
}

export async function handleScheduledScan(req: Request, res: Response) {
  try {
    const taskUid = await resolveTaskUid(req);
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Job database is unavailable." });
    const [schedule] = await db.select().from(scanSchedules).where(eq(scanSchedules.id, 1)).limit(1);
    if (!schedule?.enabled || !schedule.heartbeatTaskUid || schedule.heartbeatTaskUid !== taskUid) return res.status(403).json({ error: "Scheduled task is not configured for this source scan." });
    const result = await runActiveSources();
    await db.update(scanSchedules).set({ lastRunAt: new Date() }).where(eq(scanSchedules.id, 1));
    return res.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheduled scan failed.";
    const authFailure = /identity|credentials|project/i.test(message);
    return res.status(authFailure ? 401 : 500).json({ error: message.slice(0, 300) });
  }
}
