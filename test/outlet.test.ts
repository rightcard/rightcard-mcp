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
  it("Polo Ralph Lauren is Ralph Lauren", () => {
    expect(merchantMatchesStrict("ralph lauren", "Polo Ralph Lauren Factory Store")).toBe(true);
    expect(merchantMatches("ralph lauren", "Polo Ralph Lauren Factory Store")).toBe(true);
    expect(merchantMatchesStrict("ralph lauren", "Polo Grill")).toBe(false);
  });
  it("Under Armour Factory House is Under Armour", () => {
    expect(merchantMatchesStrict("under armour", "Under Armour Factory House")).toBe(true);
    expect(merchantMatchesStrict("under armour", "Under Armour House")).toBe(false);
  });
  it("Factory alone is a different brand", () => {
    expect(merchantMatchesStrict("j.crew", "J.Crew Factory")).toBe(false);
    expect(merchantMatchesStrict("cheesecake", "The Cheesecake Factory")).toBe(false);
  });
});
