// Mirrors Models/ConfigurableCard.swift — ORDER MATTERS (first match wins).
import type { CreditCard, SpendCategory } from "./model.js";

export interface ConfigurableCardSpec {
  key: string;
  displayName: string;
  bonusRate: number;
  slots: number;
  eligible: SpendCategory[];
  note: string;
  matchNeedles: string[];
  multiCardMax: number;
}

export const CONFIGURABLE_SPECS: ConfigurableCardSpec[] = [
  {
    key: "amex_business_gold", displayName: "Amex Business Gold", bonusRate: 4, slots: 2,
    eligible: ["dining", "gas", "travel"],
    note: "4× on the 2 categories your business spends the most on each billing cycle — from restaurants, gas, airfare, advertising, shipping & select tech — on up to $150,000/year (1× after). Of the categories RightCard tracks, pick the up-to-2 you expect: restaurants, gas, or airfare.",
    matchNeedles: ["businessgold"], multiCardMax: 1,
  },
  {
    key: "bofa_business_customized", displayName: "BofA Business Advantage Customized Cash", bonusRate: 3, slots: 1,
    eligible: ["gas", "travel"],
    note: "3% in your chosen business category (plus an automatic 2% at restaurants), on up to $50,000 in combined choice + dining purchases each year (1% after). Of the categories RightCard tracks, the choice is gas or travel — default gas.",
    matchNeedles: ["businessadvantagecustomized"], multiCardMax: 1,
  },
  {
    key: "bilt_obsidian", displayName: "Bilt Obsidian Card", bonusRate: 3, slots: 1,
    eligible: ["dining", "grocery"],
    note: "3× on your choice of dining OR grocery, set for the calendar year — pick the one you spend more on (grocery counts up to $25,000/year). Everything else earns 1×.",
    matchNeedles: ["obsidian"], multiCardMax: 1,
  },
  {
    key: "citi_custom_cash", displayName: "Citi Custom Cash", bonusRate: 5, slots: 1,
    eligible: ["dining", "grocery", "gas", "travel", "drugstore", "transit", "streaming"],
    note: "5% on your top eligible category, up to $500 each billing cycle (1% after). Citi applies it to your highest-spend category automatically — set the one you expect so RightCard recommends it.",
    matchNeedles: ["customcash"], multiCardMax: 3,
  },
  {
    key: "bofa_customized_cash", displayName: "Bank of America Customized Cash Rewards", bonusRate: 3, slots: 1,
    eligible: ["gas", "online", "dining", "travel", "drugstore"],
    note: "3% in your chosen category (plus 2% at grocery & wholesale clubs), on up to $2,500 in combined choice + grocery purchases each quarter (1% after).",
    matchNeedles: ["customized"], multiCardMax: 3,
  },
  {
    key: "venmo_credit_card", displayName: "Venmo Credit Card", bonusRate: 3, slots: 1,
    eligible: ["dining", "grocery", "gas", "travel", "transit"],
    note: "3% back on the category you spend most in each month (2% on your second, 1% everywhere else). Venmo applies the tiers automatically from your actual spending — set the category you expect to top so RightCard recommends it there. The 2% tier isn't modeled.",
    matchNeedles: ["venmo"], multiCardMax: 1,
  },
];

/** ConfigurableCardCatalog.normalize: lowercase, "+" → "plus", strip non-alphanumerics. */
export function normalizeConfigurable(s: string): string {
  return s.toLowerCase().replace(/\+/g, "plus").replace(/[^\p{L}\p{N}]/gu, "");
}

export function specFor(card: CreditCard): ConfigurableCardSpec | null {
  const hay = normalizeConfigurable(card.id) + normalizeConfigurable(card.displayName);
  return CONFIGURABLE_SPECS.find((spec) => spec.matchNeedles.some((n) => hay.includes(n))) ?? null;
}

export const isConfigurable = (card: CreditCard) => specFor(card) !== null;
