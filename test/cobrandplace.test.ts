import { describe, expect, it } from "vitest";
import { merchantMatchesCoBrandBenefit as m } from "../src/matching.js";

// Mirrors RightCardTests/CoBrandPlaceWordTests.swift (Oct 21 2026).
describe("co-brand benefit place words", () => {
  it("sharing only a place word is a different store", () => {
    const wrong: [string, string][] = [
      ["Hilton Hotels & Resorts", "Hotels.com"], ["Hilton Hotels & Resorts", "W Hotels"],
      ["Hyatt Hotels", "OYO Hotels"], ["Holiday Inn Express", "Express"],
      ["Holiday Inn Express", "Express Inn"], ["Apple Store", "The UPS Store"],
      ["Apple App Store", "HP Store"], ["BJ's Wholesale Club", "Sam's Club"],
      ["United Airlines", "PSA Airlines"], ["British Airways", "Jet Airways"],
      ["Whole Foods Market", "Lao Market"], ["Hilton Garden Inn", "The Garden"],
      ["Crowne Plaza", "The Plaza"], ["Kimpton Hotels & Restaurants", "A&W Restaurants"],
      ["The Ritz-Carlton Hotel Company", "Ace Hotel"], ["Embassy Suites by Hilton", "Suites"],
    ];
    for (const [b, q] of wrong) expect(m(b, q), `${b} vs ${q}`).toBe(false);
  });
  it("the brand still matches its own stores", () => {
    const right: [string, string][] = [
      ["Hilton Hotels & Resorts", "Hilton Hotels & Resorts"], ["Hilton Hotels & Resorts", "Hilton"],
      ["Holiday Inn Express", "Holiday Inn Express"], ["Apple Store", "Apple"],
      ["BJ's Wholesale Club", "BJ's Wholesale Club"], ["United Airlines", "United"],
      ["Whole Foods Market", "Whole Foods"], ["Embassy Suites by Hilton", "Embassy Suites"],
      ["W Hotels", "W Hotels"], ["GMC", "GMC"], ["Amazon", "Amazon.com, Inc."],
    ];
    for (const [b, q] of right) expect(m(b, q), `${b} vs ${q}`).toBe(true);
    expect(m("Amazon", "Amazon Music")).toBe(false);
  });
});
