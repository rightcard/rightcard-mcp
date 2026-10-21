// Same-rate store benefits: the answer names the closest one. Mirrors
// BenefitNameTieBreakTests in the iOS app (Oct 21 2026, the wider Marriott list).
import { describe, it, expect } from "vitest";
import { recommend } from "../src/engine.js";
import { makeValuation } from "../src/valuation.js";
import type { CreditCard, Override } from "../src/model.js";

const card: CreditCard = { id: "chase_marriott_bonvoy_boundless", displayName: "Marriott Bonvoy Boundless",
  issuer: "Chase", rewardCurrency: "points", multipliers: { general: 2 } as any };
const overrides: Override[] = ["TownePlace Suites by Marriott", "Courtyard by Marriott", "Marriott", "Residence Inn by Marriott"]
  .map((m, i) => ({ id: `cobrand_marriott_${i}`, cardId: card.id, category: "travel", bonusRate: 6,
    startDate: "2020-01-01", endDate: "2099-12-31", requiresActivation: false,
    label: "Marriott Bonvoy Boundless: 6x at Marriott hotels", merchant: m }));
const text = (name: string) => {
  const r = recommend({ cards: [card], category: "travel", merchantName: name, overrides,
    valuation: makeValuation("cash"), now: new Date("2026-10-21T12:00:00Z") });
  return [r?.reason ?? "", ...((r as any)?.breakdownLines ?? [])].join("\n");
};

describe("same-rate store benefits", () => {
  it("the searched name wins a tie", () => {
    const t = text("Marriott");
    expect(t).toContain("at Marriott");
    expect(t).not.toContain("TownePlace");
  });
  it("a sub-brand search keeps its own name", () => {
    const t = text("Courtyard by Marriott");
    expect(t).toContain("Courtyard by Marriott");
    expect(t).not.toContain("TownePlace");
  });
});
