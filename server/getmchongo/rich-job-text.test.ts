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
});
