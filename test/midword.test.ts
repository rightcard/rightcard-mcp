// Inside a word, a search only matches where it ENDS that word: "amaz"
// listed "Mamazzita Ecuadorian Cuisine" among the Amazon rows (Nov 25 2026).
// Mirrors midWordFragmentsDoNotMatch in the iOS app.
import { describe, it, expect } from "vitest";
import { matchScore, searchForms, searchNormalized, compactForm } from "../src/search.js";

const score = (q: string, names: string[]) =>
  matchScore(searchNormalized(q), compactForm(searchNormalized(q)), q, names.map(searchForms));

describe("mid-word fragments", () => {
  it("don't match", () => {
    expect(score("amaz", ["Mamazzita Ecuadorian Cuisine"])).toBeNull();
    expect(score("arden", ["Gardener's Supply"])).toBeNull();
    expect(score("ramen", ["Sacramento RT"])).toBeNull();
    expect(score("gree", ["Walgreens"])).toBeNull();
  });
  it("glued names still match at their end", () => {
    expect(score("disney", ["shopDisney"])).toBe(55);
    expect(score("burger", ["Wahlburgers"])).toBe(55);
    expect(score("hotel", ["Kimpton", "kimptonhotels.com"])).toBe(55);
    expect(score("greens", ["Walgreens"])).toBe(55);
    expect(score("apple", ["iTunes", "itunes.apple.com"])).toBe(55);
  });
});
