import { describe, expect, it } from "vitest";
import { encodeStoredCategories, jobMatchesPositions, parseStoredList, splitStoredCategories } from "./alert-preferences";

describe("alert preference storage", () => {
  it("keeps positions apart from categories without a new database column", () => {
    const stored = encodeStoredCategories(["Healthcare"], ["Nurse", "Finance Officer"]);
    expect(JSON.parse(stored)).toEqual(["Healthcare", "position:Nurse", "position:Finance Officer"]);
    expect(splitStoredCategories(stored)).toEqual({ categories: ["Healthcare"], positions: ["Nurse", "Finance Officer"] });
  });

  it("reads rows saved before positions existed as plain categories", () => {
    expect(splitStoredCategories('["Education","Finance"]')).toEqual({ categories: ["Education", "Finance"], positions: [] });
  });

  it("ignores unusable stored values", () => {
    expect(parseStoredList("not json")).toEqual([]);
    expect(parseStoredList(null)).toEqual([]);
    expect(splitStoredCategories('["position:  ", 5, "", "Health"]')).toEqual({ categories: ["Health"], positions: [] });
  });
});

describe("jobMatchesPositions", () => {
  it("matches a keyword in the job title or category, ignoring case", () => {
    expect(jobMatchesPositions({ title: "Senior ACCOUNTANT - Dar es Salaam", category: "Finance" }, ["accountant"])).toBe(true);
    expect(jobMatchesPositions({ title: "Programme Officer", category: "Finance & Accounting" }, ["finance"])).toBe(true);
  });

  it("does not match unrelated jobs or empty keywords", () => {
    expect(jobMatchesPositions({ title: "Driver", category: "Transport" }, ["Nurse"])).toBe(false);
    expect(jobMatchesPositions({ title: "Driver", category: "Transport" }, ["  "])).toBe(false);
    expect(jobMatchesPositions({ title: null, category: null }, ["Nurse"])).toBe(false);
  });
});
