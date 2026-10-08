import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeStructuredJobAd, safeExtractedHttpUrl, structureJobAd } from "./job-ad-structurer";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("job-ad extraction normalization", () => {
  it("keeps only safe HTTP(S) URLs and rejects credentials or script schemes", () => {
    expect(safeExtractedHttpUrl("https://example.org/apply")).toBe("https://example.org/apply");
    expect(safeExtractedHttpUrl("javascript:alert(1)")).toBe("");
    expect(safeExtractedHttpUrl("https://user:pass@example.org/" )).toBe("");
    expect(safeExtractedHttpUrl(`https://example.org/${"a".repeat(2050)}`)).toBe("");
  });

  it("leaves missing source facts blank, clips field lengths, and creates useful review notes", () => {
    const result = normalizeStructuredJobAd({
      title: "  Data Officer  ", companyName: "Example Institute", location: "Dar es Salaam",
      applicationUrl: "javascript:alert(1)", description: "Confirmed duties only", reviewNotes: ["Check the closing date."],
    });
    expect(result.fields.title).toBe("Data Officer");
    expect(result.fields.location).toBe("Dar es Salaam");
    expect(result.fields.deadline).toBe("");
    expect(result.fields.applicationUrl).toBe("");
    expect(result.fields.companyLogoUrl).toBe("");
    expect(result.reviewNotes).toContain("Check the closing date.");
    expect(result.reviewNotes).toContain("No application link or instructions were found.");
    expect(result.reviewNotes).toContain("One or more extracted URLs were not valid public HTTP(S) links and were removed.");
  });

  it("uploads selected image bytes and attaches the uploaded file to the Manus task", async () => {
    vi.stubEnv("MANUS_API_KEY", "test-key");
    const uploadedBodies: Array<BodyInit | null | undefined> = [];
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, init });
      if (url === "https://upload.test/file") {
        uploadedBodies.push(init?.body);
        return new Response(null, { status: 200 });
      }
      const payload = url.includes("/v2/file.upload")
        ? { file: { id: "file-123" }, upload_url: "https://upload.test/file" }
        : url.includes("/v2/file.detail")
          ? { file: { status: "uploaded" } }
          : url.includes("/v2/task.create")
            ? { task_id: "task-123" }
            : { messages: [{ type: "structured_output_result", structured_output_result: { success: true, value: {} } }] };
      return new Response(JSON.stringify(payload), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await structureJobAd({
      sourceText: "",
      outputLanguage: "source",
      document: { mimeType: "image/jpeg", url: "", bytes: Buffer.from([1, 2, 3]), filename: "ad.jpg" },
    });

    expect(uploadedBodies[0]).toEqual(new Uint8Array([1, 2, 3]));
    const taskRequest = requests.find(request => request.url.includes("/v2/task.create"));
    expect(JSON.parse(String(taskRequest?.init?.body)).message.content).toContainEqual({ type: "file", file_id: "file-123", visibility: "visible" });
  });
});
