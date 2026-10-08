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

  it("sends selected photo bytes as vision input using an OpenAI-compatible endpoint", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_API_BASE", "https://api.openai.com/v1");
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(input), init });
      return new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await structureJobAd({
      sourceText: "",
      outputLanguage: "source",
      document: { mimeType: "image/jpeg", bytes: Buffer.from([1, 2, 3]), filename: "ad.jpg" },
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://api.openai.com/v1/chat/completions");
    const payload = JSON.parse(String(requests[0].init?.body));
    expect(payload.model).toBe("gpt-4o-mini");
    expect(payload.messages[1].content).toContainEqual({ type: "image_url", image_url: { url: "data:image/jpeg;base64,AQID", detail: "high" } });
    expect(requests[0].init?.headers).toMatchObject({ authorization: "Bearer test-key" });
  });
});
