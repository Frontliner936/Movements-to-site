import { describe, expect, it } from "vitest";
import { detectTranslationSource, normalizeStructuredJobAd, safeExtractedHttpUrl, structureJobAd } from "./job-ad-structurer";

describe("job-ad extraction normalization", () => {
  it("keeps only safe HTTP(S) URLs and rejects credentials or script schemes", () => {
    expect(safeExtractedHttpUrl("https://example.org/apply")).toBe("https://example.org/apply");
    expect(safeExtractedHttpUrl("javascript:alert(1)")).toBe("");
    expect(safeExtractedHttpUrl("https://user:pass@example.org/")).toBe("");
    expect(safeExtractedHttpUrl(`https://example.org/${"a".repeat(2050)}`)).toBe("");
  });

  it("leaves missing source facts blank and creates useful review notes", () => {
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

  it("extracts labeled fields, keeps source facts, and formats duties and requirements as bullets without OpenAI", async () => {
    const result = await structureJobAd({
      outputLanguage: "source",
      sourceText: [
        "Job Title: Field Officer",
        "Company: Example Foundation",
        "Location: Arusha",
        "Deadline: 30 November 2026",
        "",
        "Job Description:",
        "Support community health programs and coordinate with local partners.",
        "",
        "Responsibilities:",
        "- Visit project sites each week",
        "- Prepare monthly reports",
        "",
        "Qualifications:",
        "• Bachelor's degree in public health",
        "• Three years of relevant experience",
        "",
        "How to Apply:",
        "Send your CV to jobs@example.org or call +255 712 345 678.",
        "Application link: https://example.org/apply",
      ].join("\n"),
    });

    expect(result.fields.title).toBe("Field Officer");
    expect(result.fields.companyName).toBe("Example Foundation");
    expect(result.fields.location).toBe("Arusha");
    expect(result.fields.deadline).toBe("30 November 2026");
    expect(result.fields.description).toContain("Support community health programs");
    expect(result.fields.responsibilities.split("\n")).toEqual(["• Visit project sites each week", "• Prepare monthly reports"]);
    expect(result.fields.qualifications.split("\n")).toEqual(["• Bachelor's degree in public health", "• Three years of relevant experience"]);
    expect(result.fields.howToApply).toContain("jobs@example.org");
    expect(result.fields.howToApply).toContain("+255 712 345 678");
    expect(result.fields.applicationUrl).toBe("https://example.org/apply");
    expect(result.reviewNotes.some(note => note.includes("without OpenAI"))).toBe(true);
  });

  it("detects supported source-language direction conservatively", () => {
    expect(detectTranslationSource("The job requires three years of experience and applicants should apply for the position." )).toBe("en");
    expect(detectTranslationSource("Nafasi ya kazi inahitaji uzoefu na sifa za elimu katika taasisi." )).toBe("sw");
    expect(detectTranslationSource("Field Officer" )).toBeNull();
  });
});
