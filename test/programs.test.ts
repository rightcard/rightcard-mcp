// Program inference pins that the parity golden can't reach: its wallets hold
// no card from these issuers in Points & miles mode, so a missing needle
// passes parity silently (found Oct 5 2026 with Navy Federal). Each case
// mirrors RewardValuation.infer in the iOS app.
import { describe, it, expect } from "vitest";
import { inferProgram } from "../src/valuation.js";

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
});
