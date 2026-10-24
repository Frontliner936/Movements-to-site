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

function deadlineDateKey(value: string): string | null {
  const iso = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const written = value.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!written) return null;
  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const month = months.indexOf(written[2].toLowerCase());
  if (month < 0) return null;
  const date = new Date(Date.UTC(Number(written[3]), month, Number(written[1])));
  if (date.getUTCFullYear() !== Number(written[3]) || date.getUTCMonth() !== month || date.getUTCDate() !== Number(written[1])) return null;
  return `${written[3]}-${String(month + 1).padStart(2, "0")}-${written[1].padStart(2, "0")}`;
}

export function formatJobDeadline(value: string): string {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (!match) return value;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

export function jobDeadlineLabel(value: string, today = new Date()): string {
  const dateKey = deadlineDateKey(value);
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const date = formatJobDeadline(value);
  return dateKey && dateKey < todayKey ? `Closed on ${date}` : `Closes ${date}`;
}
