import { Buffer } from "node:buffer";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const MAX_JOB_AD_TEXT = 40_000;
export const MAX_JOB_AD_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_OCR_PAGES = 8;
export type OutputLanguage = "source" | "English" | "Kiswahili";
export type JobAdFields = {
  title: string; companyName: string; companyDescription: string; companyWebsiteUrl: string; companyLogoUrl: string;
  category: string; location: string; deadline: string; description: string; responsibilities: string;
  qualifications: string; howToApply: string; applicationUrl: string; imageUrl: string;
};
export type StructuredJobAd = { fields: JobAdFields; reviewNotes: string[] };

type SectionKey = "description" | "companyDescription" | "responsibilities" | "qualifications" | "howToApply";
type TranslatableKey = "companyDescription" | "description" | "responsibilities" | "qualifications" | "howToApply";

const limits: Record<keyof JobAdFields, number> = {
  title: 300, companyName: 240, companyDescription: 12_000, companyWebsiteUrl: 2048, companyLogoUrl: 2048,
  category: 120, location: 240, deadline: 240, description: 30_000, responsibilities: 12_000,
  qualifications: 12_000, howToApply: 8000, applicationUrl: 2048, imageUrl: 2048,
};
const stringFieldNames = Object.keys(limits) as Array<keyof JobAdFields>;
const descriptiveFields: TranslatableKey[] = ["companyDescription", "description", "responsibilities", "qualifications", "howToApply"];
const execFileAsync = promisify(execFile);
const emptyFields = (): JobAdFields => Object.fromEntries(stringFieldNames.map(key => [key, ""])) as JobAdFields;

export function safeExtractedHttpUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    const normalized = url.toString();
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password && normalized.length <= 2048 ? normalized : "";
  } catch { return ""; }
}

export function normalizeStructuredJobAd(value: unknown, outputLanguage: OutputLanguage = "source"): StructuredJobAd {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const fields = {} as JobAdFields;
  const invalidUrls: string[] = [];
  for (const key of stringFieldNames) {
    const rawValue = typeof raw[key] === "string" ? raw[key].trim() : "";
    if (["companyWebsiteUrl", "companyLogoUrl", "applicationUrl", "imageUrl"].includes(key)) {
      const safe = safeExtractedHttpUrl(rawValue);
      if (rawValue && !safe) invalidUrls.push(key);
      fields[key] = safe;
    } else fields[key] = rawValue.slice(0, limits[key]);
  }
  const notes = Array.isArray(raw.reviewNotes) ? raw.reviewNotes.filter((note): note is string => typeof note === "string").map(note => note.trim().slice(0, 300)).filter(Boolean).slice(0, 8) : [];
  const sw = outputLanguage === "Kiswahili";
  if (!fields.title) notes.unshift(sw ? "Jina la nafasi halijaonekana; lijaze kutoka kwenye chanzo kabla ya kuhifadhi." : "Job title is blank; complete it from the source before saving.");
  if (!fields.companyName) notes.unshift(sw ? "Kampuni au taasisi haikutambuliwa; hakiki chanzo." : "Company or institution was not identified; verify the source.");
  if (!fields.applicationUrl && !fields.howToApply) notes.push(sw ? "Kiungo au maelekezo ya kutuma maombi hayakupatikana." : "No application link or instructions were found.");
  if (invalidUrls.length) notes.push(sw ? "Kiungo kimoja au zaidi kisicho salama kiliondolewa; hakiki maelezo ya chanzo." : "One or more extracted URLs were not valid public HTTP(S) links and were removed.");
  return { fields, reviewNotes: [...new Set(notes)].slice(0, 10) };
}

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[&/]/g, " and ").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

const sectionAliases: Record<SectionKey, string[]> = {
  description: ["job description", "job summary", "position summary", "role overview", "about the role", "overview", "maelezo ya kazi", "muhtasari wa nafasi"],
  companyDescription: ["about the company", "about the organisation", "about the organization", "company profile", "organisation profile", "organization profile", "kuhusu kampuni", "kuhusu taasisi"],
  responsibilities: ["responsibilities", "key responsibilities", "duties", "key duties", "duties and responsibilities", "roles and responsibilities", "main responsibilities", "majukumu", "majukumu makuu", "kazi na majukumu"],
  qualifications: ["qualifications", "requirements", "qualifications and requirements", "qualifications and experience", "education and experience", "skills and experience", "what you will need", "sifa", "vigezo", "sifa na vigezo", "elimu na uzoefu"],
  howToApply: ["how to apply", "application procedure", "application instructions", "method of application", "applying", "jinsi ya kuomba", "namna ya kutuma maombi", "maombi", "kutuma maombi"],
};
const metadataLabels: Array<{ key: keyof JobAdFields; labels: string[] }> = [
  { key: "title", labels: ["job title", "position title", "position", "vacancy", "role", "nafasi ya kazi"] },
  { key: "companyName", labels: ["company", "company name", "employer", "hiring organization", "hiring organisation", "organization", "organisation", "institution", "kampuni", "mwajiri", "taasisi"] },
  { key: "location", labels: ["location", "work location", "duty station", "mahali pa kazi"] },
  { key: "deadline", labels: ["deadline", "closing date", "application deadline", "application closing date", "tarehe ya mwisho"] },
  { key: "category", labels: ["category", "job category", "field"] },
  { key: "companyWebsiteUrl", labels: ["company website", "organization website", "organisation website", "website"] },
  { key: "companyLogoUrl", labels: ["company logo url", "logo url"] },
  { key: "applicationUrl", labels: ["application url", "apply url", "application link", "apply link"] },
];

function parseMetadata(line: string): { key: keyof JobAdFields; value: string } | null {
  const cleaned = line.trim().replace(/^(?:[-*•▪‣]|\d+[.)])\s+/, "");
  const split = cleaned.match(/^(.{1,70}?)\s*[:：]\s*(.+)$/);
  if (!split) return null;
  const label = normalizeLabel(split[1]);
  for (const rule of metadataLabels) {
    if (rule.labels.some(item => normalizeLabel(item) === label)) return { key: rule.key, value: split[2].trim() };
  }
  return null;
}

function parseSectionHeading(line: string): { key: SectionKey; inline: string } | null {
  const cleaned = line.trim().replace(/^(?:[-*•▪‣]|\d+[.)])\s+/, "");
  const split = cleaned.match(/^(.{1,100}?)(?:\s*[:：]\s*|\s+[—–-]\s+)(.*)$/);
  const label = normalizeLabel(split?.[1] ?? cleaned);
  const inline = split?.[2]?.trim() ?? "";
  for (const [key, aliases] of Object.entries(sectionAliases) as Array<[SectionKey, string[]]>) {
    if (aliases.some(item => normalizeLabel(item) === label)) return { key, inline };
  }
  return null;
}

function normalizeSectionLines(lines: string[]): string {
  return lines.map(line => line.trim().replace(/[ \t]+/g, " ")).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function bulletize(value: string): string {
  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return "";
  let items: string[];
  if (lines.length > 1) {
    items = lines;
  } else {
    const single = lines[0];
    if (/^(?:[-*•▪‣]|\d+[.)])\s+/.test(single)) items = [single];
    else if (single.includes(";")) items = single.split(/\s*;\s*/);
    else {
      const sentences = single.split(/(?<=[.!?])\s+(?=[A-Z0-9•*-])/);
      items = sentences.length > 1 ? sentences : [single];
    }
  }
  return items.map(item => item.trim().replace(/^(?:[-*•▪‣]|\d+[.)])\s+/, "").trim()).filter(Boolean).map(item => `• ${item}`).join("\n");
}

function parseAdText(sourceText: string): { fields: JobAdFields; notes: string[] } {
  const fields = emptyFields();
  const sectionLines: Record<SectionKey, string[]> = {
    description: [], companyDescription: [], responsibilities: [], qualifications: [], howToApply: [],
  };
  const unassigned: string[] = [];
  let activeSection: SectionKey | null = null;
  const lines = sourceText.replace(/\r\n?/g, "\n").replace(/[\t ]+/g, " ").split("\n");

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (activeSection) sectionLines[activeSection].push("");
      else unassigned.push("");
      continue;
    }
    const metadata = parseMetadata(line);
    if (metadata) {
      fields[metadata.key] = metadata.value;
      activeSection = null;
      continue;
    }
    const heading = parseSectionHeading(line);
    if (heading) {
      activeSection = heading.key;
      if (heading.inline) sectionLines[activeSection].push(heading.inline);
      continue;
    }
    if (activeSection) sectionLines[activeSection].push(line);
    else unassigned.push(line);
  }

  const remaining = [...unassigned];
  if (!fields.title) {
    const first = remaining.find(line => line.length <= 120 && !/^https?:\/\//i.test(line) && !/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(line));
    if (first && !/^(job vacancy|job advertisement|career opportunity|nafasi za kazi|tangazo la kazi)$/i.test(first)) {
      fields.title = first;
      remaining.splice(remaining.indexOf(first), 1);
    }
  }

  fields.companyDescription = normalizeSectionLines(sectionLines.companyDescription);
  fields.description = normalizeSectionLines(sectionLines.description) || normalizeSectionLines(remaining);
  fields.responsibilities = bulletize(normalizeSectionLines(sectionLines.responsibilities));
  fields.qualifications = bulletize(normalizeSectionLines(sectionLines.qualifications));
  fields.howToApply = normalizeSectionLines(sectionLines.howToApply);

  if (!fields.howToApply) {
    const contactLines = remaining.filter(line => /\b(?:apply|application|submit|send your|email|e-mail|phone|call|maombi|omba|tuma|wasiliana)\b/i.test(line) || /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(line) || /\+?\d[\d().\s/-]{5,}\d/.test(line));
    if (contactLines.length) fields.howToApply = contactLines.join("\n");
  }

  if (!fields.applicationUrl) {
    const urls = [...sourceText.matchAll(/https?:\/\/[^\s<>"']+/gi)].map(match => safeExtractedHttpUrl(match[0].replace(/[),.;!?\]]+$/, ""))).filter(Boolean);
    const applyUrl = urls.find(url => /apply|application|career|recruit|vacanc|job/i.test(url));
    if (applyUrl) fields.applicationUrl = applyUrl;
  }

  return { fields, notes: [] };
}

const englishWords = new Set(["the", "and", "or", "to", "for", "with", "of", "in", "on", "by", "experience", "apply", "qualifications", "responsibilities", "job", "position", "will", "should", "who", "have", "required", "minimum", "degree", "certificate", "must", "from", "your", "are", "be", "is", "at", "as"]);
const swahiliWords = new Set(["nafasi", "kazi", "majukumu", "sifa", "elimu", "uzoefu", "kutuma", "maombi", "husika", "mwisho", "tarehe", "wanaotakiwa", "anahitajika", "cheti", "shahada", "katika", "kwa", "wa", "ya", "na", "ni", "kutoka", "hutakiwa", "mgombea", "taasisi", "kampuni", "kuomba", "mshahara", "masharti", "wajibu", "mwenye", "ambaye", "pamoja"]);

export function detectTranslationSource(text: string): "en" | "sw" | null {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  let english = 0;
  let swahili = 0;
  for (const word of words) {
    if (englishWords.has(word)) english++;
    if (swahiliWords.has(word)) swahili++;
  }
  if (swahili >= 2 && swahili >= english + 2 && swahili >= english * 1.25) return "sw";
  if (english >= 2 && english >= swahili + 2 && english >= swahili * 1.25) return "en";
  return null;
}

function translateOffline(source: "en" | "sw", target: "en" | "sw", texts: string[]): Promise<string[]> {
  const script = path.join(process.cwd(), "server", "getmchongo", "local-translation.py");
  const python = process.env.ARGOS_PYTHON?.trim() || "python3";
  return new Promise((resolve, reject) => {
    const child = spawn(python, [script], { stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, ARGOS_DEVICE_TYPE: "cpu" } });
    const out: Buffer[] = [];
    const errors: Buffer[] = [];
    let outputBytes = 0;
    let errorBytes = 0;
    let settled = false;
    const finishReject = (error: Error) => { if (!settled) { settled = true; clearTimeout(timer); reject(error); } };
    const timer = setTimeout(() => { child.kill("SIGKILL"); finishReject(new Error("Offline translation took too long. Try a shorter advertisement.")); }, 90_000);
    child.stdout.on("data", (chunk: Buffer) => { outputBytes += chunk.length; if (outputBytes > 200_000) { child.kill("SIGKILL"); finishReject(new Error("Offline translator returned too much data.")); } else out.push(chunk); });
    child.stderr.on("data", (chunk: Buffer) => { errorBytes += chunk.length; if (errorBytes <= 4000) errors.push(chunk); });
    child.on("error", () => finishReject(new Error("Offline translation runtime is unavailable. Deploy the current Docker image with the local translation models.")));
    child.on("close", code => {
      if (settled) return;
      clearTimeout(timer);
      if (code !== 0) { settled = true; reject(new Error(Buffer.concat(errors).toString("utf8").trim() || "Offline translation failed. Review the source text and try again.")); return; }
      try {
        const result = JSON.parse(Buffer.concat(out).toString("utf8")) as { texts?: unknown };
        if (!Array.isArray(result.texts) || result.texts.length !== texts.length || !result.texts.every(item => typeof item === "string")) throw new Error("Unexpected translation response.");
        settled = true;
        resolve(result.texts as string[]);
      } catch (error) { settled = true; reject(error instanceof Error ? error : new Error("Offline translation returned invalid data.")); }
    });
    child.stdin.on("error", () => undefined);
    child.stdin.end(JSON.stringify({ source, target, texts }));
  });
}

function countNote(outputLanguage: OutputLanguage): string {
  return outputLanguage === "Kiswahili"
    ? "Maandishi yamechanganuliwa hapa kwenye seva na kutafsiriwa bila OpenAI; hakiki majina, tarehe, masharti na tafsiri kabla ya kuhifadhi."
    : "The ad was processed on this server without OpenAI; review names, dates, requirements, OCR and translation before saving.";
}

async function translateFields(fields: JobAdFields, outputLanguage: OutputLanguage, notes: string[]): Promise<void> {
  if (outputLanguage === "source") return;
  const content = descriptiveFields.map(key => fields[key]).filter(Boolean).join("\n");
  if (!content) return;
  const detected = detectTranslationSource(content);
  if (!detected) {
    notes.push(outputLanguage === "Kiswahili"
      ? "Lugha ya chanzo haikutambuliwa kwa uhakika; maandishi yameachwa bila tafsiri."
      : "The source language was not clear enough to translate safely; the descriptive text was left unchanged.");
    return;
  }
  const target = outputLanguage === "English" ? "en" : "sw";
  if (detected === target) return;
  const values = descriptiveFields.map(key => fields[key]);
  const translated = await translateOffline(detected, target, values);
  descriptiveFields.forEach((key, index) => { fields[key] = translated[index].trim().slice(0, limits[key]); });
}

async function runCommand(command: string, args: string[], timeout: number, maxBuffer = 5_000_000): Promise<string> {
  try {
    const result = await execFileAsync(command, args, { encoding: "utf8", timeout, maxBuffer });
    return result.stdout;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String((error as NodeJS.ErrnoException).code) : "";
    if (code === "ENOENT") throw new Error(`The local ${command} utility is not installed. Use the Railway Docker deployment or install the documented OCR tools.`);
    throw error;
  }
}

async function runTesseract(imagePath: string): Promise<string> {
  const text = await runCommand("tesseract", [imagePath, "stdout", "-l", "eng+swa", "--psm", "6"], 60_000, 1_000_000);
  return text.trim().slice(0, MAX_JOB_AD_TEXT);
}

async function extractPdf(bytes: Buffer): Promise<{ text: string; pageCount: number }> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "getmchongo-ad-"));
  try {
    const pdfPath = path.join(directory, "source.pdf");
    await writeFile(pdfPath, bytes);
    const info = await runCommand("pdfinfo", [pdfPath], 15_000, 500_000);
    const pageCount = Number(info.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
    if (!Number.isSafeInteger(pageCount) || pageCount < 1) throw new Error("The uploaded PDF has no readable pages.");
    const text = await runCommand("pdftotext", ["-f", "1", "-l", String(Math.min(pageCount, MAX_PDF_OCR_PAGES)), "-layout", "-enc", "UTF-8", pdfPath, "-"], 30_000, 1_000_000);
    return { text: text.replace(/\f/g, "\n").trim().slice(0, MAX_JOB_AD_TEXT), pageCount };
  } finally { await rm(directory, { recursive: true, force: true }); }
}

async function ocrPdf(bytes: Buffer, pageCount: number): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "getmchongo-ad-"));
  try {
    const pdfPath = path.join(directory, "source.pdf");
    const prefix = path.join(directory, "page");
    await writeFile(pdfPath, bytes);
    await runCommand("pdftoppm", ["-f", "1", "-l", String(Math.min(pageCount, MAX_PDF_OCR_PAGES)), "-r", "150", "-jpeg", "-jpegopt", "quality=82", pdfPath, prefix], 60_000);
    const imageNames = (await readdir(directory)).filter(name => /^page-\d+\.jpg$/i.test(name)).sort((a, b) => Number(a.match(/(\d+)\.jpg$/i)?.[1] ?? 0) - Number(b.match(/(\d+)\.jpg$/i)?.[1] ?? 0));
    if (!imageNames.length) throw new Error("This PDF could not be rendered for OCR. Try a clearer PDF or upload a photo of the advert.");
    const pages: string[] = [];
    for (const name of imageNames) {
      const text = await runTesseract(path.join(directory, name));
      if (text) pages.push(text);
      if (pages.join("\n\n").length >= MAX_JOB_AD_TEXT) break;
    }
    return pages.join("\n\n").slice(0, MAX_JOB_AD_TEXT);
  } finally { await rm(directory, { recursive: true, force: true }); }
}

async function extractDocumentText(document: { mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp"; bytes: Buffer }): Promise<{ text: string; notes: string[] }> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "getmchongo-ad-"));
  try {
    if (document.mimeType === "application/pdf") {
      const pdf = await extractPdf(document.bytes);
      let text = pdf.text;
      if (text.length < 300) {
        const recognized = await ocrPdf(document.bytes, pdf.pageCount);
        if (recognized.length > text.length) text = recognized;
      }
      if (!text.trim()) throw new Error("No readable text was found. Try a clearer photo or PDF, or paste the advertisement text.");
      const notes = pdf.pageCount > MAX_PDF_OCR_PAGES ? [`Only the first ${MAX_PDF_OCR_PAGES} pages of this ${pdf.pageCount}-page PDF were processed.`] : [];
      return { text: text.slice(0, MAX_JOB_AD_TEXT), notes };
    }
    const imagePath = path.join(directory, "source.jpg");
    await writeFile(imagePath, document.bytes);
    const text = await runTesseract(imagePath);
    if (!text.trim()) throw new Error("No readable text was found in the image. Try a clearer, upright photo or paste the advert text.");
    return { text, notes: [] };
  } finally { await rm(directory, { recursive: true, force: true }); }
}

export async function structureJobAd(options: {
  sourceText: string;
  outputLanguage: OutputLanguage;
  document?: { mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp"; bytes: Buffer; filename?: string };
}): Promise<StructuredJobAd> {
  let sourceText = options.sourceText.trim();
  const extractionNotes: string[] = [];
  if (options.document) {
    const extracted = await extractDocumentText(options.document);
    sourceText = [sourceText, extracted.text].filter(Boolean).join("\n\n").slice(0, MAX_JOB_AD_TEXT);
    extractionNotes.push(...extracted.notes);
  }
  if (!sourceText) throw new Error("Paste the advertisement text or choose a readable PDF/photo first.");
  const parsed = parseAdText(sourceText);
  await translateFields(parsed.fields, options.outputLanguage, extractionNotes);
  parsed.fields.responsibilities = bulletize(parsed.fields.responsibilities);
  parsed.fields.qualifications = bulletize(parsed.fields.qualifications);
  const normalized = normalizeStructuredJobAd(parsed.fields, options.outputLanguage);
  return {
    fields: normalized.fields,
    reviewNotes: [...new Set([countNote(options.outputLanguage), ...extractionNotes, ...normalized.reviewNotes])].slice(0, 10),
  };
}
