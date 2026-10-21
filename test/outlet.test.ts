// "Factory Outlet" after a brand (Oct 20 2026). Mirrors OutletOfferMatchTests
// in the iOS app: Express Factory Outlet is Express; J.Crew Factory is not J.Crew.
import { describe, it, expect } from "vitest";
import { merchantMatches, merchantMatchesStrict } from "../src/matching.js";

describe("outlet stores", () => {
  it("Factory Outlet after a brand is the same brand", () => {
    expect(merchantMatchesStrict("express", "Express Factory Outlet")).toBe(true);
    expect(merchantMatches("express", "Express Factory Outlet")).toBe(true);
    expect(merchantMatchesStrict("gap", "Gap Factory Store")).toBe(true);
  });
  it("Factory alone is a different brand", () => {
    expect(merchantMatchesStrict("j.crew", "J.Crew Factory")).toBe(false);
    expect(merchantMatchesStrict("cheesecake", "The Cheesecake Factory")).toBe(false);
  });
});
