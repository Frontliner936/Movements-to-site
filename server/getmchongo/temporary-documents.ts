import { randomBytes } from "node:crypto";

export const TEMP_DOCUMENT_TTL_MS = 10 * 60 * 1000;
export const MAX_ACTIVE_DOCUMENTS = 8;
type TemporaryDocument = {
  buffer: Buffer;
  mimeType: "application/pdf" | "image/jpeg";
  expiresAt: number;
  expiryTimer: NodeJS.Timeout;
};
const documents = new Map<string, TemporaryDocument>();

export class TemporaryDocumentCapacityError extends Error {
  constructor() {
    super("The document importer is at capacity. Try again shortly.");
    this.name = "TemporaryDocumentCapacityError";
  }
}

function discard(token: string) {
  const document = documents.get(token);
  if (!document) return;
  clearTimeout(document.expiryTimer);
  document.buffer.fill(0);
  documents.delete(token);
}

function pruneExpired() {
  const now = Date.now();
  for (const [token, document] of documents) if (document.expiresAt <= now) discard(token);
}

export function storeTemporaryDocument(buffer: Buffer, mimeType: TemporaryDocument["mimeType"]): string {
  pruneExpired();
  if (documents.size >= MAX_ACTIVE_DOCUMENTS) throw new TemporaryDocumentCapacityError();
  const token = randomBytes(32).toString("hex");
  const document: TemporaryDocument = {
    buffer,
    mimeType,
    expiresAt: Date.now() + TEMP_DOCUMENT_TTL_MS,
    expiryTimer: setTimeout(() => discard(token), TEMP_DOCUMENT_TTL_MS),
  };
  document.expiryTimer.unref();
  documents.set(token, document);
  return token;
}

export function getTemporaryDocument(token: string): Pick<TemporaryDocument, "buffer" | "mimeType"> | null {
  pruneExpired();
  const document = documents.get(token);
  return document ? { buffer: document.buffer, mimeType: document.mimeType } : null;
}

export function removeTemporaryDocument(token: string) {
  discard(token);
}
