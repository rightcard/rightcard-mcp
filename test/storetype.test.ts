// Store-type quarters (Discover Q4 2026: entertainment + utilities) apply at a
// store whose directory merchant_type they cover. Mirrors StoreTypeQuarterTests
// in the iOS app. The parity golden never passes a merchant type, so without
// this file the two engines could drift on this rule silently.
import { describe, it, expect } from "vitest";
import { recommend } from "../src/engine.js";
import { makeValuation } from "../src/valuation.js";
import type { CreditCard, Override } from "../src/model.js";

const card = (id: string, name: string, mults: Record<string, number>): CreditCard =>
  ({ id, displayName: name, issuer: id === "discover_it" ? "Discover" : null, rewardCurrency: "cashback",
     multipliers: Object.fromEntries(Object.entries(mults).map(([k, v]) => [k, v])) as any });
const q4 = (id: string, category: string): Override =>
  ({ id, cardId: "discover_it", category, bonusRate: 5, startDate: "2026-10-01", endDate: "2026-12-31",
     requiresActivation: true, label: null, merchant: null });
const cards = [card("discover_it", "Discover it Cash Back", { general: 1 }),
               card("cfu", "Chase Freedom Unlimited", { general: 1.5, dining: 3 })];
const overrides = [q4("d1", "dining"), q4("d2", "entertainment"), q4("d3", "utilities")];
const now = new Date("2026-10-12T12:00:00Z");
const ask = (merchantName: string | null, merchantType: string | null) =>
  recommend({ cards, category: "general", merchantName, overrides, valuation: makeValuation("cash"), now, merchantType });

describe("store-type quarters", () => {
  it("AMC Theatres answers Discover 5% when the directory calls it entertainment", () => {
    const r = ask("AMC Theatres", "entertainment");
    expect(r?.cardId).toBe("discover_it");
    expect(r?.rateDisplay).toBe("5%");
    expect(r?.reason).toContain("at AMC Theatres");
  });
  it("a phone bill answers the utilities quarter", () => {
    expect(ask("Verizon", "telecom")?.cardId).toBe("discover_it");
  });
  it("without a store type, or on a category ask, the row never applies", () => {
    expect(ask("Some Cinema", null)?.cardId).toBe("cfu");
    expect(ask("Target", "superstore")?.cardId).toBe("cfu");
    expect(ask(null, "entertainment")?.cardId).toBe("cfu");
  });
  it("a utilities answer says how to pay and names both apps", () => {
    const r = ask("PSEG", "utility");
    expect(r?.cardId).toBe("discover_it");
    expect(r?.breakdownLines.join(" ")).toContain("online or by phone");
    expect(r?.reason).toContain("Capital One or Discover app");
    expect(ask("AMC Theatres", "entertainment")?.breakdownLines.join(" ")).not.toContain("online or by phone");
  });
  it("a capped quarter states its limit and who wins after it", () => {
    const r = ask("AMC Theatres", "entertainment");
    expect(r?.capLimit).toBe("5% on your first $1,500 this quarter, across all its bonus categories. Then 1%.");
    expect(r?.afterLimit).toBe("Once it's used up: Chase Freedom Unlimited, 1.5%.");
  });
});
