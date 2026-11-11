// Apple Pay-only store benefits (Nov 10 2026 in-app feedback: "apple card is
// 3% on uber"). Mirrors ApplePayBenefitTests in the iOS app.
import { describe, it, expect } from "vitest";
import { recommend } from "../src/engine.js";
import { makeValuation } from "../src/valuation.js";
import type { CreditCard, Override } from "../src/model.js";

const apple: CreditCard = { id: "apple_card", displayName: "Apple Card", issuer: "Goldman Sachs",
  rewardCurrency: "cashback", multipliers: { general: 1 } as any };
const row = (merchant: string, label: string): Override => ({ id: `apple_${merchant}`, cardId: "apple_card",
  category: "general", bonusRate: 3, startDate: "2020-01-01", endDate: "2099-12-31",
  requiresActivation: false, label, merchant });
const overrides = [row("Apple", "Apple Card: 3% at Apple"), row("Uber", "Apple Card: 3% with Apple Pay")];
const ask = (name: string, category: any) => recommend({ cards: [apple], category, merchantName: name, overrides,
  valuation: makeValuation("cash"), now: new Date("2026-11-10T12:00:00Z") }) as any;

describe("Apple Pay-only store benefits", () => {
  it("Uber names Apple Pay in the reason, the line and the caveat", () => {
    const r = ask("Uber", "transit");
    expect(r.rateDisplay).toBe("3%");
    expect(r.reason).toContain("when you pay with Apple Pay");
    expect(r.breakdownLines.join("\n")).toContain("with Apple Pay · card benefit");
    expect(r.caveat).toBe("Pay with Apple Pay to get 3%. Paid any other way, Apple Card earns 1% here.");
  });
  it("Apple itself has no condition", () => {
    const r = ask("Apple", "general");
    expect(r.reason).not.toContain("Apple Pay");
    expect(r.caveat ?? null).toBeNull();
  });
});
