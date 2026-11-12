// Program inference pins that the parity golden can't reach: its wallets hold
// no card from these issuers in Points & miles mode, so a missing needle
// passes parity silently (found Oct 5 2026 with Navy Federal). Each case
// mirrors RewardValuation.infer in the iOS app.
import { describe, it, expect } from "vitest";
import { inferProgram, TRAVEL_CPP, pooledPrograms } from "../src/valuation.js";

describe("fixed-value programs", () => {
  it("Navy Federal points are worth a set 1¢, including the Amex-network card", () => {
    for (const id of ["navy_federal_visa_signature_flagship_rewards", "navy_federal_go_rewards",
                      "navy_federal_more_rewards_american_express"]) {
      expect(inferProgram("Navy Federal", id, "points"), id).toBe("fixedValue");
    }
    expect(inferProgram("Navy Federal", "navy_federal_cashrewards", "cashback")).toBe("cash");
  });
  it("Bank of America and PenFed points stay fixed-value; the Atmos co-brand stays Alaska", () => {
    expect(inferProgram("Bank of America", "bofa_premium_rewards", "points")).toBe("fixedValue");
    expect(inferProgram("PenFed", "penfed_pathfinder", "points")).toBe("fixedValue");
    expect(inferProgram("Bank of America", "bank_of_america_atmos_rewards_ascent_visa_signature", "points")).toBe("alaska");
  });
  it("the Hawaiian card earns Atmos points (HawaiianMiles became Atmos)", () => {
    expect(inferProgram("Barclays", "barclays_hawaiian_airlines", "miles")).toBe("alaska");
  });
  it("Wyndham points are their own program at 0.5¢, not the generic 2¢", () => {
    expect(inferProgram("Barclays", "barclays_wyndham_earner_plus", "points")).toBe("wyndham");
    expect(TRAVEL_CPP.wyndham).toBe(0.5);
  });
  it("a Strata Elite lets Citi cash cards pool; a World Elite co-brand doesn't", () => {
    const c = (id: string, name: string, cur: any) => ({ id, displayName: name, issuer: "Citi", rewardCurrency: cur,
      multipliers: { general: 1 } as any }) as any;
    const cc = c("citi_double_cash", "Citi Double Cash", "cashback");
    expect(pooledPrograms([cc, c("citi_citi_strata_elite_card", "Citi Strata Elite Card", "points")])[cc.id]).toBe("citiTYP");
    expect(pooledPrograms([cc, c("citi_aadvantage_platinum_select", "Citi AAdvantage Platinum Select World Elite Mastercard", "miles")])[cc.id]).toBeUndefined();
  });
  it("the plain no-fee Chase Sapphire is no unlock, but pools beside a Preferred", () => {
    const c = (id: string, name: string, cur: any) => ({ id, displayName: name, issuer: "Chase", rewardCurrency: cur,
      multipliers: { general: 1 } as any }) as any;
    const plain = c("chase_sapphire", "Chase Sapphire", "cashback");
    const flex = c("chase_freedom_flex", "Chase Freedom Flex", "cashback");
    expect(pooledPrograms([plain, flex])).toEqual({});
    expect(pooledPrograms([plain, c("chase_sapphire_preferred", "Chase Sapphire Preferred", "points")])[plain.id]).toBe("chaseUR");
  });
});
