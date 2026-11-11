// Premium ties (Nov 10 2026): the higher annual fee wins, then the alphabet.
// Mirrors PremiumTierTests in the iOS app.
import { describe, it, expect } from "vitest";
import { recommend } from "../src/engine.js";
import { makeValuation } from "../src/valuation.js";
import type { CreditCard, Override } from "../src/model.js";

const csp: CreditCard = { id: "chase_sapphire_preferred", displayName: "Chase Sapphire Preferred", issuer: "Chase",
  rewardCurrency: "points", multipliers: { general: 1, dining: 3 } as any, annualFee: 95 };
const csr: CreditCard = { id: "chase_sapphire_reserve", displayName: "Chase Sapphire Reserve", issuer: "Chase",
  rewardCurrency: "points", multipliers: { general: 1, dining: 3 } as any, annualFee: 795 };
const lyft = (cardId: string): Override => ({ id: `${cardId}_lyft`, cardId, category: "general", bonusRate: 5,
  startDate: "2020-01-01", endDate: "2099-12-31", requiresActivation: false, label: "5x on Lyft rides", merchant: "Lyft" });
const ask = (category: any, merchantName: string | null = null) => recommend({ cards: [csp, csr], category,
  merchantName, overrides: [lyft(csp.id), lyft(csr.id)], valuation: makeValuation("smart"),
  now: new Date("2026-11-10T12:00:00Z") }) as any;

describe("premium tiers", () => {
  it("Reserve wins the Lyft tie", () => {
    const r = ask("transit", "Lyft");
    expect(r.cardId).toBe("chase_sapphire_reserve");
    expect(r.tieNote).toContain("higher annual fee");
  });
  it("an unverified fee loses; the same fee falls to the alphabet", () => {
    const plat = (fee: number | null): CreditCard => ({ id: "amex_platinum", displayName: "The Platinum Card",
      issuer: "American Express", rewardCurrency: "points", multipliers: { general: 1 } as any, annualFee: fee });
    const gold = (fee: number | null): CreditCard => ({ id: "amex_gold", displayName: "American Express Gold Card",
      issuer: "American Express", rewardCurrency: "points", multipliers: { general: 1 } as any, annualFee: fee });
    const pick = (cards: CreditCard[]) => (recommend({ cards, category: "general", merchantName: null, overrides: [],
      valuation: makeValuation("smart"), now: new Date("2026-11-10T12:00:00Z") }) as any).cardId;
    expect(pick([gold(325), plat(895)])).toBe("amex_platinum");
    expect(pick([plat(null), gold(325)])).toBe("amex_gold");
    expect(pick([plat(895), gold(895)])).toBe("amex_gold");
  });
  it("Reserve wins the dining tie", () => {
    expect(ask("dining").cardId).toBe("chase_sapphire_reserve");
  });
});
