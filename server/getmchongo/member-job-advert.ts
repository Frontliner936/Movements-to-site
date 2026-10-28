import { basename, extname } from "node:path";
import { extractCvText } from "./member-cv";
import { extractJobAdDocumentText, MAX_JOB_AD_FILE_BYTES } from "./job-ad-structurer";

const MIME_BY_EXTENSION = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".rtf": "application/rtf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
} as const;

export class InvalidJobAdvertError extends Error {
  constructor(message: string) { super(message); this.name = "InvalidJobAdvertError"; }
}

function safeName(input: string) {
  const leaf = basename(input.replace(/\\/g, "/"));
  return leaf.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 255) || "advert";
}

function startsWith(bytes: Buffer, signature: number[]) {
  return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
}

export function inspectJobAdvertUpload(fileName: string, bytes: Buffer) {
  const cleanName = safeName(fileName);
  const extension = extname(cleanName).toLowerCase() as keyof typeof MIME_BY_EXTENSION;
  const mimeType = MIME_BY_EXTENSION[extension];
  if (!mimeType) throw new InvalidJobAdvertError("Upload a PDF, DOC, DOCX, TXT, RTF, JPEG, PNG or WebP job advert.");
  if (!bytes.length) throw new InvalidJobAdvertError("The selected job-advert file is empty.");
  if (bytes.length > MAX_JOB_AD_FILE_BYTES) throw new InvalidJobAdvertError("Job-advert files must be 5 MB or smaller.");

  const valid = extension === ".pdf"
    ? bytes.subarray(0, 1024).includes(Buffer.from("%PDF-"))
    : extension === ".doc"
      ? startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
      : extension === ".docx"
        ? startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])
        : extension === ".txt"
          ? !bytes.includes(0) && isUtf8(bytes)
          : extension === ".rtf"
            ? /^\s*\{\\rtf/i.test(bytes.toString("latin1", 0, 32))
            : extension === ".jpg" || extension === ".jpeg"
              ? startsWith(bytes, [0xff, 0xd8, 0xff])
              : extension === ".png"
                ? startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
                : extension === ".webp"
                  ? bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP"
                  : false;
  if (!valid) throw new InvalidJobAdvertError("The job-advert file content does not match its file type.");
  return { fileName: cleanName, extension, mimeType };
}

function isUtf8(bytes: Buffer) {
  try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); return true; }
  catch { return false; }
}

export async function extractJobAdvertText(fileName: string, bytes: Buffer) {
  const validated = inspectJobAdvertUpload(fileName, bytes);
  if (["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(validated.mimeType)) {
    try {
      return await extractJobAdDocumentText({
        mimeType: validated.mimeType as "application/pdf" | "image/jpeg" | "image/png" | "image/webp",
        bytes,
      });
    } catch {
      throw new InvalidJobAdvertError("The job advert could not be read. Try a text-based PDF or a clear, upright photo.");
    }
  }
  try {
    const text = await extractCvText(validated.fileName, bytes);
    return { text, notes: [] as string[] };
  } catch {
    throw new InvalidJobAdvertError("The job advert could not be read. Try an editable Word, TXT, RTF or text-based PDF file.");
  }
}
