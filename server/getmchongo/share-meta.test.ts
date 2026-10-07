import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { buildJobShareMetadata, makeShareCardImage, renderJobShareHtml, SHARE_IMAGE_HEIGHT, SHARE_IMAGE_WIDTH } from "./share-meta";
import type { companies, jobs } from "../../drizzle/schema";

type TestJob = Pick<typeof jobs.$inferSelect,
  "id" | "title" | "companyName" | "location" | "deadline" | "description" |
  "responsibilities" | "qualifications" | "howToApply" | "applicationUrl" | "sourceUrl" | "imageUrl" | "updatedAt">;
type TestCompany = Pick<typeof companies.$inferSelect, "name" | "description" | "logoUrl" | "updatedAt"> | null;

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
  updatedAt: new Date("2026-10-01T12:00:00Z"),
};
const sampleCompany: TestCompany = {
  name: "Tanzania Research Foundation",
  description: "A public-interest research institution.",
  logoUrl: "/manus-storage/companies/trf-logo.webp",
  updatedAt: new Date("2026-10-01T13:00:00Z"),
};

const template = `<!doctype html><html lang="en"><head><meta name="description" content="Generic description"><meta property="og:type" content="website"><meta property="og:title" content="Get Mchongo"><meta property="og:description" content="Generic description"><title>Get Mchongo</title></head><body><div id="root"></div></body></html>`;
const origin = "https://getmchongo.example";

function shareVersion() {
  return String(Math.max(sampleJob.updatedAt.getTime(), sampleCompany!.updatedAt.getTime()));
}

describe("job-specific share metadata", () => {
  it("uses the listing title, actual description, Get Mchongo brand and a versioned social image", () => {
    const meta = buildJobShareMetadata(sampleJob, sampleCompany, origin);
    expect(meta.title).toBe("Programme Officer — Tanzania Research Foundation | Get Mchongo");
    expect(meta.description).toBe("Lead a community programme and support local partners.");
    expect(meta.sourceImageUrl).toBe(`${origin}/manus-storage/jobs/programme-officer.webp`);
    expect(meta.imageUrl).toBe(`${origin}/og/jobs/42.jpg?v=${shareVersion()}`);
    expect(meta.imageWidth).toBe(SHARE_IMAGE_WIDTH);
    expect(meta.imageHeight).toBe(SHARE_IMAGE_HEIGHT);
    expect(meta.imageType).toBe("image/jpeg");
    expect(meta.canonicalUrl).toBe(`${origin}/jobs/42`);
  });

  it("uses the company logo when no listing image was supplied", () => {
    const meta = buildJobShareMetadata({ ...sampleJob, imageUrl: null }, sampleCompany, origin);
    expect(meta.sourceImageUrl).toBe(`${origin}/manus-storage/companies/trf-logo.webp`);
    expect(meta.imageUrl).toBe(`${origin}/og/jobs/42.jpg?v=${shareVersion()}`);
  });

  it("renders the selected image with accurate type and size tags and a fresh social URL", () => {
    const version = shareVersion();
    const html = renderJobShareHtml(template, { ...sampleJob, title: "Analyst <Lead> & Researcher" }, sampleCompany, origin, version);
    expect(html).toContain("<title>Analyst &lt;Lead&gt; &amp; Researcher — Tanzania Research Foundation | Get Mchongo</title>");
    expect(html).toContain('property="og:title" content="Analyst &lt;Lead&gt; &amp; Researcher — Tanzania Research Foundation | Get Mchongo"');
    expect(html).toContain(`property="og:image" content="${origin}/og/jobs/42.jpg?v=${version}"`);
    expect(html).toContain('property="og:image:type" content="image/jpeg"');
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain('property="og:image:height" content="630"');
    expect(html).toContain(`property="og:url" content="${origin}/jobs/42?share=${version}"`);
    expect(html).toContain(`rel="canonical" href="${origin}/jobs/42"`);
    expect(html).toContain("Lead a community programme and support local partners.");
    expect(html).toContain("Qualifications and requirements");
    expect(html).toContain('href="https://example.org/apply/42"');
    expect(html).not.toMatch(/MchongoDaily|bolt\.new/i);
    expect(html).toContain('property="og:site_name" content="Get Mchongo"');
  });

  it("does not invent an absolute image or canonical origin when none is configured", () => {
    const meta = buildJobShareMetadata(sampleJob, sampleCompany, null);
    expect(meta.imageUrl).toBeNull();
    expect(meta.canonicalUrl).toBeNull();
    const html = renderJobShareHtml(template, sampleJob, sampleCompany, null, shareVersion());
    expect(html).not.toContain('property="og:url"');
    expect(html).not.toContain('property="og:image"');
  });

  it("keeps direct external image URLs direct and does not invent their dimensions", () => {
    const directJob = { ...sampleJob, imageUrl: "https://images.example.org/role.webp" };
    const meta = buildJobShareMetadata(directJob, null, origin);
    expect(meta.imageUrl).toBe("https://images.example.org/role.webp");
    expect(meta.imageWidth).toBeNull();
    expect(meta.imageHeight).toBeNull();
  });

  it("rejects non-HTTPS image and application URLs in share HTML", () => {
    const httpJob = { ...sampleJob, imageUrl: "http://insecure.example/cover.jpg", applicationUrl: "javascript:alert(1)" };
    const meta = buildJobShareMetadata(httpJob, null, null);
    expect(meta.imageUrl).toBeNull();
    const html = renderJobShareHtml(template, httpJob, null, null);
    expect(html).not.toContain("http://insecure.example/cover.jpg");
    expect(html).not.toContain("javascript:alert");
  });

  it("produces a 1200×630 JPEG card without cropping the inserted source image", async () => {
    const source = await sharp({ create: { width: 246, height: 142, channels: 3, background: "#12664f" } }).jpeg().toBuffer();
    const card = await makeShareCardImage(source);
    const metadata = await sharp(card).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(630);
    expect(card.byteLength).toBeGreaterThan(1000);
  });
});
