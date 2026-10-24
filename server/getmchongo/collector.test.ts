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

  it("preserves array-valued responsibilities and qualifications from JSON feeds", () => {
    const candidates = parseJson(JSON.stringify({ jobs: [{
      title: "Community Officer",
      responsibilities: ["Coordinate field visits", "Prepare weekly reports"],
      qualifications: ["Diploma in community development", "Two years of relevant experience"],
    }] }), "https://api.example.org/jobs", {});
    expect(candidates[0].responsibilities).toBe("• Coordinate field visits\n• Prepare weekly reports");
    expect(candidates[0].qualifications).toBe("• Diploma in community development\n• Two years of relevant experience");
  });

  it("extracts Schema.org JobPosting fields without fabricating missing values", () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org", "@type": "JobPosting", title: "Finance Associate", description: "<p>Support financial operations for the programme.</p>", responsibilities: "Prepare monthly reconciliations.", qualifications: "A relevant accounting qualification.", validThrough: "2026-12-01", hiringOrganization: { name: "Lake Zone Initiative", logo: "https://example.org/logo.png" }, jobLocation: { address: { addressLocality: "Mwanza", addressRegion: "Mwanza Region" } }, url: "https://example.org/jobs/finance-associate",
    })}</script></head><body><main><h1>Finance Associate</h1></main></body></html>`;
    const candidate = extractHtmlPage(html, "https://example.org/jobs/finance-associate", {});
    expect(candidate).toMatchObject({ title: "Finance Associate", companyName: "Lake Zone Initiative", location: "Mwanza, Mwanza Region", deadline: "1 December 2026", responsibilities: "• Prepare monthly reconciliations.", qualifications: "• A relevant accounting qualification.", applicationUrl: "https://example.org/jobs/finance-associate", imageUrl: "https://example.org/logo.png" });
    expect(candidate?.howToApply).toBeNull();
  });

  it("uses the explicit deadline in a tracked advert, not its posted date", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "JobPosting", title: "Programme Officer", validThrough: "2029-10-23T23:59:59+03:00" })}</script><main><h1>Programme Officer</h1><p>Date posted: 24 October 2026</p><p>Application deadline: 30 November 2026</p></main>`;
    const candidate = extractHtmlPage(html, "https://example.org/jobs/programme-officer", {});
    expect(candidate?.deadline).toBe("30 November 2026");
  });

  it("uses different explicitly stated RSS closing dates instead of a shared validThrough date", () => {
    const feed = `<rss><channel>
      <item><title>Finance Officer</title><link>https://example.org/jobs/finance</link><description><![CDATA[Application deadline: 30 June 2026]]></description><validThrough>2029-10-23T23:59:59+03:00</validThrough></item>
      <item><title>Programme Officer</title><link>https://example.org/jobs/programme</link><description><![CDATA[Application deadline: 15 August 2026]]></description><validThrough>2029-10-23T23:59:59+03:00</validThrough></item>
    </channel></rss>`;
    const candidates = parseRss(feed, "https://example.org/feed.xml", {});
    expect(candidates.map(item => item.deadline)).toEqual(["30 June 2026", "15 August 2026"]);
  });

  it("prefers a JSON advert’s closing-date text to a generic validThrough value", () => {
    const candidates = parseJson(JSON.stringify({ jobs: [{
      title: "Research Officer",
      description: "Closing date: 30 June 2026",
      validThrough: "2029-10-23T23:59:59+03:00",
    }] }), "https://api.example.org/jobs", {});
    expect(candidates[0].deadline).toBe("30 June 2026");
  });

  it("separates duties and requirements even when the source puts them inside a Description block", () => {
    const html = `<main><h1>Finance Officer</h1><h2>Description</h2><p>Support sound financial management for the programme.</p><p>Responsibilities: Prepare budgets and reconcile accounts.</p><p>Qualifications: Applicants must have a finance degree and three years of experience.</p></main>`;
    const candidate = extractHtmlPage(html, "https://example.org/jobs/finance-officer", {});
    expect(candidate?.description).toBe("Support sound financial management for the programme.");
    expect(candidate?.responsibilities).toContain("Prepare budgets");
    expect(candidate?.qualifications).toContain("finance degree");
    expect(candidate?.description).not.toContain("Prepare budgets");
    expect(candidate?.description).not.toContain("finance degree");
  });

  it("splits full-advert text from RSS and normalizes ISO source deadlines to readable dates", () => {
    const feed = `<rss><channel><item><title>Programme Officer</title><link>https://example.org/jobs/po</link><description><![CDATA[<p>Support regional programme delivery.</p><h2>Responsibilities</h2><ul><li>Coordinate field teams.</li><li>Prepare monthly reports.</li></ul><h2>Qualifications</h2><ul><li>Applicants must have a degree and five years of experience.</li></ul>]]></description><validThrough>2029-10-23T23:59:59+03:00</validThrough></item></channel></rss>`;
    const candidate = parseRss(feed, "https://example.org/feed.xml", {})[0];
    expect(candidate.description).toBe("Support regional programme delivery.");
    expect(candidate.responsibilities).toContain("Coordinate field teams");
    expect(candidate.responsibilities).toContain("Prepare monthly reports");
    expect(candidate.qualifications).toContain("degree");
    expect(candidate.description).not.toContain("Coordinate field teams");
    expect(candidate.deadline).toBe("23 October 2029");
  });

  it("splits JSON-feed description and responsibility fields without repeating section details", () => {
    const candidates = parseJson(JSON.stringify({ jobs: [{
      title: "Community Manager",
      description: "Support community programmes and partner engagement. Responsibilities: Coordinate outreach events. Qualifications: Applicants must have a relevant degree and three years of experience.",
      responsibilities: ["Coordinate outreach events", "Applicants must have a relevant degree and three years of experience"],
    }] }), "https://api.example.org/jobs", {});
    expect(candidates[0].description).toBe("Support community programmes and partner engagement.");
    expect(candidates[0].responsibilities).toContain("Coordinate outreach events");
    expect(candidates[0].responsibilities).not.toContain("Applicants must");
    expect(candidates[0].qualifications).toContain("relevant degree");
    expect(candidates[0].description).not.toContain("Coordinate outreach events");
  });

  it("keeps HTML list items separate when extracting sections from tracked career pages", () => {
    const html = `<main><h1>Community Health Officer</h1>
      <h2>Responsibilities</h2><ul><li>Coordinate community health visits</li><li>Prepare monthly activity reports</li></ul>
      <h2>Qualifications</h2><ol><li>Diploma in public health</li><li>Two years of experience</li></ol></main>`;
    const candidate = extractHtmlPage(html, "https://example.org/jobs/health-officer", {});
    expect(candidate?.responsibilities).toBe("• Coordinate community health visits\n• Prepare monthly activity reports");
    expect(candidate?.qualifications).toBe("• Diploma in public health\n• Two years of experience");
  });

  it("keeps tracked advert descriptions concise and separates requirements misplaced under responsibilities", () => {
    const html = `<main><h1>Programme Officer</h1><p>Support community programmes and coordinate partner activities across the region.</p><h2>Responsibilities</h2><ul><li>Coordinate field visits and prepare monthly reports.</li><li>Applicants must hold a degree and have at least five years of relevant experience.</li></ul><h2>Qualifications</h2><ul><li>Master's degree in public administration.</li></ul></main>`;
    const candidate = extractHtmlPage(html, "https://example.org/jobs/programme-officer", {});
    expect(candidate?.description).toContain("Support community programmes");
    expect(candidate?.description).not.toContain("Coordinate field visits");
    expect(candidate?.description).not.toContain("Master's degree");
    expect(candidate?.responsibilities).toContain("Coordinate field visits");
    expect(candidate?.responsibilities).not.toContain("Applicants must hold");
    expect(candidate?.qualifications).toContain("Applicants must hold");
    expect(candidate?.qualifications).toContain("Master's degree");
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

  it("accepts a public IPv4 source through ipaddr.js", async () => {
    await expect(validateSourceUrl("https://8.8.8.8/jobs")).resolves.toBeUndefined();
  });
});
