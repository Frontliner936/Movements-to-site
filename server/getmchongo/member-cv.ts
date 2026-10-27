import { basename, extname } from "node:path";
import { Worker } from "node:worker_threads";
import { OfficeParser } from "officeparser";

export const MAX_CV_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_CV_TEXT_LENGTH = 30_000;
const ALLOWED_MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".rtf": "application/rtf",
};
const ARCHIVE_LIMITS = {
  maxUncompressedBytes: 16 * 1024 * 1024,
  maxZipEntries: 500,
  maxTableCells: 10_000,
  maxXmlElements: 50_000,
  maxRepeatedContent: 2 * 1024 * 1024,
  maxRawContentLength: 2 * 1024 * 1024,
};

export class InvalidCvUploadError extends Error {
  constructor(message: string) { super(message); this.name = "InvalidCvUploadError"; }
}

const WORD_DOC_WORKER = `
  const { parentPort, workerData } = require("node:worker_threads");
  const WordExtractor = require("word-extractor");
  (async () => {
    try {
      const document = await new WordExtractor().extract(Buffer.from(workerData));
      parentPort.postMessage({ ok: true, text: document.getBody() });
    } catch {
      parentPort.postMessage({ ok: false });
    }
  })();
`;

function extractLegacyDocInWorker(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(WORD_DOC_WORKER, {
        eval: true,
        workerData: Uint8Array.from(buffer),
        resourceLimits: { maxOldGenerationSizeMb: 64, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 },
      });
    } catch {
      reject(new InvalidCvUploadError("That Word DOC file could not be read."));
      return;
    }
    let settled = false;
    const finish = (error?: Error, text?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      void worker.terminate();
      if (error) reject(error);
      else resolve(text ?? "");
    };
    const timeout = setTimeout(() => finish(new InvalidCvUploadError("Word DOC parsing took too long. Try saving the CV as PDF or DOCX.")), 8_000);
    worker.once("message", (result: { ok?: boolean; text?: unknown }) => {
      if (result?.ok && typeof result.text === "string") finish(undefined, result.text);
      else finish(new InvalidCvUploadError("That Word DOC file could not be read."));
    });
    worker.once("error", () => finish(new InvalidCvUploadError("That Word DOC file could not be read.")));
    worker.once("messageerror", () => finish(new InvalidCvUploadError("That Word DOC file could not be read.")));
    worker.once("exit", () => { if (!settled) finish(new InvalidCvUploadError("That Word DOC file could not be read.")); });
  });
}

function safeFileName(fileName: string) {
  const leaf = basename(fileName.replace(/\\/g, "/"));
  const clean = leaf.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 255);
  return clean || "cv";
}

function hasPrefix(buffer: Buffer, expected: number[]) {
  return buffer.length >= expected.length && expected.every((byte, index) => buffer[index] === byte);
}

export function inspectCvUpload(fileName: string, buffer: Buffer) {
  const cleanName = safeFileName(fileName);
  const extension = extname(cleanName).toLowerCase();
  const mimeType = ALLOWED_MIME_TYPES[extension];
  if (!mimeType) throw new InvalidCvUploadError("Upload a PDF, DOC, DOCX, TXT or RTF CV file.");
  if (!buffer.length) throw new InvalidCvUploadError("The selected CV file is empty.");
  if (buffer.length > MAX_CV_FILE_BYTES) throw new InvalidCvUploadError("CV files must be 5 MB or smaller.");

  if (extension === ".pdf" && !buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"))) {
    throw new InvalidCvUploadError("That file does not appear to be a valid PDF.");
  }
  if (extension === ".doc" && !hasPrefix(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    throw new InvalidCvUploadError("That file does not appear to be a valid Word DOC file.");
  }
  if (extension === ".docx" && !hasPrefix(buffer, [0x50, 0x4b, 0x03, 0x04])) {
    throw new InvalidCvUploadError("That file does not appear to be a valid Word DOCX file.");
  }
  if (extension === ".rtf" && !/^\s*\{\\rtf/i.test(buffer.toString("latin1", 0, 32))) {
    throw new InvalidCvUploadError("That file does not appear to be a valid RTF document.");
  }
  if (extension === ".txt") {
    if (buffer.includes(0)) throw new InvalidCvUploadError("Text CV files must be plain UTF-8 text.");
    try { new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
    catch { throw new InvalidCvUploadError("Text CV files must be plain UTF-8 text."); }
  }

  return { fileName: cleanName, extension, mimeType };
}

export function decodeCvBase64(encoded: unknown) {
  if (typeof encoded !== "string" || !encoded.length || encoded.length > 7_100_000 || encoded.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new InvalidCvUploadError("The CV upload could not be read. Choose the file again and retry.");
  }
  const buffer = Buffer.from(encoded, "base64");
  if (buffer.toString("base64") !== encoded) throw new InvalidCvUploadError("The CV upload could not be read. Choose the file again and retry.");
  return buffer;
}

export async function extractCvText(fileName: string, buffer: Buffer) {
  const { extension } = inspectCvUpload(fileName, buffer);
  let text: string;
  if (extension === ".txt") {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } else if (extension === ".doc") {
    text = await extractLegacyDocInWorker(buffer);
  } else {
    const ast = await OfficeParser.parseOffice(new Uint8Array(buffer), {
      abortSignal: AbortSignal.timeout(10_000),
      decompressionLimits: ARCHIVE_LIMITS,
      extractAttachments: false,
      includeRawContent: false,
      ocr: false,
    });
    text = (await ast.to("text")).value;
  }
  const normalized = text.replace(/\u0000/g, " ").replace(/\r\n?/g, "\n").trim();
  if (normalized.length < 100) throw new InvalidCvUploadError("The CV file did not contain enough readable text. Try a text-based PDF, Word file, TXT or RTF document.");
  return normalized.slice(0, MAX_CV_TEXT_LENGTH);
}
