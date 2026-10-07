import { createHash } from "node:crypto";

export type CandidateFields = {
  title?: string | null;
  companyName?: string | null;
  applicationUrl?: string | null;
  description?: string | null;
};
export type DuplicateMatch = { recordType: "job" | "pending"; recordId: number; title: string; companyName: string | null; reasons: string[] };

const normalize = (value?: string | null) => (value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function canonicalUrl(value?: string | null) {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$)/i.test(key)) url.searchParams.delete(key);
    return `${url.protocol}//${url.host.toLowerCase()}${url.pathname.replace(/\/$/, "")}${url.search}`.toLowerCase();
  } catch { return ""; }
}

function wordSet(value: string) {
  return new Set(normalize(value).split(/\s+/).filter(word => word.length > 2));
}

function similarity(a: string, b: string) {
  const left = wordSet(a); const right = wordSet(b);
  if (!left.size || !right.size) return 0;
  let shared = 0; for (const word of left) if (right.has(word)) shared++;
  return shared / (left.size + right.size - shared);
}

export function candidateFingerprint(sourceId: number, item: CandidateFields & { sourceUrl?: string | null }) {
  const canonicalItemUrl = canonicalUrl(item.sourceUrl) || canonicalUrl(item.applicationUrl);
  const seed = canonicalItemUrl || [normalize(item.title), normalize(item.companyName), normalize(item.description).slice(0, 900)].join("|");
  return createHash("sha256").update(`${sourceId}|${seed}`).digest("hex");
}

export function findDuplicateMatches(candidate: CandidateFields, records: Array<CandidateFields & { recordType: "job" | "pending"; recordId: number }>): DuplicateMatch[] {
  const title = normalize(candidate.title);
  const company = normalize(candidate.companyName);
  const app = canonicalUrl(candidate.applicationUrl);
  const desc = candidate.description ?? "";
  const result: DuplicateMatch[] = [];
  for (const record of records) {
    const oldTitle = normalize(record.title);
    const oldCompany = normalize(record.companyName);
    const reasons: string[] = [];
    const titleMatch = !!title && !!oldTitle && title === oldTitle;
    const companyMatch = !!company && !!oldCompany && company === oldCompany;
    const appMatch = !!app && !!canonicalUrl(record.applicationUrl) && app === canonicalUrl(record.applicationUrl);
    const descriptionMatch = desc.trim().length >= 100 && (record.description ?? "").trim().length >= 100 && similarity(desc, record.description ?? "") >= 0.82;
    if (titleMatch) reasons.push("title match");
    if (companyMatch) reasons.push("company match");
    if (appMatch) reasons.push("application link match");
    if (descriptionMatch) reasons.push("description similarity");
    const possible = appMatch || (titleMatch && (!company || !oldCompany || companyMatch)) || (descriptionMatch && (!company || !oldCompany || companyMatch));
    if (possible) result.push({ recordType: record.recordType, recordId: record.recordId, title: record.title ?? "Untitled listing", companyName: record.companyName ?? null, reasons });
  }
  return result.slice(0, 8);
}
