import { and, eq } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { companies, jobs } from "../../drizzle/schema";
import { getDb } from "../db";

type ShareJob = Pick<typeof jobs.$inferSelect,
  "id" | "title" | "companyName" | "location" | "deadline" | "description" |
  "responsibilities" | "qualifications" | "howToApply" | "applicationUrl" | "sourceUrl" | "imageUrl">;
type ShareCompany = Pick<typeof companies.$inferSelect, "name" | "description" | "logoUrl"> | null;

export type JobShareMetadata = {
  title: string;
  description: string;
  canonicalUrl: string | null;
  imageUrl: string | null;
  imageAlt: string;
};

// This is the explicit preview origin returned by webdev.config for this project.
// Published deployments use the explicitly configured PUBLIC_SITE_ORIGIN instead.
const PROJECT_PREVIEW_ORIGIN = "https://8328-ia90ve3azjouffq0ab86r-4ce6a6b4.us1.manus.computer";

function configuredPublicOrigin(): string | null {
  const configured = process.env.PUBLIC_SITE_ORIGIN;
  const raw = configured || (process.env.NODE_ENV === "development" ? PROJECT_PREVIEW_ORIGIN : "");
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
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

export function buildJobShareMetadata(job: ShareJob, company: ShareCompany, origin: string | null): JobShareMetadata {
  const companyName = fieldText(job.companyName || company?.name);
  const roleAndCompany = companyName ? `${fieldText(job.title)} — ${companyName}` : fieldText(job.title);
  const title = `${roleAndCompany} | Get Mchongo`;
  const description = (plainText(job.description) || plainText(job.responsibilities) ||
    plainText(job.qualifications) || plainText(job.howToApply) || roleAndCompany).slice(0, 240);
  const imageUrl = safeAbsoluteUrl(job.imageUrl || company?.logoUrl, origin);
  const canonicalUrl = origin ? new URL(`/jobs/${job.id}`, origin).href : null;
  return { title, description, canonicalUrl, imageUrl, imageAlt: companyName ? `${fieldText(job.title)} — ${companyName}` : fieldText(job.title) };
}

function setMeta(html: string, attribute: "name" | "property", key: string, value: string): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}=[\\"']${escapedKey}[\\"'])[^>]*>`, "i");
  const tag = `<meta ${attribute}="${escapeHtml(key)}" content="${escapeHtml(value)}" />`;
  return matcher.test(html) ? html.replace(matcher, tag) : html.replace(/<\/head>/i, `  ${tag}\n</head>`);
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
    [companyName ? `About ${companyName}` : "About the organisation", company?.description],
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
  return `<main><article>${image}<p>GET MCHONGO · TANZANIA OPPORTUNITIES</p><h1>${escapeHtml(fieldText(job.title))}</h1>${companyName ? `<p>${escapeHtml(companyName)}</p>` : ""}${rows ? `<ul>${rows}</ul>` : ""}${detailHtml}${applyHtml}${sourceHtml}</article></main>`;
}

export function renderJobShareHtml(template: string, job: ShareJob, company: ShareCompany, origin: string | null): string {
  const metadata = buildJobShareMetadata(job, company, origin);
  let html = template.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${escapeHtml(metadata.title)}</title>`);
  html = setMeta(html, "name", "description", metadata.description);
  html = setMeta(html, "property", "og:type", "article");
  html = setMeta(html, "property", "og:site_name", "Get Mchongo");
  html = setMeta(html, "property", "og:title", metadata.title);
  html = setMeta(html, "property", "og:description", metadata.description);
  html = setMeta(html, "name", "twitter:card", metadata.imageUrl ? "summary_large_image" : "summary");
  html = setMeta(html, "name", "twitter:title", metadata.title);
  html = setMeta(html, "name", "twitter:description", metadata.description);
  html = setMeta(html, "property", "og:image:alt", metadata.imageAlt);
  html = setMeta(html, "name", "twitter:image:alt", metadata.imageAlt);
  if (metadata.canonicalUrl) {
    html = setMeta(html, "property", "og:url", metadata.canonicalUrl);
    html = setCanonical(html, metadata.canonicalUrl);
  }
  if (metadata.imageUrl) {
    html = setMeta(html, "property", "og:image", metadata.imageUrl);
    html = setMeta(html, "name", "twitter:image", metadata.imageUrl);
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

export function registerJobShareMetadata(app: Express): void {
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
      html = renderJobShareHtml(html, row.job, row.company, configuredPublicOrigin());
      res.set({ "Cache-Control": "no-cache", "Content-Type": "text/html; charset=utf-8" }).status(200).send(html);
    } catch (error) {
      console.error("Unable to render public job share metadata:", error instanceof Error ? error.message : "Unknown error");
      res.status(503).type("html").send(missingPage("Opportunity unavailable", "Please try again shortly."));
    }
  });
}
