import { describe, expect, it } from "vitest";
import { formatPostedAgo } from "../../client/src/lib/timeAgo";

const now = new Date("2026-10-08T17:00:00.000Z");

describe("formatPostedAgo", () => {
  it("formats a recent published job in hours and minutes", () => {
    expect(formatPostedAgo("2026-10-08T16:00:00.000Z", now)).toBe("Posted 1 hour ago");
    expect(formatPostedAgo("2026-10-08T16:55:00.000Z", now)).toBe("Posted 5 minutes ago");
  });

  it("uses readable labels for older and future dates", () => {
    expect(formatPostedAgo("2026-10-05T17:00:00.000Z", now)).toBe("Posted 3 days ago");
    expect(formatPostedAgo("2026-10-08T19:00:00.000Z", now)).toBe("Scheduled in 2 hours");
  });

  it("returns no label for missing or invalid timestamps", () => {
    expect(formatPostedAgo(null, now)).toBeNull();
    expect(formatPostedAgo("not-a-date", now)).toBeNull();
  });
});
