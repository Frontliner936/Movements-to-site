import { Buffer } from "node:buffer";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

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
type TranslatableKey = "title" | "companyDescription" | "description" | "responsibilities" | "qualifications" | "howToApply";

const limits: Record<keyof JobAdFields, number> = {
  title: 300, companyName: 240, companyDescription: 12_000, companyWebsiteUrl: 2048, companyLogoUrl: 2048,
  category: 120, location: 240, deadline: 240, description: 30_000, responsibilities: 12_000,
  qualifications: 12_000, howToApply: 8000, applicationUrl: 2048, imageUrl: 2048,
};
const stringFieldNames = Object.keys(limits) as Array<keyof JobAdFields>;
const translatableFields: TranslatableKey[] = ["title", "companyDescription", "description", "responsibilities", "qualifications", "howToApply"];
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

const leadingListMarker = /^(?:[-*•▪‣¢●◦·]|\d+[.)])\s+/u;

function stripLeadingListMarkers(value: string): string {
  let cleaned = value.trim();
  while (leadingListMarker.test(cleaned)) cleaned = cleaned.replace(leadingListMarker, "").trim();
  return cleaned;
}

const sectionAliases: Record<SectionKey, string[]> = {
  description: ["description", "job description", "job summary", "position summary", "role overview", "about the role", "overview", "maelezo ya kazi", "muhtasari wa nafasi"],
  companyDescription: ["about the company", "about the organisation", "about the organization", "company profile", "organisation profile", "organization profile", "kuhusu kampuni", "kuhusu taasisi"],
  responsibilities: ["responsibilities", "key responsibilities", "duties", "key duties", "job duties", "job responsibilities", "duties and responsibilities", "key duties and responsibilities", "responsibilities and duties", "roles and responsibilities", "main responsibilities", "key accountabilities", "key tasks", "main tasks", "what you will do", "majukumu", "majukumu makuu", "kazi na majukumu", "wajibu na majukumu"],
  qualifications: ["qualifications", "requirements", "qualifications and requirements", "qualifications and experience", "qualifications and experience required", "minimum qualifications", "minimum requirements", "education and experience", "skills and experience", "candidate requirements", "candidate profile", "person specification", "what you will need", "sifa", "vigezo", "sifa na vigezo", "elimu na uzoefu", "vigezo vya mwombaji"],
  howToApply: ["how to apply", "application procedure", "application instructions", "application process", "method of application", "applying", "jinsi ya kuomba", "namna ya kutuma maombi", "maombi", "kutuma maombi"],
};
const metadataLabels: Array<{ key: keyof JobAdFields; labels: string[] }> = [
  { key: "title", labels: ["job title", "position title", "job position", "position applied for", "vacancy title", "position", "vacancy", "role", "nafasi ya kazi"] },
  { key: "companyName", labels: ["company", "company name", "employer", "hiring organization", "hiring organisation", "organization", "organisation", "institution", "kampuni", "mwajiri", "taasisi"] },
  { key: "location", labels: ["location", "work location", "job location", "duty station", "place of work", "mahali pa kazi"] },
  { key: "deadline", labels: ["deadline", "closing date", "application deadline", "application closing date", "last date to apply", "deadline to apply", "tarehe ya mwisho"] },
  { key: "category", labels: ["category", "job category", "field"] },
  { key: "companyWebsiteUrl", labels: ["company website", "organization website", "organisation website", "website"] },
  { key: "companyLogoUrl", labels: ["company logo url", "logo url"] },
  { key: "applicationUrl", labels: ["application url", "apply url", "application link", "apply link"] },
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function aliasPattern(alias: string): string {
  return normalizeLabel(alias).split(" ").map(word => word === "and" ? "(?:and|&|/)" : escapeRegex(word)).join("\\s+");
}

const inlineAdLabelPattern = [...new Set([
  ...metadataLabels.flatMap(rule => rule.labels),
  ...Object.values(sectionAliases).flat(),
])].sort((a, b) => b.length - a.length).map(aliasPattern).join("|");
const inlineAdLabelRegex = new RegExp(`(^|[\\s|;])(${inlineAdLabelPattern})(?:\\s*[:：]|\\s+[—–-])\\s*`, "gi");

function splitInlineAdLabels(line: string): string {
  return line.replace(inlineAdLabelRegex, (match, _boundary: string, label: string, offset: number) => `${offset > 0 ? "\n" : ""}${label}: `)
    .replace(/[ \t]*[|;][ \t]*(?=\n|$)/g, "");
}

function metadataHeadingKey(line: string): keyof JobAdFields | null {
  const label = normalizeLabel(stripLeadingListMarkers(line).replace(/[:：]+$/, ""));
  return metadataLabels.find(rule => rule.labels.some(item => normalizeLabel(item) === label))?.key ?? null;
}

const monthNames = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const explicitDateRegex = new RegExp(`\\b(?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${monthNames})\\s*,?\\s+\\d{4}|(?:${monthNames})\\s+\\d{1,2}(?:st|nd|rd|th)?\\s*,?\\s+\\d{4}|\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2})\\b`, "i");
const deadlineCueRegex = /\b(?:application.{0,24}deadline|closing date|deadline|application.{0,30}clos(?:e|es|ed|ing)|last date|apply by|apply before|submit.{0,30}by|received by|tarehe ya mwisho|mwisho wa kutuma maombi|maombi.{0,30}(?:hadi|mwisho))\b/i;

function inferExplicitDeadline(line: string): string | null {
  if (!deadlineCueRegex.test(line)) return null;
  return line.match(explicitDateRegex)?.[0]?.replace(/[,\s]+$/, "") ?? null;
}

const qualificationCueRegex = /\b(?:minimum (?:education|qualification|requirement)|qualifications?|requirements?|education|degree|diploma|certificate|bachelor|master|phd|years?.{0,30}experience|experience in|proficien(?:t|cy)|skills?|must have|should have|candidate must|applicants? (?:must|should|need)|licen[cs]e|registration|sifa|vigezo|elimu|shahada|stashahada|cheti|uzoefu|ujuzi|mwenye)\b/i;
const responsibilityCueRegex = /\b(?:responsibilities|duties|key tasks|accountabilities|responsible for|will be expected to|you will)\b/i;
const responsibilityActionRegex = /^(?:manage|lead|coordinate|prepare|support|develop|provide|monitor|implement|conduct|supervise|maintain|ensure|review|analy[sz]e|deliver|facilitate|organize|organise|collect|report|design|oversee|assist|liaise|track|create|perform|carry out|undertake|kusimamia|kuratibu|kuandaa|kusaidia|kuhakikisha|kufuatilia|kutekeleza|kufanya|kutoa|kuongoza|kukusanya|kuandika|kushauri)\b/i;

function classifyUnlabelledLine(line: string): SectionKey | null {
  const cleaned = stripLeadingListMarkers(line);
  if (qualificationCueRegex.test(cleaned)) return "qualifications";
  if (responsibilityCueRegex.test(cleaned) || responsibilityActionRegex.test(cleaned)) return "responsibilities";
  return null;
}

const likelyJobTitleRegex = /\b(?:officer|manager|assistant|engineer|analyst|accountant|director|coordinator|supervisor|specialist|technician|administrator|executive|teacher|nurse|doctor|driver|clerk|intern|consultant|lecturer|researcher|inspector|attendant|meneja|afisa|mhasibu|mwalimu|mhandisi|mkurugenzi|mratibu|msaidizi|mshauri|mtaalamu|daktari|muuguzi|mkaguzi)\b/i;

function parseMetadata(line: string): { key: keyof JobAdFields; value: string } | null {
  const cleaned = stripLeadingListMarkers(line);
  const split = cleaned.match(/^(.{1,70}?)\s*[:：]\s*(.+)$/);
  if (!split) return null;
  const label = normalizeLabel(split[1]);
  for (const rule of metadataLabels) {
    if (rule.labels.some(item => normalizeLabel(item) === label)) return { key: rule.key, value: split[2].trim() };
  }
  return null;
}

function parseSectionHeading(line: string): { key: SectionKey; inline: string } | null {
  const cleaned = stripLeadingListMarkers(line);
  const split = cleaned.match(/^(.{1,100}?)(?:\s*[:：]\s*|\s+[—–-]\s+)(.*)$/);
  const label = normalizeLabel(split?.[1] ?? cleaned);
  const inline = split?.[2]?.trim() ?? "";
  for (const [key, aliases] of Object.entries(sectionAliases) as Array<[SectionKey, string[]]>) {
    if (aliases.some(item => normalizeLabel(item) === label)) return { key, inline };
  }
  return null;
}

const unrelatedSectionHeadings = new Set([
  "benefits", "what we offer", "what you get", "our values", "about us", "equal opportunity employer",
  "equal employment opportunity", "important notice", "disclaimer", "terms and conditions", "salary and benefits",
].map(normalizeLabel));

function isUnrecognizedSectionHeading(line: string): boolean {
  if (leadingListMarker.test(line)) return false;
  const cleaned = line.trim().replace(/[:：]+$/, "");
  if (unrelatedSectionHeadings.has(normalizeLabel(cleaned))) return true;
  if (/[:：]\s*$/.test(line)) return true;
  const letters = cleaned.match(/[A-Za-z]/g) ?? [];
  return cleaned.length <= 72 && letters.length >= 4 && letters.every(letter => letter === letter.toUpperCase());
}

const genericTitleHeadings = new Set([
  "job vacancy", "job advertisement", "vacancy announcement", "vacancy notice", "job opening", "job opportunities",
  "career opportunity", "career vacancies", "join our team", "now hiring", "we are hiring", "help wanted", "careers",
  "open positions", "apply now", "nafasi za kazi", "tangazo la kazi", "ajira",
].map(normalizeLabel));

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
    if (leadingListMarker.test(single)) items = [single];
    else if (single.includes(";")) items = single.split(/\s*;\s*/);
    else {
      const sentences = single.split(/(?<=[.!?])\s+(?=[A-Z0-9•*-])/);
      items = sentences.length > 1 ? sentences : [single];
    }
  }
  return items.map(stripLeadingListMarkers).filter(Boolean).map(item => `• ${item}`).join("\n");
}

function parseAdText(sourceText: string, outputLanguage: OutputLanguage = "source"): { fields: JobAdFields; notes: string[] } {
  const fields = emptyFields();
  const sectionLines: Record<SectionKey, string[]> = {
    description: [], companyDescription: [], responsibilities: [], qualifications: [], howToApply: [],
  };
  const unassigned: string[] = [];
  let activeSection: SectionKey | null = null;
  let pendingMetadata: keyof JobAdFields | null = null;
  const lines = sourceText.replace(/\r\n?/g, "\n").split("\n").flatMap(line => splitInlineAdLabels(line).split("\n"));

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (activeSection) sectionLines[activeSection].push("");
      continue;
    }
    if (pendingMetadata) {
      const startsAnotherField = parseMetadata(line) || parseSectionHeading(line) || metadataHeadingKey(line);
      const isUnrelatedHeading = unrelatedSectionHeadings.has(normalizeLabel(line.replace(/[:：]+$/, ""))) || /[:：]\s*$/.test(line);
      if (!startsAnotherField && !isUnrelatedHeading) {
        fields[pendingMetadata] = stripLeadingListMarkers(line);
        pendingMetadata = null;
        activeSection = null;
        continue;
      }
      pendingMetadata = null;
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
    const metadataKey = metadataHeadingKey(line);
    if (metadataKey) {
      pendingMetadata = metadataKey;
      activeSection = null;
      continue;
    }
    if (activeSection && isUnrecognizedSectionHeading(line)) {
      activeSection = null;
      unassigned.push(line);
      continue;
    }
    if (activeSection) sectionLines[activeSection].push(line);
    else unassigned.push(line);
  }

  if (!fields.deadline) {
    for (const line of lines) {
      const deadline = inferExplicitDeadline(line);
      if (deadline) { fields.deadline = deadline; break; }
    }
  }

  const remaining: string[] = [];
  for (const line of unassigned) {
    if (!line.trim()) continue;
    const deadline = inferExplicitDeadline(line);
    if (deadline) {
      if (!fields.deadline) fields.deadline = deadline;
      continue;
    }
    const looseSection = classifyUnlabelledLine(line);
    if (looseSection) sectionLines[looseSection].push(line);
    else remaining.push(line);
  }
  if (!fields.title) {
    const isTitleCandidate = (line: string) => {
      const cleaned = stripLeadingListMarkers(line);
      return cleaned.length >= 3 && cleaned.length <= 120 && /[A-Za-z]/.test(cleaned) && !/^https?:\/\//i.test(cleaned)
        && !/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(cleaned) && !genericTitleHeadings.has(normalizeLabel(cleaned))
        && !unrelatedSectionHeadings.has(normalizeLabel(cleaned));
    };
    const first = remaining.find(line => isTitleCandidate(line) && likelyJobTitleRegex.test(stripLeadingListMarkers(line)))
      ?? remaining.find(isTitleCandidate);
    if (first) {
      fields.title = first;
      remaining.splice(remaining.indexOf(first), 1);
    }
  }

  fields.companyDescription = normalizeSectionLines(sectionLines.companyDescription);
  // Unassigned OCR words may come from poster decoration or side columns; do not guess their field.
  fields.description = normalizeSectionLines(sectionLines.description);
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

  const sw = outputLanguage === "Kiswahili";
  const notes: string[] = [];
  if (!fields.responsibilities) notes.push(sw ? "Majukumu hayakutambuliwa kwa uhakika; hakiki tangazo na uyaongeze mwenyewe." : "Responsibilities were not identified confidently; review the ad and add them manually.");
  if (!fields.qualifications) notes.push(sw ? "Sifa au vigezo havikutambuliwa kwa uhakika; hakiki tangazo na uviongeze mwenyewe." : "Qualifications or requirements were not identified confidently; review the ad and add them manually.");
  if (!fields.description && !fields.responsibilities && !fields.qualifications) notes.push(sw ? "Maandishi yasiyo na kichwa kinachotambulika yaliachwa nje badala ya kubahatisha sehemu yake." : "Unlabelled OCR text was left out rather than guessed into a job section.");
  return { fields, notes };
}

const englishWords = new Set(["the", "and", "or", "to", "for", "with", "of", "in", "on", "by", "experience", "apply", "qualifications", "responsibilities", "job", "position", "will", "should", "who", "have", "required", "minimum", "degree", "certificate", "must", "from", "your", "are", "be", "is", "at", "as", "manager", "officer", "assistant", "analyst", "engineer", "accountant", "director", "marketing", "finance", "sales", "coordinator", "supervisor", "specialist", "technician", "administrator", "executive", "teacher", "nurse"]);
const swahiliWords = new Set(["nafasi", "kazi", "majukumu", "sifa", "elimu", "uzoefu", "kutuma", "maombi", "husika", "mwisho", "tarehe", "wanaotakiwa", "anahitajika", "cheti", "shahada", "katika", "kwa", "wa", "ya", "na", "ni", "kutoka", "hutakiwa", "mgombea", "taasisi", "kampuni", "kuomba", "mshahara", "masharti", "wajibu", "mwenye", "ambaye", "pamoja", "meneja", "afisa", "mhasibu", "mwalimu", "mhandisi", "mkurugenzi", "mratibu", "msaidizi", "mshauri", "masoko", "mauzo", "fedha", "rasilimali", "binadamu", "mtaalamu", "daktari", "muuguzi", "teknolojia", "mawasiliano", "kilimo", "usimamizi", "mradi", "mipango"]);

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

export function planFieldTranslations(fields: JobAdFields, target: "en" | "sw") {
  const translate: Array<{ key: TranslatableKey; source: "en" | "sw"; text: string; lineIndex?: number }> = [];
  const uncertain: TranslatableKey[] = [];
  for (const key of translatableFields) {
    const value = fields[key].trim();
    if (!value) continue;
    const lines = value.split(/\r?\n/);
    const directions = new Set(lines.map(detectTranslationSource).filter((source): source is "en" | "sw" => source !== null));
    const mixedLanguages = directions.has(target) && [...directions].some(source => source !== target);
    if (mixedLanguages) {
      lines.forEach((text, lineIndex) => {
        if (!text.trim()) return;
        const source = detectTranslationSource(text);
        if (source === target) return;
        if (source) translate.push({ key, source, text, lineIndex });
        else uncertain.push(key);
      });
      continue;
    }
    const source = detectTranslationSource(value);
    if (!source) uncertain.push(key);
    else if (source !== target) translate.push({ key, source, text: value });
  }
  return { translate, uncertain: [...new Set(uncertain)] };
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
  const target = outputLanguage === "English" ? "en" : "sw";
  const plan = planFieldTranslations(fields, target);
  if (plan.uncertain.length) notes.push(outputLanguage === "Kiswahili"
    ? "Baadhi ya sehemu fupi hazikutafsiriwa kwa sababu lugha yake haikutambuliwa kwa uhakika; hakiki kwa mkono."
    : "Some short fields were left untranslated because their source language was uncertain; review them manually.");
  for (const source of ["en", "sw"] as const) {
    const entries = plan.translate.filter(item => item.source === source);
    if (!entries.length) continue;
    const translated = await translateOffline(source, target, entries.map(({ text }) => text));
    entries.forEach(({ key }, index) => {
      const result = translated[index].trim();
      if (result) {
        const lineIndex = entries[index].lineIndex;
        if (lineIndex === undefined) fields[key] = result.slice(0, limits[key]);
        else {
          const lines = fields[key].split(/\r?\n/);
          if (lineIndex < lines.length) lines[lineIndex] = result;
          fields[key] = lines.join("\n").slice(0, limits[key]);
        }
      }
      else notes.push(outputLanguage === "Kiswahili" ? "Tafsiri ya sehemu moja haikutolewa; maandishi ya chanzo yamehifadhiwa." : "A field translation was empty; its original source text was kept.");
    });
  }
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

export type OcrResult = { text: string; meanConfidence: number; wordCount: number; droppedWordCount: number };

export function parseTesseractTsv(tsv: string, minimumConfidence = 25): OcrResult {
  const lines = new Map<string, { words: string[]; confidence: number[] }>();
  let droppedWordCount = 0;
  for (const row of tsv.split(/\r?\n/).slice(1)) {
    const columns = row.split("\t");
    if (columns[0] !== "5" || columns.length < 12) continue;
    const word = columns.slice(11).join("\t").trim();
    if (!word) continue;
    if (!/[A-Za-z0-9]/.test(word)) continue;
    const confidence = Number(columns[10]);
    if (!Number.isFinite(confidence) || confidence < minimumConfidence) { droppedWordCount++; continue; }
    const lineKey = columns.slice(1, 5).join(":");
    const line = lines.get(lineKey) ?? { words: [], confidence: [] };
    line.words.push(word);
    line.confidence.push(confidence);
    lines.set(lineKey, line);
  }
  const outputLines = [...lines.values()];
  const confidences = outputLines.flatMap(line => line.confidence);
  const wordCount = confidences.length;
  return {
    text: outputLines.map(line => line.words.join(" ")).join("\n").trim().slice(0, MAX_JOB_AD_TEXT),
    meanConfidence: wordCount ? confidences.reduce((total, value) => total + value, 0) / wordCount : 0,
    wordCount,
    droppedWordCount,
  };
}

function scoreOcrResult(result: OcrResult): number {
  const sectionMatches = result.text.match(/\b(?:job|position|vacancy|responsibilit\w*|duties|qualifications?|requirements?|majukumu|sifa|vigezo)\b/gi)?.length ?? 0;
  return result.meanConfidence * 0.5 + Math.min(result.wordCount, 100) * 0.35 + Math.min(sectionMatches, 8) * 5;
}

async function runTesseract(imagePath: string, pageSegmentationMode = 6): Promise<OcrResult> {
  const tsv = await runCommand("tesseract", [imagePath, "stdout", "-l", "eng+swa", "--psm", String(pageSegmentationMode), "-c", "preserve_interword_spaces=1", "tsv"], 60_000, 2_000_000);
  return parseTesseractTsv(tsv);
}

function needsOcrReview(result: OcrResult): boolean {
  return result.wordCount < 8 || result.meanConfidence < 48 || result.droppedWordCount > Math.max(4, result.wordCount * 0.12);
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

async function ocrPdf(bytes: Buffer, pageCount: number): Promise<{ text: string; lowConfidence: boolean }> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "getmchongo-ad-"));
  try {
    const pdfPath = path.join(directory, "source.pdf");
    const prefix = path.join(directory, "page");
    await writeFile(pdfPath, bytes);
    await runCommand("pdftoppm", ["-f", "1", "-l", String(Math.min(pageCount, MAX_PDF_OCR_PAGES)), "-r", "150", "-jpeg", "-jpegopt", "quality=82", pdfPath, prefix], 60_000);
    const imageNames = (await readdir(directory)).filter(name => /^page-\d+\.jpg$/i.test(name)).sort((a, b) => Number(a.match(/(\d+)\.jpg$/i)?.[1] ?? 0) - Number(b.match(/(\d+)\.jpg$/i)?.[1] ?? 0));
    if (!imageNames.length) throw new Error("This PDF could not be rendered for OCR. Try a clearer PDF or upload a photo of the advert.");
    const pages: string[] = [];
    let lowConfidence = false;
    for (const name of imageNames) {
      const result = await runTesseract(path.join(directory, name));
      if (result.text) pages.push(result.text);
      lowConfidence ||= needsOcrReview(result);
      if (pages.join("\n\n").length >= MAX_JOB_AD_TEXT) break;
    }
    return { text: pages.join("\n\n").slice(0, MAX_JOB_AD_TEXT), lowConfidence };
  } finally { await rm(directory, { recursive: true, force: true }); }
}

async function extractDocumentText(document: { mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp"; bytes: Buffer }): Promise<{ text: string; notes: string[] }> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "getmchongo-ad-"));
  try {
    if (document.mimeType === "application/pdf") {
      const pdf = await extractPdf(document.bytes);
      let text = pdf.text;
      const notes = pdf.pageCount > MAX_PDF_OCR_PAGES ? [`Only the first ${MAX_PDF_OCR_PAGES} pages of this ${pdf.pageCount}-page PDF were processed.`] : [];
      if (text.length < 300) {
        const recognized = await ocrPdf(document.bytes, pdf.pageCount);
        if (recognized.text.length > text.length) {
          text = recognized.text;
          if (recognized.lowConfidence) notes.push("Some low-confidence scanned text was ignored; verify the extracted details against the original PDF.");
        }
      }
      if (!text.trim()) throw new Error("No readable text was found. Try a clearer photo or PDF, or paste the advertisement text.");
      return { text: text.slice(0, MAX_JOB_AD_TEXT), notes };
    }
    const imagePath = path.join(directory, "source.png");
    const preparedImage = await sharp(document.bytes, { limitInputPixels: 50_000_000 })
      .rotate().flatten({ background: "#ffffff" }).greyscale().normalize()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).png().toBuffer();
    await writeFile(imagePath, preparedImage);
    const firstPass = await runTesseract(imagePath, 6);
    const secondPass = await runTesseract(imagePath, 4);
    const result = scoreOcrResult(secondPass) > scoreOcrResult(firstPass) ? secondPass : firstPass;
    if (!result.text.trim()) throw new Error("The photo text could not be read confidently. Try a clearer, upright image or paste the advert text.");
    const notes = needsOcrReview(result) ? ["Some low-confidence photo text was ignored; verify the job title, duties and requirements against the original image."] : [];
    return { text: result.text, notes };
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
  const parsed = parseAdText(sourceText, options.outputLanguage);
  extractionNotes.push(...parsed.notes);
  await translateFields(parsed.fields, options.outputLanguage, extractionNotes);
  parsed.fields.responsibilities = bulletize(parsed.fields.responsibilities);
  parsed.fields.qualifications = bulletize(parsed.fields.qualifications);
  const normalized = normalizeStructuredJobAd(parsed.fields, options.outputLanguage);
  return {
    fields: normalized.fields,
    reviewNotes: [...new Set([countNote(options.outputLanguage), ...extractionNotes, ...normalized.reviewNotes])].slice(0, 10),
  };
}
