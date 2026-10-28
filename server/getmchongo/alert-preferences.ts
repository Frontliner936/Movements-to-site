/**
 * Member job-alert preference helpers shared by the dashboard route and the email worker.
 *
 * Members can track categories, job positions / departments and locations. Categories and positions are
 * stored together in the existing `alert_categories` JSON array so no database migration is required:
 * a position is saved with a "position:" marker, e.g. ["Healthcare", "position:Nurse"].
 */

export const POSITION_PREFIX = "position:";
export const MAX_CATEGORIES = 30;
export const MAX_POSITIONS = 10;
export const MAX_POSITION_LENGTH = 100;
const MAX_STORED_ITEMS = MAX_CATEGORIES + MAX_POSITIONS;

export type AlertJobFields = { title?: string | null; category?: string | null; location?: string | null };

/** Parse a stored JSON string array into trimmed, de-duplicated, non-empty strings. */
export function parseStoredList(raw: string | null | undefined): string[] {
  try {
    const value = JSON.parse(raw ?? "[]");
    if (!Array.isArray(value)) return [];
    const items = value.filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean);
    return [...new Set(items)].slice(0, MAX_STORED_ITEMS);
  } catch { return []; }
}

/** Split the stored categories column into real categories and position / department keywords. */
export function splitStoredCategories(raw: string | null | undefined): { categories: string[]; positions: string[] } {
  const categories: string[] = [];
  const positions: string[] = [];
  for (const item of parseStoredList(raw)) {
    if (item.toLocaleLowerCase().startsWith(POSITION_PREFIX)) {
      const position = item.slice(POSITION_PREFIX.length).trim();
      if (position) positions.push(position);
    } else categories.push(item);
  }
  return { categories: categories.slice(0, MAX_CATEGORIES), positions: [...new Set(positions)].slice(0, MAX_POSITIONS) };
}

/** Combine categories and positions into the JSON string stored in `alert_categories`. */
export function encodeStoredCategories(categories: string[], positions: string[]): string {
  return JSON.stringify([...categories, ...positions.map(position => `${POSITION_PREFIX}${position}`)]);
}

/** A position / department keyword matches when it appears in the job title or category (case-insensitive). */
export function jobMatchesPositions(job: Pick<AlertJobFields, "title" | "category">, positions: string[]): boolean {
  const haystacks = [job.title, job.category].filter((value): value is string => typeof value === "string" && value.trim().length > 0).map(value => value.toLocaleLowerCase());
  return positions.some(position => {
    const needle = position.trim().toLocaleLowerCase();
    return needle.length > 0 && haystacks.some(text => text.includes(needle));
  });
}
