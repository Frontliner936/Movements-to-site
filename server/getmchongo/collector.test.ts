import { describe, expect, it } from "vitest";
import { parseJson, parseRss, extractHtmlPage, validateSourceUrl } from "./collector";

describe("Get Mchongo source collection", () => {
  it("parses RSS details and leaves unprovided fields empty", () => {
    const candidates = parseRss(`<rss><channel><item><title>Field Research Officer</title><link>https://careers.example.org/jobs/12</link><description>Coordinate the field programme and report findings.</description><category>Research</category></item></channel></rss>`, "https://careers.example.org/feed.xml", {});
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ title: "Field Research Officer", category: "Research", applicationUrl: "https://careers.example.org/jobs/12" });
    expect(candidates[0].location).toBeNull();
    expect(candidates[0].deadline).toBeNull();
    expect(candidates[0].qualifications).toBeNull();
  });

  it("supports administrator-configured JSON list and field paths", () => {
    const candidates = parseJson(JSON.stringify({ data: { openings: [{ role: { label: "Product Designer" }, organisation: { name: "Kilimanjaro Labs" }, region: "Arusha", details: "Design and test accessible product experiences.", href: "/jobs/product-designer" }] } }), "https://api.example.org/v1/jobs", {
      itemsPath: "data.openings",
      fieldMap: { title: "role.label", companyName: "organisation.name", location: "region", description: "details", sourceUrl: "href" },
    });
    expect(candidates[0]).toMatchObject({ title: "Product Designer", companyName: "Kilimanjaro Labs", location: "Arusha", sourceUrl: "https://api.example.org/jobs/product-designer" });
    expect(candidates[0].deadline).toBeNull();
    expect(candidates[0].responsibilities).toBeNull();
  });

  it("extracts Schema.org JobPosting fields without fabricating missing values", () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org", "@type": "JobPosting", title: "Finance Associate", description: "<p>Support financial operations for the programme.</p>", responsibilities: "Prepare monthly reconciliations.", qualifications: "A relevant accounting qualification.", validThrough: "2026-12-01", hiringOrganization: { name: "Lake Zone Initiative", logo: "https://example.org/logo.png" }, jobLocation: { address: { addressLocality: "Mwanza", addressRegion: "Mwanza Region" } }, url: "https://example.org/jobs/finance-associate",
    })}</script></head><body><main><h1>Finance Associate</h1></main></body></html>`;
    const candidate = extractHtmlPage(html, "https://example.org/jobs/finance-associate", {});
    expect(candidate).toMatchObject({ title: "Finance Associate", companyName: "Lake Zone Initiative", location: "Mwanza, Mwanza Region", deadline: "2026-12-01", responsibilities: "Prepare monthly reconciliations.", qualifications: "A relevant accounting qualification.", applicationUrl: "https://example.org/jobs/finance-associate", imageUrl: "https://example.org/logo.png" });
    expect(candidate?.howToApply).toBeNull();
  });

  it("keeps the source page but leaves an absent application link blank", () => {
    const sourceUrl = "https://example.org/jobs/analyst";
    const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "JobPosting", title: "Research Analyst", hiringOrganization: { name: "Verified Organisation" } })}</script><main><h1>Research Analyst</h1></main>`;
    const candidate = extractHtmlPage(html, sourceUrl, {});
    expect(candidate?.sourceUrl).toBe(sourceUrl);
    expect(candidate?.applicationUrl).toBeNull();
  });

  it("does not turn an opaque RSS GUID into an application URL", () => {
    const candidates = parseRss(`<rss><channel><item><title>Policy Associate</title><guid isPermaLink="false">urn:uuid:opaque-123</guid></item></channel></rss>`, "https://careers.example.org/feed.xml", {});
    expect(candidates[0].sourceUrl).toBe("https://careers.example.org/feed.xml");
    expect(candidates[0].applicationUrl).toBeNull();
  });

  it("rejects loopback, private and non-web-port tracking targets", async () => {
    await expect(validateSourceUrl("http://127.0.0.1/feed.xml")).rejects.toThrow(/private|local/i);
    await expect(validateSourceUrl("http://10.0.0.12/jobs")).rejects.toThrow(/private|reserved/i);
    await expect(validateSourceUrl("https://203.0.113.12:3306/api")).rejects.toThrow(/standard.*ports/i);
  });
});
