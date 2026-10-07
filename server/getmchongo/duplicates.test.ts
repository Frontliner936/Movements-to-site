import { describe, expect, it } from "vitest";
import { candidateFingerprint, findDuplicateMatches } from "./duplicates";

describe("Get Mchongo duplicate review signals", () => {
  const record = { recordType: "job" as const, recordId: 7, title: "Operations Analyst", companyName: "Coastal Research Trust", applicationUrl: "https://jobs.example.org/role/42", description: "The successful candidate will coordinate field reports, prepare weekly briefs, maintain a central tracker, and work with regional programme teams to improve delivery." };

  it("flags a matching normalized title and company", () => {
    const matches = findDuplicateMatches({ title: "  OPERATIONS analyst ", companyName: "Coastal Research Trust" }, [record]);
    expect(matches).toHaveLength(1);
    expect(matches[0].reasons).toEqual(["title match", "company match"]);
  });

  it("flags a repeated application link even when the title changed", () => {
    const matches = findDuplicateMatches({ title: "Programme Analyst", companyName: "Another Institution", applicationUrl: "https://jobs.example.org/role/42?utm_source=feed" }, [record]);
    expect(matches[0].reasons).toContain("application link match");
  });

  it("flags a sufficiently similar source description with the same company", () => {
    const matches = findDuplicateMatches({ title: "Regional Opportunity", companyName: "Coastal Research Trust", description: record.description }, [record]);
    expect(matches[0].reasons).toContain("description similarity");
  });

  it("does not infer a duplicate from a shared title alone when companies differ", () => {
    expect(findDuplicateMatches({ title: record.title, companyName: "Different Organisation" }, [record])).toHaveLength(0);
  });

  it("creates stable source-scoped fingerprints", () => {
    const candidate = { title: "Operations Analyst", companyName: "Coastal Research Trust", sourceUrl: "https://jobs.example.org/role/42" };
    expect(candidateFingerprint(3, candidate)).toBe(candidateFingerprint(3, candidate));
    expect(candidateFingerprint(4, candidate)).not.toBe(candidateFingerprint(3, candidate));
  });
});
