import { describe, expect, it } from "vitest";
import { cvCategories, cvPackages, cvWhatsAppLink, formatTsh } from "../../client/src/lib/cvServices";

describe("CV services catalog", () => {
  it("keeps the requested package prices and marks Professional ATS as recommended", () => {
    expect(cvPackages.map(({ name, priceTsh }) => [name, priceTsh])).toEqual([
      ["Basic CV", 7000],
      ["Professional ATS CV", 10000],
      ["Executive / Specialist CV", 15000],
      ["CV + Application Letter", 12000],
      ["Application Letter Only", 2000],
    ]);
    expect(cvPackages.filter(item => item.recommended).map(item => item.id)).toEqual(["professional-ats"]);
  });

  it("maps every displayed category to existing packages", () => {
    const packageIds = new Set(cvPackages.map(item => item.id));
    expect(cvCategories.map(item => item.name)).toEqual([
      "First-Time Job Seeker CV",
      "Experienced Professional CV",
      "Academic CV",
      "Hospitality & General Jobs CV",
      "Technical & Specialist CV",
      "Executive & Management CV",
    ]);
    for (const category of cvCategories) {
      expect(category.packageIds.length).toBeGreaterThan(0);
      expect(category.packageIds.every(id => packageIds.has(id))).toBe(true);
    }
  });

  it("formats TSh prices and creates WhatsApp links to the requested number", () => {
    expect(formatTsh(7000)).toContain("7,000");
    const url = new URL(cvWhatsAppLink("Ask about a CV package"));
    expect(`${url.origin}${url.pathname}`).toBe("https://wa.me/255743738062");
    expect(url.searchParams.get("text")).toBe("Ask about a CV package");
  });
});
