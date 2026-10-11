import { describe, expect, it } from "vitest";
import { decodeSocialPostDescription, encodeSocialPostDescription } from "./social-post-storage";

describe("social post description storage", () => {
  it("round-trips a raw post without changing its paragraphs or line breaks", () => {
    const raw = "VACANCY ANNOUNCEMENT\n\nApply by sending your CV to jobs@example.org\nCall +255 700 000 000";
    expect(decodeSocialPostDescription(encodeSocialPostDescription(raw))).toEqual({ isSocialPost: true, description: raw });
  });

  it("leaves ordinary descriptions untouched", () => {
    const description = "A normal job description.";
    expect(decodeSocialPostDescription(description)).toEqual({ isSocialPost: false, description });
  });

  it("handles an empty description safely", () => {
    expect(decodeSocialPostDescription(null)).toEqual({ isSocialPost: false, description: null });
  });
});
