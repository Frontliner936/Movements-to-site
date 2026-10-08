import { and, eq } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { companies, jobs } from "../../drizzle/schema";
import { readLocalFile } from "./local-storage";
import { getDb } from "../db";

type ShareJob = Pick<typeof jobs.$inferSelect,
  "id" | "title" | "companyName" | "location" | "deadline" | "description" |
  "companyDescription" | "companyLogoUrl" | "companyWebsiteUrl" | "responsibilities" |
  "qualifications" | "howToApply" | "applicationUrl" | "sourceUrl" | "imageUrl" | "updatedAt">;
type ShareCompany = Pick<typeof companies.$inferSelect, "name" | "description" | "logoUrl" | "websiteUrl" | "updatedAt"> | null;

export const SHARE_IMAGE_WIDTH = 1200;
export const SHARE_IMAGE_HEIGHT = 630;
const STORAGE_PREFIX = "/manus-storage/";
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const MAX_CARD_CACHE_SIZE = 32;
const CARD_BACKGROUND = "#f5f3ec";

export type JobShareMetadata = {
  title: string;
  description: string;
  canonicalUrl: string | null;
  imageUrl: string | null;
  sourceImageUrl: string | null;
  imageAlt: string;
  imageWidth: number | null;
  imageHeight: number | null;
  imageType: string | null;
  shareVersion: string | null;
};

const generatedCardCache = new Map<string, Buffer>();

export function getPublicSiteOrigin(): string | null {
  const configured = process.env.PUBLIC_SITE_ORIGIN;
  const raw = configured || "";
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function getRequestPublicOrigin(req: Request): string | null {
  const configured = getPublicSiteOrigin();
  if (configured) return configured;
  const firstHeaderValue = (value: string | undefined) => value?.split(",", 1)[0]?.trim();
  const protocol = (firstHeaderValue(req.get("x-forwarded-proto")) || req.protocol).toLowerCase();
  const host = firstHeaderValue(req.get("x-forwarded-host")) || firstHeaderValue(req.get("host"));
  if (protocol !== "https" || !host || host.length > 255 || /[\s/@\\?#]/.test(host)) return null;
  try {
    const parsed = new URL(`https://${host}`);
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function plainText(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function fieldText(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

function safeAbsoluteUrl(value: string | null | undefined, origin: string | null): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;
  try {
    const parsed = candidate.startsWith("/") && origin
      ? new URL(candidate, origin)
      : new URL(candidate);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function storageObjectKey(value: string | null | undefined, origin: string | null): string | null {
  if (!value?.trim()) return null;
  let pathname: string;
  if (value.startsWith("/")) {
    pathname = value.split(/[?#]/, 1)[0]!;
  } else {
    try {
      const parsed = new URL(value);
      if (!origin || parsed.origin !== origin) return null;
      pathname = parsed.pathname;
    } catch {
      return null;
    }
  }
  if (!pathname.startsWith(STORAGE_PREFIX)) return null;
  let key: string;
  try { key = decodeURIComponent(pathname.slice(STORAGE_PREFIX.length)); }
  catch { return null; }
  if (!key || key.length > 1024 || !/^[A-Za-z0-9._/-]+$/.test(key) || key.split("/").some(part => !part || part === "." || part === "..")) return null;
  return key;
}

function updatedMillis(value: Date): number {
  const result = value instanceof Date ? value.getTime() : Number.NaN;
  return Number.isFinite(result) ? result : 0;
}

function directImageType(value: string | null): string | null {
  if (!value) return null;
  try {
    const pathname = new URL(value).pathname.toLowerCase();
    if (/\.(jpe?g)$/.test(pathname)) return "image/jpeg";
    if (/\.png$/.test(pathname)) return "image/png";
    if (/\.webp$/.test(pathname)) return "image/webp";
    return null;
  } catch { return null; }
}

export function buildJobShareMetadata(job: ShareJob, company: ShareCompany, origin: string | null): JobShareMetadata {
  const companyName = fieldText(job.companyName || company?.name);
  const roleAndCompany = companyName ? `${fieldText(job.title)} — ${companyName}` : fieldText(job.title);
  const title = `${roleAndCompany} | Get Mchongo`;
  const description = (plainText(job.description) || plainText(job.responsibilities) ||
    plainText(job.qualifications) || plainText(job.howToApply) || roleAndCompany).slice(0, 240);
  const selectedImage = job.companyLogoUrl || company?.logoUrl || job.imageUrl || null;
  const sourceImageUrl = safeAbsoluteUrl(selectedImage, origin);
  const objectKey = storageObjectKey(selectedImage, origin);
  const shareMillis = Math.max(updatedMillis(job.updatedAt), company ? updatedMillis(company.updatedAt) : 0);
  const shareVersion = selectedImage ? String(shareMillis) : null;
  const usesGeneratedCard = !!objectKey;
  const generatedImagePath = `/og/jobs/${job.id}.jpg?v=${shareMillis}`;
  const imageUrl = usesGeneratedCard
    ? origin ? new URL(generatedImagePath, origin).href : generatedImagePath
    : sourceImageUrl;
  const canonicalUrl = origin ? new URL(`/jobs/${job.id}`, origin).href : null;
  return {
    title,
    description,
    canonicalUrl,
    imageUrl,
    sourceImageUrl,
    imageAlt: companyName ? `${fieldText(job.title)} — ${companyName}` : fieldText(job.title),
    imageWidth: usesGeneratedCard ? SHARE_IMAGE_WIDTH : null,
    imageHeight: usesGeneratedCard ? SHARE_IMAGE_HEIGHT : null,
    imageType: usesGeneratedCard ? "image/jpeg" : directImageType(imageUrl),
    shareVersion,
  };
}

export function getJobShareImageUrl(job: ShareJob, company: ShareCompany, origin: string | null): string | null {
  return buildJobShareMetadata(job, company, origin).imageUrl;
}

function setMeta(html: string, attribute: "name" | "property", key: string, value: string): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}=[\\"']${escapedKey}[\\"'])[^>]*>`, "i");
  const tag = `<meta ${attribute}="${escapeHtml(key)}" content="${escapeHtml(value)}" />`;
  return matcher.test(html) ? html.replace(matcher, tag) : html.replace(/<\/head>/i, `  ${tag}\n</head>`);
}

function removeMeta(html: string, attribute: "name" | "property", key: string): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}=[\\"']${escapedKey}[\\"'])[^>]*>`, "i");
  return html.replace(matcher, "");
}

function setCanonical(html: string, url: string | null): string {
  if (!url) return html;
  const tag = `<link rel="canonical" href="${escapeHtml(url)}" />`;
  const matcher = /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i;
  return matcher.test(html) ? html.replace(matcher, tag) : html.replace(/<\/head>/i, `  ${tag}\n</head>`);
}

function shareBody(job: ShareJob, company: ShareCompany, metadata: JobShareMetadata): string {
  const companyName = fieldText(job.companyName || company?.name);
  const rows = [
    job.location ? `<li><strong>Location:</strong> ${escapeHtml(plainText(job.location))}</li>` : "",
    job.deadline ? `<li><strong>Deadline:</strong> ${escapeHtml(plainText(job.deadline))}</li>` : "",
  ].filter(Boolean).join("");
  const sections: Array<[string, string | null | undefined]> = [
    ["About the role", job.description],
    ["Responsibilities", job.responsibilities],
    ["Qualifications and requirements", job.qualifications],
    ["How to apply", job.howToApply],
    [companyName ? `About ${companyName}` : "About the organisation", job.companyDescription || company?.description],
  ];
  const detailHtml = sections.map(([heading, content]) => {
    const text = plainText(content);
    return text ? `<section><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(text.slice(0, 12000))}</p></section>` : "";
  }).join("");
  const image = metadata.imageUrl
    ? `<img src="${escapeHtml(metadata.imageUrl)}" alt="${escapeHtml(metadata.imageAlt)}" style="max-width:100%;height:auto" />`
    : "";
  const application = safeAbsoluteUrl(job.applicationUrl, null);
  const applyHtml = application ? `<p><a href="${escapeHtml(application)}" rel="nofollow noopener">Apply on the original site</a></p>` : "";
  const source = safeAbsoluteUrl(job.sourceUrl, null);
  const sourceHtml = source && source !== application ? `<p><a href="${escapeHtml(source)}" rel="nofollow noopener">View original source</a></p>` : "";
  const companyWebsite = safeAbsoluteUrl(job.companyWebsiteUrl || company?.websiteUrl, null);
  const websiteHtml = companyWebsite ? `<p><a href="${escapeHtml(companyWebsite)}" rel="nofollow noopener">Official company website</a></p>` : "";
  return `<main><article>${image}<p>GET MCHONGO · TANZANIA OPPORTUNITIES</p><h1>${escapeHtml(fieldText(job.title))}</h1>${companyName ? `<p>${escapeHtml(companyName)}</p>` : ""}${rows ? `<ul>${rows}</ul>` : ""}${detailHtml}${websiteHtml}${applyHtml}${sourceHtml}</article></main>`;
}

export function renderJobShareHtml(template: string, job: ShareJob, company: ShareCompany, origin: string | null, requestedShareVersion: string | null = null): string {
  const metadata = buildJobShareMetadata(job, company, origin);
  let html = template.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${escapeHtml(metadata.title)}</title>`);
  html = setMeta(html, "name", "description", metadata.description);
  html = setMeta(html, "property", "og:type", "article");
  html = setMeta(html, "property", "og:site_name", "Get Mchongo");
  html = setMeta(html, "property", "og:title", metadata.title);
  html = setMeta(html, "property", "og:description", metadata.description);
  html = setMeta(html, "name", "twitter:title", metadata.title);
  html = setMeta(html, "name", "twitter:description", metadata.description);
  html = setMeta(html, "name", "twitter:card", metadata.imageUrl ? "summary_large_image" : "summary");
  if (metadata.canonicalUrl) {
    const socialUrl = new URL(metadata.canonicalUrl);
    if (metadata.shareVersion && requestedShareVersion === metadata.shareVersion) socialUrl.searchParams.set("share", metadata.shareVersion);
    html = setMeta(html, "property", "og:url", socialUrl.href);
    html = setCanonical(html, metadata.canonicalUrl);
  }
  if (metadata.imageUrl) {
    // Open Graph image sub-properties must follow their og:image root tag.
    html = setMeta(html, "property", "og:image", metadata.imageUrl);
    html = setMeta(html, "property", "og:image:secure_url", metadata.imageUrl);
    if (metadata.imageType) html = setMeta(html, "property", "og:image:type", metadata.imageType);
    else html = removeMeta(html, "property", "og:image:type");
    if (metadata.imageWidth) html = setMeta(html, "property", "og:image:width", String(metadata.imageWidth));
    else html = removeMeta(html, "property", "og:image:width");
    if (metadata.imageHeight) html = setMeta(html, "property", "og:image:height", String(metadata.imageHeight));
    else html = removeMeta(html, "property", "og:image:height");
    html = setMeta(html, "property", "og:image:alt", metadata.imageAlt);
    html = setMeta(html, "name", "twitter:image", metadata.imageUrl);
    html = setMeta(html, "name", "twitter:image:alt", metadata.imageAlt);
  } else {
    for (const [attribute, key] of [
      ["property", "og:image"], ["property", "og:image:secure_url"], ["property", "og:image:type"],
      ["property", "og:image:width"], ["property", "og:image:height"], ["property", "og:image:alt"],
      ["name", "twitter:image"], ["name", "twitter:image:alt"],
    ] as const) html = removeMeta(html, attribute, key);
  }
  const crawlableBody = shareBody(job, company, metadata);
  return html.replace(/<div\s+id="root">\s*<\/div>/i, `<div id="root">${crawlableBody}</div>`);
}

function missingPage(title: string, description: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="description" content="${escapeHtml(description)}"><title>${escapeHtml(title)} | Get Mchongo</title></head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><a href="/">Browse Get Mchongo opportunities</a></main></body></html>`;
}

async function readIndexTemplate(): Promise<string> {
  const templatePath = process.env.NODE_ENV === "development"
    ? path.resolve(import.meta.dirname, "../..", "client", "index.html")
    : path.resolve(import.meta.dirname, "public", "index.html");
  return fs.readFile(templatePath, "utf8");
}

async function downloadStoredImage(key: string): Promise<Buffer> {
  const local = await readLocalFile(key);
  if (!local || !["image/jpeg", "image/png", "image/webp"].includes(local.contentType)) throw new Error("The share image is not available on local storage.");
  if (local.bytes.byteLength > MAX_SOURCE_BYTES) throw new Error("Image file exceeds the size limit.");
  return local.bytes;
}

export async function makeShareCardImage(source: Buffer): Promise<Buffer> {
  return sharp(source, { limitInputPixels: 16_000_000, failOn: "error" })
    .rotate()
    .resize(1100, 550, { fit: "contain", background: CARD_BACKGROUND })
    .extend({ top: 40, bottom: 40, left: 50, right: 50, background: CARD_BACKGROUND })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

function sendImageNotFound(res: Response): void {
  res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex" }).status(404).end();
}

export function registerJobShareMetadata(app: Express): void {
  app.get("/og/jobs/:id.jpg", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return sendImageNotFound(res);
    try {
      const db = await getDb();
      if (!db) return res.status(503).set("Cache-Control", "no-store").end();
      const [row] = await db.select({ job: jobs, company: companies }).from(jobs)
        .leftJoin(companies, eq(jobs.companyId, companies.id))
        .where(and(eq(jobs.id, id), eq(jobs.status, "published"))).limit(1);
      if (!row) return sendImageNotFound(res);
      const origin = getRequestPublicOrigin(req);
      const selected = row.job.companyLogoUrl || row.company?.logoUrl || row.job.imageUrl || null;
      const key = storageObjectKey(selected, origin);
      if (!key) return sendImageNotFound(res);
      const version = Math.max(updatedMillis(row.job.updatedAt), row.company ? updatedMillis(row.company.updatedAt) : 0);
      const cacheKey = `${id}:${version}:${key}`;
      let card = generatedCardCache.get(cacheKey);
      if (!card) {
        const original = await downloadStoredImage(key);
        card = await makeShareCardImage(original);
        if (generatedCardCache.size >= MAX_CARD_CACHE_SIZE) {
          const oldest = generatedCardCache.keys().next().value;
          if (oldest) generatedCardCache.delete(oldest);
        }
        generatedCardCache.set(cacheKey, card);
      }
      return res.set({
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        "Content-Type": "image/jpeg",
        "Content-Length": String(card.byteLength),
        "X-Content-Type-Options": "nosniff",
      }).status(200).send(card);
    } catch {
      console.warn("A stored image could not be rendered for a published job share preview.");
      return res.status(503).set({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }).end();
    }
  });

  app.get("/jobs/:id", async (req: Request, res: Response) => {
    if (!/^\d+$/.test(req.params.id)) {
      res.set("X-Robots-Tag", "noindex").status(404).type("html").send(missingPage("Opportunity not found", "This published opportunity is not available."));
      return;
    }
    try {
      const db = await getDb();
      if (!db) {
        res.status(503).type("html").send(missingPage("Opportunities are unavailable", "Please try again shortly."));
        return;
      }
      const [row] = await db.select({ job: jobs, company: companies }).from(jobs)
        .leftJoin(companies, eq(jobs.companyId, companies.id))
        .where(and(eq(jobs.id, Number(req.params.id)), eq(jobs.status, "published"))).limit(1);
      if (!row) {
        res.set("X-Robots-Tag", "noindex").status(404).type("html").send(missingPage("Opportunity not found", "This published opportunity is not available."));
        return;
      }
      let html = await readIndexTemplate();
      if (process.env.NODE_ENV === "development") {
        const vite = req.app.locals.webdevVite as { transformIndexHtml?: (url: string, content: string) => Promise<string> } | undefined;
        if (vite?.transformIndexHtml) html = await vite.transformIndexHtml(req.originalUrl, html);
      }
      const origin = getRequestPublicOrigin(req);
      const requestedVersion = typeof req.query.share === "string" ? req.query.share : null;
      html = renderJobShareHtml(html, row.job, row.company, origin, requestedVersion);
      res.set({ "Cache-Control": "no-cache", "Content-Type": "text/html; charset=utf-8" }).status(200).send(html);
    } catch (error) {
      console.error("Unable to render public job share metadata:", error instanceof Error ? error.message : "Unknown error");
      res.status(503).type("html").send(missingPage("Opportunity unavailable", "Please try again shortly."));
    }
  });
}
