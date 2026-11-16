// Amex took airfare off the Business Gold 4X list and added transit
// (americanexpress.com, read Nov 16 2026). Mirrors
// MerchantYieldEngineTests.amexBusinessGoldNoLongerPaysFourXOnAirfare in the iOS app.
import { describe, it, expect } from "vitest";
import { specFor } from "../src/configurable.js";
import type { CreditCard } from "../src/model.js";

const gold = { id: "american_express_american_express_business_gold_card",
  displayName: "American Express Business Gold Card", issuer: "American Express",
  rewardCurrency: "points", multipliers: {} } as unknown as CreditCard;

describe("amex business gold 4x list", () => {
  it("offers transit, not airfare", () => {
    const spec = specFor(gold);
    expect(spec?.key).toBe("amex_business_gold");
    expect(spec?.eligible).toEqual(["dining", "gas", "transit"]);
    expect(spec?.eligible).not.toContain("travel");
  });
});
