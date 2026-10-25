import { describe, expect, it } from "vitest";
import { scoreCvForJob } from "./member-routes";

describe("scoreCvForJob", () => {
  it("scores matched role terms and standard CV sections without retaining input", () => {
    const result = scoreCvForJob(
      "Professional Summary. Skills: project management, analysis, Excel. Experience: analyst at a bank. Education: degree in finance. Contact: applicant@example.com",
      "Finance analyst needs project management, data analysis and Excel skills.",
    );
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.matchedKeywords).toContain("finance");
    expect(result.sectionsFound).toBeGreaterThanOrEqual(4);
    expect(result).not.toHaveProperty("cvText");
  });

  it("can return 100 when every weighted keyword and recognized structure section is present", () => {
    const cv = `Professional Summary Skills Network engineer routing security cloud infrastructure support Experience Education Contact ${"details ".repeat(80)}`;
    const result = scoreCvForJob(cv, "Network engineer routing security cloud infrastructure support");
    expect(result.score).toBe(100);
  });

  it("returns a bounded score and missing keywords for unrelated CV text", () => {
    const result = scoreCvForJob("A short applicant profile with some unrelated experience and skills.", "Senior network engineer with routing, security and cloud infrastructure expertise.");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.missingKeywords.length).toBeGreaterThan(0);
  });
});
