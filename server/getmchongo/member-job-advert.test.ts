import { describe, expect, it } from "vitest";
import { inspectJobAdvertUpload, InvalidJobAdvertError } from "./member-job-advert";

const samples: Array<[string, Buffer]> = [
  ["role.pdf", Buffer.from("%PDF-1.7\nexample")],
  ["role.doc", Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00])],
  ["role.docx", Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00])],
  ["role.txt", Buffer.from("A readable job advert in UTF-8.", "utf8")],
  ["role.rtf", Buffer.from("{\\rtf1 A readable job advert}", "latin1")],
  ["role.jpg", Buffer.from([0xff, 0xd8, 0xff, 0x00])],
  ["role.jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00])],
  ["role.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])],
  ["role.webp", Buffer.from("RIFF0000WEBP", "ascii")],
];

describe("member job-advert upload validation", () => {
  it.each(samples)("accepts supported format %s when its signature matches", (name, bytes) => {
    const result = inspectJobAdvertUpload(name, bytes);
    expect(result.fileName).toBe(name);
    expect(result.mimeType).toBeTruthy();
  });

  it("rejects unsupported files and mismatched content", () => {
    expect(() => inspectJobAdvertUpload("role.xlsx", Buffer.from("data"))).toThrow(InvalidJobAdvertError);
    expect(() => inspectJobAdvertUpload("role.pdf", Buffer.from("not a pdf"))).toThrow(/does not match/i);
    expect(() => inspectJobAdvertUpload("role.png", Buffer.from("not a png"))).toThrow(/does not match/i);
  });

  it("rejects empty, oversized and non-UTF-8 plain text files", () => {
    expect(() => inspectJobAdvertUpload("role.txt", Buffer.alloc(0))).toThrow(/empty/i);
    expect(() => inspectJobAdvertUpload("role.txt", Buffer.alloc(5 * 1024 * 1024 + 1, 0x61))).toThrow(/5 MB/i);
    expect(() => inspectJobAdvertUpload("role.txt", Buffer.from([0xff, 0xfe]))).toThrow(/content does not match/i);
  });
});
