// TD Cash (Nov 19 2026): a 3% pick and a 2% pick. Mirrors TDCashTwoPicksTests.
import { describe, it, expect } from "vitest";
import { recommend } from "../src/engine.js";
import { makeValuation } from "../src/valuation.js";
import type { CreditCard } from "../src/model.js";

const td: CreditCard = { id: "td_bank_td_cash_credit_card", displayName: "TD Cash Credit Card", issuer: "TD Bank",
  rewardCurrency: "cashback", multipliers: { general: 1 } as any };
const flat: CreditCard = { id: "flat", displayName: "Flat 1.5", issuer: "X", rewardCurrency: "cashback",
  multipliers: { general: 1.5 } as any };
const ask = (category: any, configs: Record<string, Set<any>>) =>
  recommend({ cards: [td, flat], category, overrides: [], valuation: makeValuation("cash"), cardConfigs: configs,
              now: new Date("2026-11-19T12:00:00Z") });

describe("TD Cash two picks", () => {
  const picks = { "td_bank_td_cash_credit_card": new Set(["dining"]), "td_bank_td_cash_credit_card#2": new Set(["grocery"]) };
  it("each pick pays its own rate", () => {
    expect(ask("dining", picks)?.cardId).toBe("td_bank_td_cash_credit_card");
    expect(ask("dining", picks)?.rateDisplay).toBe("3%");
    expect(ask("grocery", picks)?.rateDisplay).toBe("2%");
    expect(ask("gas", picks)?.cardId).toBe("flat");
  });
  it("no picks = the everyday rate", () => {
    expect(ask("dining", {})?.cardId).toBe("flat");
  });
});
