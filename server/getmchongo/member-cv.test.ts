import { describe, expect, it } from "vitest";
import { decodeCvBase64, extractCvText, inspectCvUpload, InvalidCvUploadError, MAX_CV_FILE_BYTES } from "./member-cv";

const cvText = `Professional Summary: Tanzanian operations professional with experience in project coordination, data analysis and customer service. Skills include Microsoft Excel, communication, planning and teamwork. Experience: operations assistant from 2020 to 2024. Education: Bachelor degree in business administration. Contact details are available on request.`;

describe("CV upload validation", () => {
  it("accepts plain UTF-8 text within the file-size limit", () => {
    const bytes = Buffer.from(cvText, "utf8");
    expect(inspectCvUpload("candidate.txt", bytes)).toMatchObject({ extension: ".txt", mimeType: "text/plain" });
  });

  it("accepts the supported document extensions only when their signatures match", () => {
    expect(inspectCvUpload("resume.PDF", Buffer.from("%PDF-1.7\nbody"))).toMatchObject({ extension: ".pdf", mimeType: "application/pdf" });
    expect(inspectCvUpload("resume.doc", Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00]))).toMatchObject({ extension: ".doc" });
    expect(inspectCvUpload("resume.docx", Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]))).toMatchObject({ extension: ".docx" });
    expect(inspectCvUpload("resume.rtf", Buffer.from("{\\rtf1\\ansi body}"))).toMatchObject({ extension: ".rtf" });
    expect(() => inspectCvUpload("resume.exe", Buffer.from("not a CV"))).toThrow(InvalidCvUploadError);
    expect(() => inspectCvUpload("resume.pdf", Buffer.from("not a PDF"))).toThrow(/valid PDF/);
  });

  it("rejects empty and oversized files", () => {
    expect(() => inspectCvUpload("empty.txt", Buffer.alloc(0))).toThrow(/empty/);
    expect(() => inspectCvUpload("large.txt", Buffer.alloc(MAX_CV_FILE_BYTES + 1))).toThrow(/5 MB/);
  });

  it("decodes only valid canonical base64", () => {
    expect(decodeCvBase64(Buffer.from("safe CV text").toString("base64")).toString("utf8")).toBe("safe CV text");
    expect(() => decodeCvBase64("%%%bad%%%")).toThrow(/could not be read/);
  });

  it("extracts text CV content for matching without retaining the file", async () => {
    const extracted = await extractCvText("candidate.txt", Buffer.from(cvText, "utf8"));
    expect(extracted).toContain("operations professional");
    expect(extracted.length).toBeGreaterThanOrEqual(100);
    expect(extracted.length).toBeLessThanOrEqual(30_000);
  });

  it("extracts readable RTF text", async () => {
    const rtf = Buffer.from(`{\\rtf1\\ansi ${cvText.replace(/&/g, "and")}}`, "latin1");
    const extracted = await extractCvText("candidate.rtf", rtf);
    expect(extracted).toContain("operations professional");
  });

  it("rejects malformed legacy DOCs through the bounded worker parser", async () => {
    const malformedDoc = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00]);
    await expect(extractCvText("candidate.doc", malformedDoc)).rejects.toThrow(/Word DOC file could not be read|readable text/);
  });
});
