// A store benefit scoped to one category (Nov 10 2026): Costco Anywhere Visa
// pays 5% on gas at Costco (citi.com) but 2% at the warehouse. Mirrors
// CostcoGasBenefitTests in the iOS app.
import { describe, it, expect } from "vitest";
import { recommend } from "../src/engine.js";
import { makeValuation } from "../src/valuation.js";
import { exclusionCaveat, type CreditCard, type Override } from "../src/model.js";

const costco: CreditCard = { id: "citi_costco_anywhere", displayName: "Costco Anywhere Visa Card by Citi",
  issuer: "Citi", rewardCurrency: "cashback", multipliers: { general: 1, gas: 4, dining: 3 } as any, network: "visa" };
const row = (merchant: string, category: string, rate: number): Override => ({ id: `${merchant}-${category}`,
  cardId: costco.id, category, bonusRate: rate, startDate: "2020-01-01", endDate: "2099-12-31",
  requiresActivation: false, label: category === "gas" ? "Costco Anywhere Visa: 5% on gas at Costco" : "Costco Anywhere Visa: 2% at Costco", merchant });
const overrides = [row("Costco", "general", 2), row("Costco Gas", "gas", 5)];
const ask = (name: string, category: any) => (recommend({ cards: [costco], category, merchantName: name, overrides,
  valuation: makeValuation("cash"), now: new Date("2026-11-10T12:00:00Z") }) as any).rateDisplay;

describe("Costco gas", () => {
  it("5% at Costco Gas", () => expect(ask("Costco Gas", "gas")).toBe("5%"));
  it("the warehouse keeps 2%", () => expect(ask("Costco", "general")).toBe("2%"));
  it("other stations keep 4%", () => expect(ask("Shell", "gas")).toBe("4%"));
  it("the $7,000 gas limit covers the 5% too", () => {
    const r = recommend({ cards: [costco], category: "gas", merchantName: "Costco Gas", overrides,
      valuation: makeValuation("cash"), now: new Date("2026-11-10T12:00:00Z") }) as any;
    expect(r.capLimit ?? "").toContain("7,000");
  });
  it("the gas-station warning talks about the pump", () => {
    const m = { id: "costco_gas", displayName: "Costco Gas", category: "gas", subKey: null, isOnline: false,
      aliases: [], merchantType: "gas" } as any;
    expect(exclusionCaveat(m)).toBe("Costco gas stations take Visa only. This is your best card that works at the pump.");
  });
});
