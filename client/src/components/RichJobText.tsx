import React, { type ReactNode } from "react";

const bulletPrefix = /^(?:[-*•▪‣]|\d+[.)])\s+/;
const inlineLinkPattern = /https?:\/\/[^\s<>]+|www\.[^\s<>]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\+?\d[\d().\s/-]{5,}\d/giu;

function linkify(text: string, prefix: string, emailHref?: (email: string) => string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = new RegExp(inlineLinkPattern.source, inlineLinkPattern.flags);
  let cursor = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(text))) {
    let value = match[0];
    let trailing = "";
    while (/[.,;:!?)}\]]$/.test(value)) {
      trailing = value.slice(-1) + trailing;
      value = value.slice(0, -1);
    }
    if (!value) continue;
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const key = `${prefix}-link-${index++}`;
    if (/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/u.test(value)) {
      nodes.push(<a key={key} href={emailHref ? emailHref(value) : `mailto:${value}`}>{value}</a>);
    } else if (/^(?:https?:\/\/|www\.)/i.test(value)) {
      const href = value.startsWith("www.") ? `https://${value}` : value;
      nodes.push(<a key={key} href={href} target="_blank" rel="noopener noreferrer">{value}</a>);
    } else {
      const digits = value.replace(/\D/g, "");
      if (digits.length >= 7 && digits.length <= 15) {
        const international = value.trim().startsWith("+");
        nodes.push(<a key={key} href={`tel:${international ? "+" : ""}${digits}`}>{value}</a>);
      } else nodes.push(value);
    }
    if (trailing) nodes.push(trailing);
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

type Block = { kind: "paragraph"; lines: string[] } | { kind: "list"; ordered: boolean; items: string[] };

function splitCollapsedListText(text: string): string {
  return text
    .replace(/(?<=[\p{Ll}\p{N}])[.!?](?=\p{Lu})/gu, "$&\n")
    .replace(/(?<=[\p{Ll}\p{N}])[.!?][\t ]+(?=\p{Lu})/gu, "$&\n")
    .replace(/(?<=[\p{Ll}])(?=(?:Act|Assist|Build|Conduct|Coordinate|Contribute|Develop|Drive|Ensure|Establish|Facilitate|Help|Implement|Lead|Maintain|Manage|Monitor|Oversee|Participate|Perform|Prepare|Provide|Review|Support|Teach|Undertake|Work|At\s+least|Bachelor|Certified|Demonstrated|Degree|Diploma|Excellent|Experience|Fluent|Graduate|Minimum|Master|Proven|Relevant|Strong|University|Valid|A\s+(?:bachelor|degree|diploma|relevant|minimum))\b)/gu, "\n")
    .replace(/[\t ]*([•▪‣])[\t ]*(?=\S)/gu, "\n$1 ")
    .replace(/[\t ]+([-*])[\t ]+(?=\S)/g, "\n$1 ");
}

function parseBlocks(text: string, forceList: boolean | "ordered" = false): Block[] {
  if (forceList) {
    const normalized = text.replace(/\r\n?/g, "\n");
    const listText = normalized.includes("\n") ? normalized : splitCollapsedListText(normalized);
    const items = listText.split("\n").map(line => line.trim().replace(bulletPrefix, "").trim()).filter(Boolean);
    return items.length ? [{ kind: "list", ordered: forceList === "ordered", items }] : [];
  }
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", lines: paragraph });
    paragraph = [];
  };
  const flushList = () => {
    if (list?.items.length) blocks.push({ kind: "list", ...list });
    list = null;
  };
  for (const rawLine of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) { flushParagraph(); flushList(); continue; }
    const match = line.match(/^(\d+[.)])\s+(.+)$/);
    const isBullet = Boolean(match) || bulletPrefix.test(line);
    if (isBullet) {
      flushParagraph();
      const ordered = Boolean(match);
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push((match ? match[2] : line.replace(bulletPrefix, "")).trim());
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

export default function RichJobText({ text, className = "", forceList = false, emailHref }: { text: string; className?: string; forceList?: boolean | "ordered"; emailHref?: (email: string) => string }) {
  const blocks = parseBlocks(text, forceList);
  if (!blocks.length) return null;
  return <div className={`job-rich-text ${className}`.trim()}>
    {blocks.map((block, blockIndex) => block.kind === "paragraph"
      ? <p key={`p-${blockIndex}`}>{block.lines.map((line, lineIndex) => <span key={`line-${blockIndex}-${lineIndex}`}>{lineIndex > 0 && <br />}{linkify(line, `p-${blockIndex}-${lineIndex}`, emailHref)}</span>)}</p>
      : block.ordered
        ? <ol key={`ol-${blockIndex}`}>{block.items.map((item, itemIndex) => <li key={`ol-${blockIndex}-${itemIndex}`}>{linkify(item, `ol-${blockIndex}-${itemIndex}`, emailHref)}</li>)}</ol>
        : <ul key={`ul-${blockIndex}`}>{block.items.map((item, itemIndex) => <li key={`ul-${blockIndex}-${itemIndex}`}>{linkify(item, `ul-${blockIndex}-${itemIndex}`, emailHref)}</li>)}</ul>)}
  </div>;
}

const socialPostHeadingLabel = /^(?:job\s*details|job\s*title|position|vacancy|location|deadline|closing\s*date|employment\s*type|location\s*type|department|compensation|salary|pay|overview|about(?:\s+.+)?|position\s+overview|position\s+summary|job\s+summary|qualifications?|requirements?|who\s+we.?re\s+looking\s+for|responsibilities|duties|what\s+you.?ll\s+do|key\s+responsibilities|hiring\s+process|recruitment\s+process|how\s*to\s*apply|application(?:\s+procedure)?|mode\s+of\s+application|benefits|what\s+we\s+offer|experience|contact|work\s+schedule|schedule|important\s+note|quick\s+note\s+on\s+scammers|scam\s+warning|important\s+notice)\s*:?$/iu;
const socialPostFieldHeading = /^(?:job\s*title|position|location|deadline|closing\s*date|employment\s*type|location\s*type|department|compensation|salary|pay|qualifications?|requirements?|responsibilities|duties|how\s*to\s*apply|application(?:\s+procedure)?|mode\s+of\s+application|benefits|experience|contact|work\s+schedule)\s*:/iu;
const socialPostListPrefix = /^(\d+[.)]|[-*•▪‣])\s+(.*)$/u;

function isSocialPostHeading(line: string) {
  const value = line.trim();
  if (!value || value.length > 90 || socialPostListPrefix.test(value)) return false;
  if (socialPostHeadingLabel.test(value.replace(/\s*:\s*$/u, "")) || socialPostFieldHeading.test(value)) return true;
  const letters = value.replace(/[^\p{L}]/gu, "");
  if (letters.length >= 4 && letters.length <= 75 && value === value.toLocaleUpperCase() && !/[.!?]$/u.test(value)) return true;
  return letters.length >= 4 && letters.length <= 75 && !/[.!?]$/u.test(value) && /^(?:about\s+\S|overview|what\s+you|who\s+we|hiring\s+process|important\s+note|quick\s+note|work\s+schedule|compensation|requirements?|qualifications?)/iu.test(value);
}

export function RawSocialPostText({ text, headline = "", className = "", organized = false, emailHref }: { text: string; headline?: string; className?: string; organized?: boolean; emailHref?: (email: string) => string }) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const firstContentIndex = lines.findIndex(line => line.trim());
  const headlineKey = headline.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  const firstLineKey = firstContentIndex >= 0 ? lines[firstContentIndex].trim().replace(/\s+/g, " ").toLocaleLowerCase() : "";
  const showLead = firstContentIndex >= 0 && firstLineKey !== headlineKey;

  if (organized) {
    const order = ["about", "summary", "benefits", "duties", "requirements", "process", "schedule", "highlights", "application", "safety", "other"];
    const labels: Record<string, string> = {
      about: "ABOUT THE COMPANY",
      summary: "POSITION SUMMARY",
      duties: "WHAT YOU'LL DO",
      benefits: "WHAT WE OFFER",
      requirements: "REQUIREMENTS",
      highlights: "OPPORTUNITY HIGHLIGHTS",
      process: "HIRING PROCESS",
      schedule: "WORK SCHEDULE",
      application: "HOW TO APPLY",
      safety: "IMPORTANT NOTICE",
      other: "ADDITIONAL INFORMATION",
    };
    const sections: Record<string, { key: string; heading: string; lines: string[] }[]> = Object.fromEntries(order.map(key => [key, []]));
    let current: { key: string; heading: string; lines: string[] } | null = null;
    const classify = (heading: string) => {
      const value = heading.toLocaleLowerCase();
      if (/about.*(company|organisation|organization|clipboard)|company overview/.test(value)) return "about";
      if (/position summary|job summary|role overview|about the (role|job)|^overview$/.test(value)) return "summary";
      if (/responsibilit|duties|what you.?ll do|key tasks|key accountabilities|your role|your tasks/.test(value)) return "duties";
      if (/what we offer|benefits|perks|compensation|salary|^pay$/.test(value)) return "benefits";
      if (/requirements|qualifications|what you.?ll need|eligibility|who we.?re looking for|candidate profile|about you|you should have|you will bring|skills and experience|education and experience|experience and skills|knowledge and skills/.test(value)) return "requirements";
      if (/opportunity highlights|key highlights|job highlights/.test(value)) return "highlights";
      if (/hiring process|recruitment process/.test(value)) return "process";
      if (/how to apply|application|apply now|mode of application/.test(value)) return "application";
      if (/schedule|shift|working hours/.test(value)) return "schedule";
      if (/important notice|safety|warning|scam|important note|quick note/.test(value)) return "safety";
      return "other";
    };
    const pushCurrent = () => {
      if (current && current.lines.length) sections[current.key].push({ key: current.key, heading: current.heading, lines: current.lines });
    };
    lines.forEach((raw, index) => {
      const value = raw.trim();
      if (!value || (index === firstContentIndex && !showLead)) return;
      if (index === firstContentIndex && showLead) {
        current = { key: "summary", heading: "POSITION SUMMARY", lines: [value] };
        return;
      }
      if (isSocialPostHeading(value)) {
        pushCurrent();
        const key = classify(value.replace(/:$/, ""));
        current = { key, heading: labels[key] === "ADDITIONAL INFORMATION" ? value.replace(/:$/, "") : labels[key], lines: [] };
        return;
      }
      if (!current) current = { key: "summary", heading: labels.summary, lines: [] };
      current.lines.push(value);
    });
    pushCurrent();
    const renderedSections = order.flatMap(key => sections[key]);
    return <div className={`raw-social-post-text ${className}`.trim()}>
      {renderedSections.map((section, sectionIndex) => {
        let itemNumber = 0;
        return <section className="social-post-organized-section" key={`organized-${sectionIndex}`}>
        <h3 className="social-post-section-heading">{section.heading}</h3>
        {section.lines.map((line, lineIndex) => {
          const item = line.match(socialPostListPrefix);
          const shouldNumber = section.key === "duties" || section.key === "requirements";
          if (item || shouldNumber) {
            itemNumber += 1;
            return <div className="social-post-list-line" key={`item-${sectionIndex}-${lineIndex}`}><span className="social-post-list-marker" aria-hidden="true">{itemNumber}.</span><span>{linkify(item ? item[2] : line, `organized-${sectionIndex}-${lineIndex}`, emailHref)}</span></div>;
          }
          itemNumber = 0;
          return <p className="social-post-paragraph" key={`paragraph-${sectionIndex}-${lineIndex}`}>{linkify(item ? item[2] : line, `organized-${sectionIndex}-${lineIndex}`)}</p>;
        })}
      </section>;
      })}
    </div>;
  }

  let listNumber = 0;
  return <div className={`raw-social-post-text ${className}`.trim()}>{lines.map((line, index) => {
    const value = line.trim();
    if (!value) { listNumber = 0; return <div className="social-post-space" aria-hidden="true" key={`raw-space-${index}`} />; }
    if (index === firstContentIndex && !showLead) return null;
    if (index === firstContentIndex) { listNumber = 0; return <p className="social-post-lead" key={`raw-line-${index}`}>{linkify(value, `raw-${index}`, emailHref)}</p>; }
    if (isSocialPostHeading(value)) { listNumber = 0; return <h3 className="social-post-section-heading" key={`raw-line-${index}`}>{linkify(value, `raw-${index}`)}</h3>; }
    const listItem = value.match(socialPostListPrefix);
    if (listItem) { listNumber += 1; return <div className="social-post-list-line" key={`raw-line-${index}`}><span className="social-post-list-marker" aria-hidden="true">{listNumber}.</span><span>{linkify(listItem[2], `raw-${index}`)}</span></div>; }
    listNumber = 0;
    return <p className="social-post-paragraph" key={`raw-line-${index}`}>{linkify(value, `raw-${index}`)}</p>;
  })}</div>;
}
