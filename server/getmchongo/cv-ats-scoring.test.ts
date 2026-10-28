import { describe, expect, it } from "vitest";
import { CV_ATS_CATEGORY_WEIGHTS, scoreCvAts } from "./cv-ats-scoring";

const sampleCv = `Amina Nyerere\namina@example.com | +255 712 345 678 | Dar es Salaam | linkedin.com/in/amina\n\nPROFESSIONAL SUMMARY\nProject coordinator with experience supporting teams and improving operations.\n\nWORK EXPERIENCE\nProject Coordinator — Example Organization | 2021–2024\n- Coordinated 12 projects and improved delivery time by 20%.\n- Managed reports and trained 8 team members.\n\nEDUCATION\nBachelor of Science in Information Technology, Example University, 2020\n\nSKILLS\nProject management · Excel · data analysis · communication · reporting\n`;

describe("CV ATS scoring", () => {
  it("uses the eight exact category weights and returns a score from 0 to 100", () => {
    const result = scoreCvAts(sampleCv);
    expect(result.categories.map(category => category.weight)).toEqual([25, 10, 15, 15, 10, 10, 10, 5]);
    expect(result.categories.map(category => category.id)).toEqual(Object.keys(CV_ATS_CATEGORY_WEIGHTS));
    expect(result.categories.reduce((sum, category) => sum + category.weight, 0)).toBe(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.categories.reduce((sum, category) => sum + category.points, 0)).toBeCloseTo(result.score, 0);
  });

  it("compares a specific job description and returns sampled matched and missing terms", () => {
    const result = scoreCvAts(sampleCv, "Project coordinator required to manage projects, data analysis, stakeholder communication and logistics.");
    expect(result.targetProvided).toBe(true);
    expect(result.matchedKeywords).toContain("projects");
    expect(result.missingKeywords.length).toBeGreaterThan(0);
    expect(result.categories.find(category => category.id === "jobRelevance")?.summary).toContain("distinct terms");
  });

  it("identifies issues with actionable suggestions and explicitly disclaims ATS success guarantees", () => {
    const result = scoreCvAts("CV\n\nmy my teh\n\nSome very long line ".repeat(60));
    expect(result.categories.some(category => category.findings.some(finding => finding.issue && finding.suggestion))).toBe(true);
    expect(result.disclaimer).toMatch(/not an actual ATS test/i);
    expect(result.disclaimer).toMatch(/guarantee/i);
    expect(result.targetProvided).toBe(false);
  });
});
