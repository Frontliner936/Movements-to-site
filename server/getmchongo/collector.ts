import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
import * as cheerio from "cheerio";
import { XMLParser } from "fast-xml-parser";
import { structureTrackedAdvertText } from "./job-ad-structurer";

export type SourceType = "rss" | "json" | "career" | "scraper";
export type SourceSettings = {
  companyName?: string;
  itemsPath?: string;
  fieldMap?: Record<string, string>;
  linkSelector?: string;
};
export type CollectedCandidate = {
  title: string;
  companyName: string | null;
  category: string | null;
  location: string | null;
  deadline: string | null;
  description: string | null;
  responsibilities: string | null;
  qualifications: string | null;
  howToApply: string | null;
  applicationUrl: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  rawContext: string | null;
};

const MAX_RESPONSE_BYTES = 3 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 4;
const cleanText = (input: unknown, limit = 20_000): string | null => {
  if (input === undefined || input === null) return null;
  const raw = typeof input === "string" ? input : (typeof input === "number" ? String(input) : "");
  const $ = cheerio.load(raw);
  const value = $.text().replace(/\u00a0/g, " ").replace(/[\t\r ]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
  return value ? value.slice(0, limit) : null;
};

function cleanListText(input: unknown, limit = 12_000): string | null {
  if (input === undefined || input === null) return null;
  if (Array.isArray(input)) {
    const items = input.map(item => cleanListText(item, limit)).filter((item): item is string => !!item);
    return items.length ? items.join("\n").slice(0, limit) : null;
  }
  if (typeof input === "object") {
    const value = input as Record<string, unknown>;
    const nested = value["#text"] ?? value.text ?? value.description ?? value.name ?? value.value;
    return nested === undefined ? null : cleanListText(nested, limit);
  }
  if (typeof input !== "string" && typeof input !== "number") return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const normalizeLines = (value: string) => value.replace(/\u00a0/g, " ").split(/\r?\n/)
    .map(line => line.replace(/[\t ]+/g, " ").trim()).filter(Boolean).join("\n").slice(0, limit);
  if (!/<[a-z][\s\S]*?>/i.test(raw)) return normalizeLines(raw) || null;

  const $ = cheerio.load(raw, {}, false);
  const listItems = $("li").toArray().map(node => $(node).text().replace(/\s+/g, " ").trim()).filter(Boolean);
  if (listItems.length) return normalizeLines(listItems.join("\n")) || null;
  $("br").replaceWith("\n");
  $("p,div,section,article").each((_, node) => { $(node).append("\n"); });
  return normalizeLines($.root().text()) || null;
}

const firstString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value)) { const nested = firstString(...value); if (nested) return nested; }
    if (value && typeof value === "object") {
      const nested = firstString((value as any)["#text"], (value as any)["@_href"], (value as any).url, (value as any).name);
      if (nested) return nested;
    }
  }
  return null;
};

function isUnsafeAddress(address: string) {
  if (!ipaddr.isValid(address)) return true;
  const parsed = ipaddr.process(address);
  const range = parsed.range();
  if (parsed.kind() === "ipv4") return range !== "unicast";
  return !["unicast", "uniqueLocal"].includes(range) || range === "uniqueLocal";
}

async function assertPublicUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Source URL is invalid."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Only public HTTP or HTTPS source URLs are supported.");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("Only the standard HTTP and HTTPS ports are supported for tracked sources.");
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) throw new Error("Private and local network sources are blocked.");
  const addresses = ipaddr.isValid(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(record => isUnsafeAddress(record.address))) throw new Error("Source resolves to a private or reserved network address.");
  return url;
}

export async function validateSourceUrl(value: string) {
  await assertPublicUrl(value);
}

async function readBounded(response: Response) {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_RESPONSE_BYTES) throw new Error("Source response exceeded the 3 MB limit.");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error("Source response exceeded the 3 MB limit."); }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

async function safeFetch(input: string, accept: string) {
  let current = input;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const url = await assertPublicUrl(current);
    const response = await fetch(url, {
      method: "GET", redirect: "manual", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept, "user-agent": "GetMchongo-SourceReader/1.0 (+source collection)" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirects === MAX_REDIRECTS) throw new Error("Source redirected too many times or omitted its destination.");
      current = new URL(location, url).toString();
      continue;
    }
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}.`);
    const body = await readBounded(response);
    return { body, contentType: response.headers.get("content-type") ?? "", finalUrl: url.toString() };
  }
  throw new Error("Source could not be fetched safely.");
}

function getPath(value: unknown, path: string) {
  return path.split(".").filter(Boolean).reduce((current: any, part) => current?.[part], value);
}
function asArray(value: any): any[] { return value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]; }
function absolutize(raw: string | null, base: string) {
  if (!raw) return null;
  try { const url = new URL(raw, base); return ["http:", "https:"].includes(url.protocol) ? url.toString() : null; } catch { return null; }
}
type CandidateInput = Omit<Partial<CollectedCandidate>, "responsibilities" | "qualifications" | "howToApply"> & {
  responsibilities?: unknown;
  qualifications?: unknown;
  howToApply?: unknown;
};

function buildCandidate(values: CandidateInput, sourceUrl: string | null, fallbackCompany: string | undefined, rawContext: string | null): CollectedCandidate {
  return {
    title: (cleanText(values.title, 300) ?? "").slice(0, 300),
    companyName: cleanText(values.companyName ?? fallbackCompany, 240),
    category: cleanText(values.category, 120), location: cleanText(values.location, 240),
    deadline: formatAdvertDeadline(values.deadline), description: cleanText(values.description, 1_200),
    responsibilities: cleanListText(values.responsibilities, 12_000), qualifications: cleanListText(values.qualifications, 12_000),
    howToApply: cleanListText(values.howToApply, 8_000), applicationUrl: values.applicationUrl ?? null,
    imageUrl: values.imageUrl ?? null, sourceUrl, rawContext: cleanText(rawContext, 30_000),
  };
}

function formatAdvertDeadline(value: unknown): string | null {
  const raw = cleanText(value, 240);
  const match = raw?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (!raw || !match) return raw;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return raw;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function structureSourceFields(description: string | null, responsibilities: unknown, qualifications: unknown, howToApply: unknown) {
  const chunks = [description];
  const duties = cleanListText(responsibilities, 12_000);
  const requirements = cleanListText(qualifications, 12_000);
  const application = cleanListText(howToApply, 8_000);
  if (duties) chunks.push(`<h2>Responsibilities</h2>${duties}`);
  if (requirements) chunks.push(`<h2>Qualifications</h2>${requirements}`);
  if (application) chunks.push(`<h2>How to apply</h2>${application}`);
  return structureTrackedAdvertText(htmlToAdvertText(chunks.filter(Boolean).join("\n")));
}

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text", parseTagValue: false, processEntities: false });
export function parseRss(body: string, base: string, settings: SourceSettings): CollectedCandidate[] {
  const parsed = xmlParser.parse(body);
  const items = asArray(parsed?.rss?.channel?.item ?? parsed?.feed?.entry ?? parsed?.RDF?.item).slice(0, 50);
  return items.map(item => {
    const explicitLink = firstString(item.link, item["atom:link"]);
    const guid = firstString(item.guid);
    const link = explicitLink ?? (guid && /^https?:\/\//i.test(guid) ? guid : null);
    const description = firstString(item["content:encoded"], item.content, item.description, item.summary);
    const adFields = structureSourceFields(description, item.responsibilities, item.qualifications ?? item.requirements, item.howToApply ?? item.how_to_apply);
    const page = absolutize(link, base);
    return buildCandidate({
      title: firstString(item.title) ?? "", companyName: firstString(item.company, item.companyName),
      category: firstString(item.category), location: firstString(item.location), deadline: firstString(item.deadline, item.validThrough),
      description: adFields.description, responsibilities: adFields.responsibilities ?? item.responsibilities,
      qualifications: adFields.qualifications ?? item.qualifications ?? item.requirements,
      howToApply: adFields.howToApply ?? item.howToApply ?? item.how_to_apply, applicationUrl: page,
      imageUrl: absolutize(firstString(item.image, item.logo), base),
    }, page ?? base, settings.companyName, description);
  }).filter(item => item.title);
}

export function parseJson(body: string, base: string, settings: SourceSettings): CollectedCandidate[] {
  const parsed = JSON.parse(body);
  const itemsPath = settings.itemsPath?.trim();
  const entries = itemsPath ? getPath(parsed, itemsPath) : (parsed.jobs ?? parsed.items ?? parsed.results ?? parsed.data?.jobs ?? parsed.data?.items ?? parsed.data ?? parsed);
  const fieldMap = settings.fieldMap ?? {};
  const path = (item: any, key: string, defaults: string[]) => {
    const chosen = fieldMap[key];
    if (chosen) return getPath(item, chosen);
    for (const candidate of defaults) { const value = getPath(item, candidate); if (value !== undefined && value !== null) return value; }
    return null;
  };
  return asArray(entries).slice(0, 50).map(item => {
    const itemUrl = absolutize(firstString(path(item, "sourceUrl", ["url", "link", "jobUrl", "applyUrl"])), base);
    const description = firstString(path(item, "description", ["description", "summary", "content"]));
    const rawResponsibilities = path(item, "responsibilities", ["responsibilities", "duties"]);
    const rawQualifications = path(item, "qualifications", ["qualifications", "requirements", "education"]);
    const rawHowToApply = path(item, "howToApply", ["howToApply", "applicationInstructions"]);
    const adFields = structureSourceFields(description, rawResponsibilities, rawQualifications, rawHowToApply);
    return buildCandidate({
      title: firstString(path(item, "title", ["title", "name", "jobTitle"])) ?? "",
      companyName: firstString(path(item, "companyName", ["company.name", "company", "employer.name", "organization.name"])),
      category: firstString(path(item, "category", ["category", "type"])),
      location: firstString(path(item, "location", ["location", "jobLocation.name", "city"])),
      deadline: firstString(path(item, "deadline", ["deadline", "validThrough", "applicationDeadline"])),
      description: adFields.description,
      responsibilities: adFields.responsibilities ?? rawResponsibilities,
      qualifications: adFields.qualifications ?? rawQualifications,
      howToApply: adFields.howToApply ?? rawHowToApply,
      applicationUrl: itemUrl,
      imageUrl: absolutize(firstString(path(item, "imageUrl", ["logo", "image", "company.logo"])), base),
    }, itemUrl ?? base, settings.companyName, JSON.stringify(item).slice(0, 30_000));
  }).filter(item => item.title);
}

function objectOrArray(value: any): any[] { return Array.isArray(value) ? value : value && typeof value === "object" ? [value] : []; }
function collectJobPosting(value: any, output: any[]) {
  for (const entry of objectOrArray(value)) {
    if (!entry || typeof entry !== "object") continue;
    const types = Array.isArray(entry["@type"]) ? entry["@type"] : [entry["@type"]];
    if (types.some(type => String(type).toLowerCase().split(/[\/#]/).pop() === "jobposting")) output.push(entry);
    if (entry["@graph"]) collectJobPosting(entry["@graph"], output);
    if (entry.itemListElement) collectJobPosting(entry.itemListElement, output);
  }
}
function parseJsonLd($: cheerio.CheerioAPI) {
  const postings: any[] = [];
  $("script[type='application/ld+json']").each((_, el) => {
    try { collectJobPosting(JSON.parse($(el).contents().text()), postings); } catch { /* malformed site markup is ignored */ }
  });
  return postings;
}
function nestedName(value: any) {
  if (typeof value === "string") return firstString(value);
  const locality = firstString(value?.addressLocality, value?.address?.addressLocality);
  const region = firstString(value?.addressRegion, value?.address?.addressRegion);
  const country = firstString(value?.addressCountry?.name, value?.addressCountry, value?.address?.addressCountry?.name, value?.address?.addressCountry);
  const parts = [locality, region, country].filter((part, index, all): part is string => !!part && (index === 0 || part.toLowerCase() !== all[index - 1]?.toLowerCase()));
  return parts.length ? parts.join(", ") : firstString(value?.name);
}
function sectionAfterHeading($: cheerio.CheerioAPI, matcher: RegExp) {
  let output: string | null = null;
  $("h1,h2,h3,h4,h5").each((_, node) => {
    if (output) return;
    const heading = $(node);
    if (!matcher.test(heading.text())) return;
    let html = "";
    let sibling = heading.next();
    while (sibling.length && !/^h[1-5]$/.test(sibling.get(0)?.tagName?.toLowerCase() ?? "")) {
      html += sibling.toString();
      sibling = sibling.next();
    }
    output = cleanListText(html, 8_000);
  });
  return output;
}
function htmlToAdvertText(html: string): string {
  const $ = cheerio.load(html, {}, false);
  $("br").replaceWith("\n");
  $("p,div,section,article,li,h1,h2,h3,h4,h5,h6,strong,b").each((_, node) => { $(node).prepend("\n").append("\n"); });
  return $.root().text().replace(/\u00a0/g, " ").split(/\n+/).map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
}
const deadlineDatePattern = String.raw`(?:\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*,?\s+\d{4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?\s*,?\s+\d{4}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})`;
function extractAdvertDeadline(text: string): string | null {
  const deadlineLine = new RegExp(String.raw`\b(?:application\s+(?:deadline|closing\s+date)|closing\s+date|deadline|last\s+date(?:\s+to\s+apply)?|apply\s+by|apply\s+before|tarehe\s+ya\s+mwisho)\b[^.\n]{0,100}?(${deadlineDatePattern})`, "i");
  return text.match(deadlineLine)?.[1]?.trim() ?? null;
}
export function extractHtmlPage(html: string, url: string, settings: SourceSettings, fallbackTitle?: string): CollectedCandidate | null {
  const $ = cheerio.load(html);
  const posting = parseJsonLd($)[0];
  const heading = cleanText($("main h1").first().text() || $("h1").first().text() || $("meta[property='og:title']").attr("content") || $("title").first().text() || fallbackTitle, 300);
  const mainText = cleanText($("main").first().text() || $("article").first().text() || $(".job-description,.job-detail,.content").first().text(), 20_000);
  const rawDescription = firstString(posting?.description, $("[itemprop='description']").first().text(), $("meta[name='description']").attr("content"), mainText);
  const advertMarkup = firstString(typeof posting?.description === "string" ? posting.description : null, $("[itemprop='description']").first().html(), $(".job-description,.job-detail,.content").first().html(), $("main").first().html(), $("article").first().html(), rawDescription) ?? "";
  const advertFields = structureSourceFields(advertMarkup, posting?.responsibilities, posting?.qualifications ?? posting?.educationRequirements ?? posting?.experienceRequirements, posting?.howToApply);
  const company = firstString(posting?.hiringOrganization?.name, $("[itemprop='hiringOrganization'] [itemprop='name']").attr("content"), $(".company-name,.employer-name,[itemprop='name']").first().text());
  const rawLocation = posting?.jobLocation;
  const location = rawLocation ? objectOrArray(rawLocation).map(place => nestedName(place?.address ?? place)).filter(Boolean).join(", ") : firstString($("[itemprop='jobLocation']").text(), $(".job-location,.location").first().text());
  const deadline = firstString(posting?.validThrough, $("[itemprop='validThrough']").attr("content"), $(".application-deadline,.deadline").first().text(), extractAdvertDeadline(mainText ?? $("body").text()));
  const responsibilities = advertFields.responsibilities ?? posting?.responsibilities ?? sectionAfterHeading($, /responsibilit|what you.?ll do|duties|majukumu/i);
  const qualifications = advertFields.qualifications ?? posting?.qualifications ?? posting?.educationRequirements ?? posting?.experienceRequirements ?? sectionAfterHeading($, /qualification|requirement|what you.?ll need|eligibility/i);
  const howToApply = advertFields.howToApply ?? posting?.howToApply ?? sectionAfterHeading($, /how to apply|application process|apply now/i);
  const applyHref = $("a").toArray().map(el => ({ text: $(el).text(), href: $(el).attr("href") })).find(item => item.href && /apply|application|submit/i.test(item.text));
  const applicationUrl = absolutize(firstString(posting?.url, applyHref?.href), url);
  const orgLogo = firstString(posting?.hiringOrganization?.logo?.url, posting?.hiringOrganization?.logo, $("meta[property='og:image']").attr("content"));
  const imageUrl = absolutize(orgLogo, url);
  const hasSchema = !!posting;
  if (!heading && !hasSchema) return null;
  return buildCandidate({
    title: firstString(posting?.title, heading, fallbackTitle) ?? "",
    companyName: firstString(posting?.hiringOrganization?.name, company), category: firstString(posting?.industry, posting?.occupationalCategory),
    location: firstString(typeof location === "string" ? location : null, posting?.jobLocationType),
    deadline: firstString(deadline, advertFields.deadline), description: firstString(advertFields.description), responsibilities: firstString(responsibilities),
    qualifications: firstString(qualifications), howToApply: firstString(howToApply), applicationUrl, imageUrl,
  }, url, settings.companyName, mainText ?? rawDescription);
}

async function scrapeCareerPage(url: string, settings: SourceSettings): Promise<CollectedCandidate[]> {
  const page = await safeFetch(url, "text/html,application/xhtml+xml,application/ld+json;q=0.9,*/*;q=0.5");
  const $ = cheerio.load(page.body);
  const structured = parseJsonLd($).map(posting => extractHtmlPage(`<script type='application/ld+json'>${JSON.stringify(posting).replace(/<\//g, "<\\/")}</script><main><h1>${String(posting.title ?? "").replace(/</g, "&lt;")}</h1>${posting.description ?? ""}</main>`, page.finalUrl, settings)).filter((candidate): candidate is CollectedCandidate => !!candidate && !!candidate.title);
  if (structured.length) return structured;

  const explicitSelector = settings.linkSelector?.trim();
  let anchors: Array<{ href: string; title: string }> = [];
  try {
    const selector = explicitSelector || "a[href]";
    anchors = $(selector).toArray().map(el => ({ href: $(el).attr("href") ?? "", title: cleanText($(el).text(), 300) ?? "" }))
      .filter(item => item.title.length >= 3 && item.title.length <= 180 && item.href)
      .map(item => ({ ...item, href: absolutize(item.href, page.finalUrl) ?? "" }))
      .filter(item => item.href && new URL(item.href).hostname === new URL(page.finalUrl).hostname && (explicitSelector || /job|career|vacan|opening|opportun|position|post/i.test(new URL(item.href).pathname)))
      .filter((item, index, all) => all.findIndex(other => other.href === item.href) === index)
      .slice(0, 10);
  } catch { anchors = []; }
  const candidates = await Promise.all(anchors.map(async anchor => {
    try {
      const detail = await safeFetch(anchor.href, "text/html,application/xhtml+xml,*/*;q=0.5");
      const extracted = extractHtmlPage(detail.body, detail.finalUrl, settings, anchor.title);
      return extracted && extracted.title ? extracted : buildCandidate({ title: anchor.title }, detail.finalUrl, settings.companyName, null);
    } catch { return null; }
  }));
  if (candidates.filter(Boolean).length) return candidates.filter((candidate): candidate is CollectedCandidate => !!candidate);
  const current = extractHtmlPage(page.body, page.finalUrl, settings);
  return current?.title ? [current] : [];
}

export async function collectFromSource(type: SourceType, url: string, settings: SourceSettings): Promise<CollectedCandidate[]> {
  if (type === "career" || type === "scraper") return scrapeCareerPage(url, settings);
  const response = await safeFetch(url, type === "rss" ? "application/rss+xml,application/atom+xml,application/xml,text/xml,*/*;q=0.5" : "application/json,*/*;q=0.5");
  return type === "rss" ? parseRss(response.body, response.finalUrl, settings) : parseJson(response.body, response.finalUrl, settings);
}
