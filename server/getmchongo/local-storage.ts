import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";

/**
 * Fallback file storage for hosts without Manus storage (e.g. Railway).
 * Files live on disk in UPLOAD_DIR (default ./uploads). On Railway, mount a
 * Volume and point UPLOAD_DIR at it so files survive redeploys.
 */
const KEY_PATTERN = /^get-mchongo\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|pdf)$/;

export const LOCAL_CONTENT_TYPES: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", webp: "image/webp", pdf: "application/pdf",
};

export const uploadRoot = () => path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));

export function isLocalKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

function resolveKey(key: string): string | null {
  if (!isLocalKey(key)) return null;
  const root = uploadRoot();
  const full = path.resolve(root, key);
  return full.startsWith(root + path.sep) ? full : null;
}

export async function saveLocalFile(key: string, bytes: Buffer): Promise<void> {
  const full = resolveKey(key);
  if (!full) throw new Error("Invalid storage key.");
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
}

export async function readLocalFile(key: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  const full = resolveKey(key);
  if (!full) return null;
  try {
    const bytes = await readFile(full);
    return { bytes, contentType: LOCAL_CONTENT_TYPES[full.split(".").pop() ?? ""] ?? "application/octet-stream" };
  } catch { return null; }
}

/** Serves files saved on this server; anything else falls through (e.g. to the platform's own storage). */
export async function serveLocalStorage(req: Request, res: Response, next: NextFunction) {
  const key = String((req.params as Record<string, string>)[0] ?? "");
  const local = isLocalKey(key) ? await readLocalFile(key) : null;
  if (!local) return next();
  res.set({ "Content-Type": local.contentType, "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=86400" });
  res.send(local.bytes);
}
