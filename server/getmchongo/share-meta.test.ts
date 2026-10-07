import { describe, expect, it } from "vitest";
import { buildJobShareMetadata, renderJobShareHtml } from "./share-meta";
import type { companies, jobs } from "../../drizzle/schema";

type TestJob = Pick<typeof jobs.$inferSelect,
  "id" | "title" | "companyName" | "location" | "deadline" | "description" |
  "responsibilities" | "qualifications" | "howToApply" | "applicationUrl" | "sourceUrl" | "imageUrl">;
type TestCompany = Pick<typeof companies.$inferSelect, "name" | "description" | "logoUrl"> | null;

const sampleJob: TestJob = {
  id: 42,
  title: "Programme Officer",
  companyName: "Tanzania Research Foundation",
  location: "Dar es Salaam",
  deadline: "31 October 2026",
  description: "Lead a community programme and support local partners.",
  responsibilities: "Coordinate field teams.",
  qualifications: "Relevant experience.",
  howToApply: "Submit an application online.",
  applicationUrl: "https://example.org/apply/42",
  sourceUrl: "https://example.org/careers/programme-officer",
  imageUrl: "/manus-storage/jobs/programme-officer.webp",
};
const sampleCompany: TestCompany = {
  name: "Tanzania Research Foundation",
  description: "A public-interest research institution.",
  logoUrl: "/manus-storage/companies/trf-logo.webp",
};

const template = `<!doctype html><html lang="en"><head><meta name="description" content="Generic description"><meta property="og:type" content="website"><meta property="og:title" content="Get Mchongo"><meta property="og:description" content="Generic description"><title>Get Mchongo</title></head><body><div id="root"></div></body></html>`;

describe("job-specific share metadata", () => {
  it("uses the listing title, actual description, Get Mchongo brand and job image", () => {
    const origin = "https://getmchongo.example";
    const meta = buildJobShareMetadata(sampleJob, sampleCompany, origin);
    expect(meta.title).toBe("Programme Officer — Tanzania Research Foundation | Get Mchongo");
    expect(meta.description).toBe("Lead a community programme and support local partners.");
    expect(meta.imageUrl).toBe("https://getmchongo.example/manus-storage/jobs/programme-officer.webp");
    expect(meta.canonicalUrl).toBe("https://getmchongo.example/jobs/42");
  });

  it("uses the company logo only when a job image was not supplied", () => {
    const meta = buildJobShareMetadata({ ...sampleJob, imageUrl: null }, sampleCompany, "https://getmchongo.example");
    expect(meta.imageUrl).toBe("https://getmchongo.example/manus-storage/companies/trf-logo.webp");
  });

  it("renders initial HTML with the job title and details, not generic portal branding", () => {
    const html = renderJobShareHtml(template, { ...sampleJob, title: "Analyst <Lead> & Researcher" }, sampleCompany, "https://getmchongo.example");
    expect(html).toContain("<title>Analyst &lt;Lead&gt; &amp; Researcher — Tanzania Research Foundation | Get Mchongo</title>");
    expect(html).toContain('property="og:title" content="Analyst &lt;Lead&gt; &amp; Researcher — Tanzania Research Foundation | Get Mchongo"');
    expect(html).toContain('property="og:image" content="https://getmchongo.example/manus-storage/jobs/programme-officer.webp"');
    expect(html).toContain("Lead a community programme and support local partners.");
    expect(html).toContain("Qualifications and requirements");
    expect(html).toContain("href=\"https://example.org/apply/42\"");
    expect(html).not.toMatch(/MchongoDaily|bolt\.new/i);
    expect(html).toContain('property="og:site_name" content="Get Mchongo"');
  });

  it("does not guess an absolute image or canonical origin when none is configured", () => {
    const meta = buildJobShareMetadata(sampleJob, sampleCompany, null);
    expect(meta.imageUrl).toBeNull();
    expect(meta.canonicalUrl).toBeNull();
    const html = renderJobShareHtml(template, sampleJob, sampleCompany, null);
    expect(html).not.toContain('property="og:url"');
    expect(html).not.toContain('property="og:image"');
  });

  it("rejects non-HTTPS image and application URLs in share HTML", () => {
    const httpJob = { ...sampleJob, imageUrl: "http://insecure.example/cover.jpg", applicationUrl: "javascript:alert(1)" };
    const meta = buildJobShareMetadata(httpJob, null, null);
    expect(meta.imageUrl).toBeNull();
    const html = renderJobShareHtml(template, httpJob, null, null);
    expect(html).not.toContain("http://insecure.example/cover.jpg");
    expect(html).not.toContain("javascript:alert");
  });
});
