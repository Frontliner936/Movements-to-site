import React, { type ReactNode } from "react";

const bulletPrefix = /^(?:[-*•▪‣]|\d+[.)])\s+/;
const inlineLinkPattern = /https?:\/\/[^\s<>]+|www\.[^\s<>]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\+?\d[\d().\s/-]{5,}\d/giu;

function linkify(text: string, prefix: string): ReactNode[] {
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
      nodes.push(<a key={key} href={`mailto:${value}`}>{value}</a>);
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

function parseBlocks(text: string, forceList: boolean | "ordered" = false): Block[] {
  if (forceList) {
    const items = text.replace(/\r\n?/g, "\n").split("\n").map(line => line.trim().replace(bulletPrefix, "").trim()).filter(Boolean);
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

export default function RichJobText({ text, className = "", forceList = false }: { text: string; className?: string; forceList?: boolean | "ordered" }) {
  const blocks = parseBlocks(text, forceList);
  if (!blocks.length) return null;
  return <div className={`job-rich-text ${className}`.trim()}>
    {blocks.map((block, blockIndex) => block.kind === "paragraph"
      ? <p key={`p-${blockIndex}`}>{block.lines.map((line, lineIndex) => <span key={`line-${blockIndex}-${lineIndex}`}>{lineIndex > 0 && <br />}{linkify(line, `p-${blockIndex}-${lineIndex}`)}</span>)}</p>
      : block.ordered
        ? <ol key={`ol-${blockIndex}`}>{block.items.map((item, itemIndex) => <li key={`ol-${blockIndex}-${itemIndex}`}>{linkify(item, `ol-${blockIndex}-${itemIndex}`)}</li>)}</ol>
        : <ul key={`ul-${blockIndex}`}>{block.items.map((item, itemIndex) => <li key={`ul-${blockIndex}-${itemIndex}`}>{linkify(item, `ul-${blockIndex}-${itemIndex}`)}</li>)}</ul>)}
  </div>;
}
