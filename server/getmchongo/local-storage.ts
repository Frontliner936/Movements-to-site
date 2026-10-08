import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Request, Response } from "express";

/**
 * Persistent local file storage for self-hosted deployments (e.g. Railway).
 * Files live on disk in UPLOAD_DIR. On Railway, a mounted Volume is used
 * automatically via RAILWAY_VOLUME_MOUNT_PATH when UPLOAD_DIR is not set.
 */
const KEY_PATTERN = /^get-mchongo\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|pdf)$/;

export const LOCAL_CONTENT_TYPES: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", webp: "image/webp", pdf: "application/pdf",
};

export const uploadRoot = () => {
  const configured = process.env.UPLOAD_DIR?.trim();
  const railwayMount = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
  const root = configured || (railwayMount ? path.join(railwayMount, "uploads") : path.join(process.cwd(), "uploads"));
  return path.resolve(root);
};

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

/** Serves files saved on this server. A missing upload must not fall through to the SPA HTML response. */
export async function serveLocalStorage(req: Request, res: Response) {
  const key = String((req.params as Record<string, string>)[0] ?? "");
  const local = isLocalKey(key) ? await readLocalFile(key) : null;
  if (!local) return res.set({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }).status(404).end();
  res.set({
    "Content-Type": local.contentType,
    "Content-Disposition": local.contentType === "application/pdf" ? 'attachment; filename="announcement.pdf"' : "inline",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "public, max-age=86400",
  });
  res.send(local.bytes);
}
