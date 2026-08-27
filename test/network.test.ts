// Network-acceptance gate — mirrors RightCardTests/NetworkAcceptanceTests.swift.
// Costco warehouses take Visa only at the register: a KNOWN-incompatible card
// can't win when a compatible card exists; unknown (null) network never gates;
// all-known-incompatible falls back to the best earner (Costco.com works).

import { describe, it, expect } from "vitest";
import { recommend } from "../src/engine.js";
import { makeValuation } from "../src/valuation.js";
import { acceptedNetworksAtRegister, type CreditCard, type Merchant } from "../src/model.js";

const NOW = new Date("2026-08-26T12:00:00Z");

function card(id: string, name: string, network: string | null, general: number): CreditCard {
  return { id, displayName: name, issuer: null, rewardCurrency: "cashback",
           multipliers: { general }, network };
}

// The exact MCP-demo wallet: none of the three is a Visa.
const demoWallet = [
  card("amex_gold", "Amex Gold", "amex", 1),
  card("chase_freedom_flex", "Freedom Flex", "mastercard", 1),
  card("citi_double_cash", "Citi Double Cash", "mastercard", 2),
];

function run(cards: CreditCard[], acceptedNetworks: Set<string> | null) {
  return recommend({ cards, category: "general", subKey: null, merchantName: "Costco",
                     overrides: [], valuation: makeValuation("cash"), now: NOW, acceptedNetworks });
}

describe("network acceptance gate", () => {
  it("falls back to the best earner when every card is known-incompatible", () => {
    const r = run(demoWallet, new Set(["visa"]));
    expect(r?.cardId).toBe("citi_double_cash");
    expect(r?.rateDisplay).toBe("2%");
  });

  it("a compatible card beats a higher-earning incompatible card", () => {
    const wallet = [...demoWallet, card("chase_freedom_unlimited", "Freedom Unlimited", "visa", 1.5)];
    const r = run(wallet, new Set(["visa"]));
    expect(r?.cardId).toBe("chase_freedom_unlimited");
  });

  it("unknown network is never gated", () => {
    const wallet = [
      card("citi_double_cash", "Citi Double Cash", null, 2),
      card("chase_freedom_unlimited", "Freedom Unlimited", "visa", 1.5),
    ];
    const r = run(wallet, new Set(["visa"]));
    expect(r?.cardId).toBe("citi_double_cash");
  });

  it("no restriction means no change", () => {
    const r = run(demoWallet, null);
    expect(r?.cardId).toBe("citi_double_cash");
  });
});

describe("acceptedNetworksAtRegister", () => {
  const m = (displayName: string, merchantType: string | null, isOnline = false): Merchant =>
    ({ id: "x", displayName, category: "general", subKey: null, isOnline, aliases: [], merchantType });

  it("locks only physical Costco rows", () => {
    expect(acceptedNetworksAtRegister(m("Costco", "warehouse_club"))).toEqual(new Set(["visa"]));
    expect(acceptedNetworksAtRegister(m("Costco.com", "warehouse_club"))).toBeNull();
    expect(acceptedNetworksAtRegister(m("Costco", "warehouse_club", true))).toBeNull();
    expect(acceptedNetworksAtRegister(m("Sam's Club", "warehouse_club"))).toBeNull();
    expect(acceptedNetworksAtRegister(m("Costco", null))).toBeNull();
  });
});
