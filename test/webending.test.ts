// A search can't match across a web address's dot: "tesco" sat inside
// "emiratesCOm" (Oct 26 2026). Mirrors aSearchNeverMatchesAcrossAWebAddressDot
// in the iOS app.
import { describe, it, expect } from "vitest";
import { matchScore, searchForms, searchNormalized, compactForm, droppingWebEnding } from "../src/search.js";

const score = (q: string, names: string[]) =>
  matchScore(searchNormalized(q), compactForm(searchNormalized(q)), q, names.map(searchForms));

describe("web endings", () => {
  it("never matches across the dot", () => {
    expect(score("tesco", ["Emirates", "emirates.com"])).toBeNull();
    expect(score("emirates", ["Emirates", "emirates.com"])).not.toBeNull();
    expect(score("lmart", ["Walmart", "walmart.com"])).not.toBeNull();
  });
  it("drops only a real web ending", () => {
    expect(droppingWebEnding("costco.co.uk")).toBe("costco");
    expect(droppingWebEnding("bjs.com/pharmacy")).toBe("bjs");
    expect(droppingWebEnding("Dr.Martens")).toBe("Dr.Martens");
    expect(droppingWebEnding("Pret A Manger")).toBe("Pret A Manger");
  });
});
