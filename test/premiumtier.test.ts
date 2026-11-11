// Two premium levels (Nov 10 2026): Sapphire Reserve beats Sapphire Preferred
// on a tie, not the alphabet. Mirrors PremiumTierTests in the iOS app.
import { describe, it, expect } from "vitest";
import { recommend } from "../src/engine.js";
import { makeValuation } from "../src/valuation.js";
import type { CreditCard, Override } from "../src/model.js";

const csp: CreditCard = { id: "chase_sapphire_preferred", displayName: "Chase Sapphire Preferred", issuer: "Chase",
  rewardCurrency: "points", multipliers: { general: 1, dining: 3 } as any };
const csr: CreditCard = { id: "chase_sapphire_reserve", displayName: "Chase Sapphire Reserve", issuer: "Chase",
  rewardCurrency: "points", multipliers: { general: 1, dining: 3 } as any };
const lyft = (cardId: string): Override => ({ id: `${cardId}_lyft`, cardId, category: "general", bonusRate: 5,
  startDate: "2020-01-01", endDate: "2099-12-31", requiresActivation: false, label: "5x on Lyft rides", merchant: "Lyft" });
const ask = (category: any, merchantName: string | null = null) => recommend({ cards: [csp, csr], category,
  merchantName, overrides: [lyft(csp.id), lyft(csr.id)], valuation: makeValuation("smart"),
  now: new Date("2026-11-10T12:00:00Z") }) as any;

describe("premium tiers", () => {
  it("Reserve wins the Lyft tie", () => {
    const r = ask("transit", "Lyft");
    expect(r.cardId).toBe("chase_sapphire_reserve");
    expect(r.tieNote).toContain("purchase protection");
  });
  it("Reserve wins the dining tie", () => {
    expect(ask("dining").cardId).toBe("chase_sapphire_reserve");
  });
});
