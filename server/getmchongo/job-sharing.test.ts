import { describe, expect, it } from "vitest";
import { createJobShareInfo } from "../../client/src/lib/jobSharing";

const job = {
  id: 24,
  title: "Field Officer",
  companyName: "Example & Partners",
  shareImageUrl: "/og/jobs/24.jpg?v=1791473135000",
};

describe("createJobShareInfo", () => {
  it("keeps the versioned job preview URL and uses the canonical site origin", () => {
    const info = createJobShareInfo(job, "https://preview.invalid", "https://jobs.example/jobs/24");
    expect(info.url).toBe("https://jobs.example/jobs/24?share=1791473135000");
    expect(info.text).toBe("Field Officer — Example & Partners");
  });

  it("creates WhatsApp, Facebook, X, LinkedIn, and Telegram links with the job URL", () => {
    const info = createJobShareInfo(job, "https://jobs.example");
    expect(info.destinations.map(destination => destination.id)).toEqual(["whatsapp", "facebook", "x", "linkedin", "telegram"]);
    for (const destination of info.destinations) {
      const link = new URL(destination.href);
      const includedUrl = link.searchParams.get("url") ?? link.searchParams.get("u") ?? link.searchParams.get("text") ?? "";
      expect(includedUrl).toContain(info.url);
    }
    const whatsapp = new URL(info.destinations[0].href);
    expect(whatsapp.searchParams.get("text")).toContain("Field Officer — Example & Partners");
    expect(whatsapp.searchParams.get("text")).toContain(info.url);
  });
});
