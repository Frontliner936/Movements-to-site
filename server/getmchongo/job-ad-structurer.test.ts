import { describe, expect, it } from "vitest";
import { detectTranslationSource, normalizeStructuredJobAd, parseTesseractTsv, planFieldTranslations, safeExtractedHttpUrl, structureJobAd } from "./job-ad-structurer";

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
        "Description:",
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

  it("keeps poster benefits and decorative headings out of responsibilities and qualifications", async () => {
    const result = await structureJobAd({
      outputLanguage: "source",
      sourceText: [
        "JOB VACANCY", "MARKETING OFFICER", "Company: Example Foundation", "",
        "Responsibilities:", "• ¢ Plan campaigns", "• Prepare weekly reports", "BENEFITS", "Medical cover provided", "",
        "Qualifications and Requirements:", "• Diploma in marketing", "• Three years of relevant experience", "Equal Opportunity Employer",
      ].join("\n"),
    });
    expect(result.fields.title).toBe("MARKETING OFFICER");
    expect(result.fields.responsibilities).toBe("• Plan campaigns\n• Prepare weekly reports");
    expect(result.fields.qualifications).toBe("• Diploma in marketing\n• Three years of relevant experience");
    expect(result.fields.responsibilities).not.toContain("Medical cover");
    expect(result.fields.description).toBe("");
  });

  it("reads label-only headings and picks up a deadline stated in a sentence", async () => {
    const result = await structureJobAd({
      outputLanguage: "source",
      sourceText: [
        "JOB VACANCY", "Position", "Community Health Officer", "Company", "Example Foundation", "Location", "Mwanza",
        "Applications must be submitted by 30 November 2026.", "Responsibilities and Duties", "Coordinate community visits", "Prepare monthly reports",
        "Qualifications and Experience Required", "Bachelor's degree in public health", "At least three years of relevant experience",
      ].join("\n"),
    });
    expect(result.fields.title).toBe("Community Health Officer");
    expect(result.fields.companyName).toBe("Example Foundation");
    expect(result.fields.location).toBe("Mwanza");
    expect(result.fields.deadline).toBe("30 November 2026");
    expect(result.fields.responsibilities.split("\n")).toEqual(["• Coordinate community visits", "• Prepare monthly reports"]);
    expect(result.fields.qualifications.split("\n")).toEqual(["• Bachelor's degree in public health", "• At least three years of relevant experience"]);
  });

  it("splits compact pasted text containing multiple inline field labels", async () => {
    const result = await structureJobAd({
      outputLanguage: "source",
      sourceText: "VACANCY | JOB TITLE: Finance Officer | COMPANY: Lake Zone Initiative | LOCATION: Mwanza | APPLICATION DEADLINE: 15 Dec 2026 | RESPONSIBILITIES: Prepare monthly reports; Reconcile accounts | QUALIFICATIONS & REQUIREMENTS: Bachelor's degree in accounting; Three years of experience",
    });
    expect(result.fields.title).toBe("Finance Officer");
    expect(result.fields.companyName).toBe("Lake Zone Initiative");
    expect(result.fields.location).toBe("Mwanza");
    expect(result.fields.deadline).toBe("15 Dec 2026");
    expect(result.fields.responsibilities.split("\n")).toEqual(["• Prepare monthly reports", "• Reconcile accounts"]);
    expect(result.fields.qualifications.split("\n")).toEqual(["• Bachelor's degree in accounting", "• Three years of experience"]);
  });

  it("separates unmistakable responsibilities and qualifications when pasted without section headings", async () => {
    const result = await structureJobAd({
      outputLanguage: "source",
      sourceText: [
        "MARKETING OFFICER", "- Coordinate outreach campaigns", "- Prepare weekly performance reports",
        "- Bachelor's degree in marketing", "- At least three years of relevant experience", "Applications close on 20 October 2026.",
      ].join("\n"),
    });
    expect(result.fields.title).toBe("MARKETING OFFICER");
    expect(result.fields.deadline).toBe("20 October 2026");
    expect(result.fields.responsibilities.split("\n")).toEqual(["• Coordinate outreach campaigns", "• Prepare weekly performance reports"]);
    expect(result.fields.qualifications.split("\n")).toEqual(["• Bachelor's degree in marketing", "• At least three years of relevant experience"]);
  });

  it("drops very low-confidence OCR words while retaining readable lines", () => {
    const header = "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext";
    const word = (line: number, index: number, confidence: number, text: string) => ["5", "1", "1", "1", String(line), String(index), "0", "0", "10", "10", String(confidence), text].join("\t");
    const result = parseTesseractTsv([header, word(1, 1, 87, "Position"), word(1, 2, 75, "Officer"), word(1, 3, 91, "¢"), word(2, 1, 9, "random"), word(3, 1, 91, "Qualifications")].join("\n"));
    expect(result.text).toBe("Position Officer\nQualifications");
    expect(result.wordCount).toBe(3);
    expect(result.droppedWordCount).toBe(1);
  });

  it("plans translation by field so already-correct English is not translated with Swahili text", () => {
    const fields = normalizeStructuredJobAd({
      title: "Meneja wa Masoko",
      description: "The position requires several years of experience in marketing and management.",
      responsibilities: "kuratibu miradi na kusimamia shughuli katika jamii",
      qualifications: "The applicant must have a degree and relevant experience.",
    }).fields;
    const plan = planFieldTranslations(fields, "en");
    expect(plan.translate.map(({ key, source }) => ({ key, source }))).toEqual([
      { key: "title", source: "sw" },
      { key: "responsibilities", source: "sw" },
    ]);
    expect(plan.uncertain).toEqual([]);
  });

  it("translates only non-target lines inside a bilingual section", () => {
    const fields = normalizeStructuredJobAd({
      responsibilities: "The applicant will coordinate weekly reports with the team and document outcomes.\nWajibu wa mwombaji ni kusimamia miradi na kuandaa ripoti za kila wiki.",
    }).fields;
    const plan = planFieldTranslations(fields, "en");
    expect(plan.translate).toHaveLength(1);
    expect(plan.translate[0]).toMatchObject({ key: "responsibilities", source: "sw", lineIndex: 1 });
    expect(plan.translate[0]?.text).toContain("Wajibu wa mwombaji");
  });

  it("detects supported source-language direction conservatively", () => {
    expect(detectTranslationSource("The job requires three years of experience and applicants should apply for the position." )).toBe("en");
    expect(detectTranslationSource("Nafasi ya kazi inahitaji uzoefu na sifa za elimu katika taasisi." )).toBe("sw");
    expect(detectTranslationSource("Field Officer" )).toBeNull();
  });
});
