import { describe, expect, it } from "vitest";
import { formatJobBulletItems } from "../../client/src/lib/jobFormatting";

describe("formatJobBulletItems", () => {
  it("normalizes plain, bulleted, and numbered lines to one bullet per item", () => {
    expect(formatJobBulletItems("  Visit field sites\n- Prepare reports\n2. Support the team\n\n• Share updates"))
      .toBe("• Visit field sites\n• Prepare reports\n• Support the team\n• Share updates");
  });

  it("keeps a plain single-paragraph field as one bullet and leaves an empty field empty", () => {
    expect(formatJobBulletItems("Coordinate with stakeholders and prepare weekly reports."))
      .toBe("• Coordinate with stakeholders and prepare weekly reports.");
    expect(formatJobBulletItems("  \n \n")).toBe("");
  });
});
