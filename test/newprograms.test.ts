import { describe, it, expect } from "vitest";
import { inferProgram, TRAVEL_CPP } from "../src/valuation.js";

// Mirrors RightCardTests/NewProgramTests.swift (Nov 27 2026 coverage pass).
const cases: [string, string, string, number][] = [
  ["bank_of_america_air_france_klm_visa_signature", "Bank of America", "flyingBlue", 1.3],
  ["barclays_lufthansa_miles_more_world_elite_mastercard", "Barclays", "lufthansa", 1.3],
  ["synchrony_cathay_world_elite_mastercard", "Synchrony", "cathay", 1.2],
  ["u_s_bank_korean_air_skypass_visa", "U.S. Bank", "koreanAir", 1.3],
  ["cardless_avianca_lifemiles_american_express_card", "Cardless", "lifemiles", 1.3],
  ["imprint_turkish_airlines_miles_smiles_premier_visa_signature", "Imprint", "turkish", 1.2],
  ["synchrony_virgin_red_rewards_mastercard", "Synchrony", "virginRed", 1.4],
  ["barclays_frontier_airlines_world_mastercard", "Barclays", "frontier", 1.1],
  ["first_bank_trust_best_western_rewards_visa_signature_card", "First Bank & Trust", "bestWestern", 0.6],
  ["cardless_qatar_airways_privilege_club_visa_signature_credit_card", "Cardless", "avios", 1.2],
  ["chase_iberia_visa_signature_card", "Chase", "avios", 1.2],
  ["chase_aer_lingus_visa_signature_card", "Chase", "avios", 1.2],
  ["barclays_breeze_easy_visa_signature", "Barclays", "fixedValue", 1.0],
  ["bread_financial_caesars_rewards_visa_signature", "Bread Financial", "fixedValue", 1.0],
];

describe("new co-brand programs", () => {
  for (const [id, issuer, program, cpp] of cases) {
    it(id, () => {
      const p = inferProgram(issuer, id, "points");
      expect(p).toBe(program);
      expect(TRAVEL_CPP[p]).toBe(cpp);
    });
  }
});
