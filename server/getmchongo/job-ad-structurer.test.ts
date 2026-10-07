import { describe, expect, it } from "vitest";
import { normalizeStructuredJobAd, safeExtractedHttpUrl } from "./job-ad-structurer";

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
});
