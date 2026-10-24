import { describe, expect, it } from "vitest";
import { formatJobBulletItems, formatJobDeadline, jobDeadlineLabel } from "../../client/src/lib/jobFormatting";

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

describe("job deadline display", () => {
  it("formats ISO timestamps as the source calendar date without a timezone timestamp", () => {
    expect(formatJobDeadline("2029-10-23T23:59:59+03:00")).toBe("23 October 2029");
  });

  it("shows the exact source date for today and labels past deadlines as closed", () => {
    const today = new Date(2026, 9, 24, 12);
    expect(jobDeadlineLabel("2026-10-24T23:59:59+03:00", today)).toBe("Closes 24 October 2026");
    expect(jobDeadlineLabel("2026-10-23", today)).toBe("Closed on 23 October 2026");
  });
});
