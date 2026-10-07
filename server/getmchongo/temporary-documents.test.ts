import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_ACTIVE_DOCUMENTS,
  TEMP_DOCUMENT_TTL_MS,
  TemporaryDocumentCapacityError,
  getTemporaryDocument,
  removeTemporaryDocument,
  storeTemporaryDocument,
} from "./temporary-documents";

afterEach(() => vi.useRealTimers());

describe("temporary source-document storage", () => {
  it("rejects new work at capacity without evicting active model fetches", () => {
    const tokens: string[] = [];
    try {
      for (let index = 0; index < MAX_ACTIVE_DOCUMENTS; index++) {
        tokens.push(storeTemporaryDocument(Buffer.from(`source-${index}`), "application/pdf"));
      }
      expect(() => storeTemporaryDocument(Buffer.from("overflow"), "application/pdf")).toThrow(TemporaryDocumentCapacityError);
      for (const token of tokens) expect(getTemporaryDocument(token)).not.toBeNull();
    } finally {
      for (const token of tokens) removeTemporaryDocument(token);
    }
  });

  it("zeroes and removes source bytes automatically when the expiry timer fires", async () => {
    vi.useFakeTimers();
    const bytes = Buffer.from("temporary confidential source");
    const token = storeTemporaryDocument(bytes, "application/pdf");
    try {
      await vi.advanceTimersByTimeAsync(TEMP_DOCUMENT_TTL_MS);
      expect(bytes.equals(Buffer.alloc(bytes.length))).toBe(true);
      expect(getTemporaryDocument(token)).toBeNull();
    } finally {
      removeTemporaryDocument(token);
      vi.useRealTimers();
    }
  });
});
