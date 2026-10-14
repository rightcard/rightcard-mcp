// Standing category caps (Oct 14 2026). Mirrors StandingCapTests in the iOS
// app: the same cap table and the same sentences. The parity golden never
// carries cap lines, so without this file the two engines could drift.
import { describe, it, expect } from "vitest";
import { recommend } from "../src/engine.js";
import { makeValuation } from "../src/valuation.js";
import type { CreditCard } from "../src/model.js";

const card = (id: string, name: string, mults: Record<string, number>): CreditCard =>
  ({ id, displayName: name, issuer: null, rewardCurrency: "cashback", multipliers: mults as any });
const now = new Date("2026-10-12T12:00:00Z");
const bcp = card("amex_blue_cash_preferred", "Blue Cash Preferred", { general: 1, grocery: 6, gas: 3 });
const cfu = card("cfu", "Chase Freedom Unlimited", { general: 1.5, dining: 3 });
const ask = (cards: CreditCard[], category: any) =>
  recommend({ cards, category, overrides: [], valuation: makeValuation("cash"), now });

describe("standing caps", () => {
  it("states the cap and the card after it", () => {
    const r = ask([bcp, cfu], "grocery");
    expect(r?.capLimit).toBe("6% on your first $6,000 a year. Then 1%.");
    expect(r?.afterLimit).toBe("Once it's used up: Chase Freedom Unlimited, 1.5%.");
  });
  it("says nothing on an uncapped rate", () => {
    expect(ask([bcp, cfu], "gas")?.capLimit ?? null).toBeNull();
  });
  it("names a shared cap's categories and the rate after", () => {
    const b = card("marriott_boundless", "Marriott Bonvoy Boundless", { general: 2, grocery: 3, gas: 3, dining: 3 });
    expect(ask([b], "dining")?.capLimit).toBe("3% on your first $6,000 a year across dining, gas, and grocery combined. Then 2%.");
  });
  it("a quarterly shared cap", () => {
    const c = card("discover_discover_it_chrome", "Discover it Chrome", { general: 1, gas: 2, dining: 2 });
    expect(ask([c], "gas")?.capLimit).toBe("2% on your first $1,000 each quarter across dining and gas combined. Then 1%.");
  });
});
