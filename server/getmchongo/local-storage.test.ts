import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isLocalKey, readLocalFile, saveLocalFile } from "./local-storage";

const key = "get-mchongo/uploads/123e4567-e89b-12d3-a456-426614174000.pdf";
let dir: string;
beforeAll(async () => { dir = await mkdtemp(path.join(tmpdir(), "gm-up-")); process.env.UPLOAD_DIR = dir; });
afterAll(async () => { delete process.env.UPLOAD_DIR; await rm(dir, { recursive: true, force: true }); });

describe("local file storage", () => {
  it("saves and reads back a file with its content type", async () => {
    await saveLocalFile(key, Buffer.from("%PDF-1.4 test"));
    const file = await readLocalFile(key);
    expect(file?.contentType).toBe("application/pdf");
    expect(file?.bytes.toString()).toBe("%PDF-1.4 test");
  });
  it("rejects keys outside the upload pattern, including path traversal", async () => {
    for (const bad of ["../etc/passwd", "get-mchongo/uploads/../../x.pdf", "get-mchongo/uploads/abc.pdf", "async-images/a/image-1.webp"]) {
      expect(isLocalKey(bad)).toBe(false);
      expect(await readLocalFile(bad)).toBeNull();
      await expect(saveLocalFile(bad, Buffer.from("x"))).rejects.toThrow();
    }
  });
  it("returns null for a missing file", async () => {
    expect(await readLocalFile("get-mchongo/uploads/123e4567-e89b-12d3-a456-426614174999.png")).toBeNull();
  });
});
