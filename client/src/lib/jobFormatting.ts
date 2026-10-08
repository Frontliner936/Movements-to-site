const leadingBullet = /^(?:[-*•▪‣]|\d+[.)])\s+/;

/** Normalize multiline job duties or requirements for storage as simple readable bullets. */
export function formatJobBulletItems(value: string): string {
  const items = value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(line => line.trim().replace(leadingBullet, "").trim())
    .filter(Boolean);
  return items.map(item => `• ${item}`).join("\n");
}
