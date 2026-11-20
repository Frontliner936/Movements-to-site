import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RichJobText from "../../client/src/components/RichJobText";

describe("RichJobText", () => {
  it("renders bullet lines as a list and makes application email and phone clickable", () => {
    const html = renderToStaticMarkup(React.createElement(RichJobText, {
      text: "• Prepare weekly reports\n• Support the team\n\nSend your CV to jobs@example.org or call +255 712 345 678.",
    }));
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>Prepare weekly reports</li>");
    expect(html).toContain('href="mailto:jobs@example.org"');
    expect(html).toContain('href="tel:+255712345678"');
  });

  it("renders numbered requirements as an ordered list and only links HTTP(S) URLs", () => {
    const html = renderToStaticMarkup(React.createElement(RichJobText, {
      text: "1. Bachelor's degree\n2. Five years' experience\nApply at https://example.org/apply.",
    }));
    expect(html).toContain("<ol>");
    expect(html).toContain('href="https://example.org/apply"');
    expect(html).not.toContain('href="https://example.org/apply."');
  });

  it("renders plain legacy responsibility lines as bullets when forceList is enabled", () => {
    const html = renderToStaticMarkup(React.createElement(RichJobText, {
      text: "Visit project sites weekly\nPrepare monthly reports", forceList: true,
    }));
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>Visit project sites weekly</li>");
    expect(html).toContain("<li>Prepare monthly reports</li>");
  });

  it("renders responsibility and requirement lines as numbered list items when requested", () => {
    const html = renderToStaticMarkup(React.createElement(RichJobText, {
      text: "• Coordinate site visits\n• Hold a relevant diploma", forceList: "ordered",
    }));
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>Coordinate site visits</li>");
    expect(html).toContain("<li>Hold a relevant diploma</li>");
  });

  it("separates legacy source duties concatenated at sentence boundaries", () => {
    const html = renderToStaticMarkup(React.createElement(RichJobText, {
      text: "• Attend to emergency medical duties.Conduct ward rounds.Perform surgical duties.Provide clinical services", forceList: "ordered",
    }));
    expect(html.match(/<li>/g)).toHaveLength(4);
    expect(html).toContain("<li>Conduct ward rounds.</li>");
  });

  it("separates common duty starts when source extraction lost punctuation", () => {
    const html = renderToStaticMarkup(React.createElement(RichJobText, {
      text: "Programme designHelp with cash transfersEnsure a minimum transition rate", forceList: "ordered",
    }));
    expect(html.match(/<li>/g)).toHaveLength(3);
    expect(html).toContain("<li>Help with cash transfers</li>");
    expect(html).toContain("<li>Ensure a minimum transition rate</li>");
  });
});


import { RawSocialPostText } from "../../client/src/components/RichJobText";

describe("RawSocialPostText", () => {
  it("formats inline recruitment facts as information cards without changing their values", () => {
    const html = renderToStaticMarkup(React.createElement(RawSocialPostText, {
      text: "JOB TITLE: Finance Officer\nEmployer: Example Organisation\nLocation: Dar es Salaam\nSalary: TZS 1,500,000\nEmployment Type: Full-time\nApplication Deadline: 30 June 2026",
      headline: "Finance Officer",
    }));
    expect(html).toContain("Job title");
    expect(html).toContain("Example Organisation");
    expect(html).toContain("Dar es Salaam");
    expect(html).toContain("TZS 1,500,000");
    expect(html).toContain("Full-time");
    expect(html).toContain("30 June 2026");
    expect(html).toContain("social-post-facts");
  });

  it("renders responsibility and qualification sections as numbered lists", () => {
    const html = renderToStaticMarkup(React.createElement(RawSocialPostText, {
      text: "KEY RESPONSIBILITIES\nPrepare reports\nSupport the team\nQUALIFICATIONS\nBachelor's degree\nThree years of experience",
    }));
    expect(html).toContain("KEY RESPONSIBILITIES");
    expect(html).toContain("QUALIFICATIONS &amp; REQUIREMENTS");
    expect(html).toContain(">1.</span>");
    expect(html).toContain("Prepare reports");
    expect(html).toContain("Three years of experience");
  });

  it("renders clearly delimited tabular recruitment details as a responsive table", () => {
    const html = renderToStaticMarkup(React.createElement(RawSocialPostText, {
      text: "VACANCIES\nPosition | Vacancies\nAccountant | 2\nHR Officer | 1",
    }));
    expect(html).toContain("<table");
    expect(html).toContain("<th");
    expect(html).toContain("Accountant");
    expect(html).toContain("HR Officer");
  });

  it("keeps plain prose in paragraphs and preserves application contacts as links", () => {
    const html = renderToStaticMarkup(React.createElement(RawSocialPostText, {
      text: "ABOUT THE ROLE\nThis role supports a growing team.\nHOW TO APPLY\nSend your CV to jobs@example.org",
    }));
    expect(html).toContain("This role supports a growing team.");
    expect(html).toContain('href="mailto:jobs@example.org"');
    expect(html).toContain("HOW TO APPLY");
  });
});
