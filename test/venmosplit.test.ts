// Venmo split its card in Oct 2026. The new dining & entertainment card has
// fixed rates and must not pick up the old card's "top category" setup just
// because its name says Venmo. Mirrors CategoriesTests in the iOS app.
import { describe, it, expect } from "vitest";
import { specFor } from "../src/configurable.js";
import type { CreditCard } from "../src/model.js";

const card = (id: string, displayName: string): CreditCard =>
  ({ id, displayName, issuer: "Venmo", rewardCurrency: "cashback", multipliers: {} });

describe("venmo split", () => {
  it("binds the top-category setup to the old card only", () => {
    expect(specFor(card("venmo_credit_card", "Venmo Credit Card (top category)"))?.key).toBe("venmo_credit_card");
    expect(specFor(card("venmo_credit_card_dining", "Venmo Credit Card (dining & entertainment)"))).toBeNull();
  });
});
