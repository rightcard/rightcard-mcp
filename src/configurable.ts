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
  /** When set, only these card ids use the spec (needles ignored). Venmo split
   * its card in Oct 2026; both names contain "venmo". Mirrors the Swift spec. */
  exactIDs?: string[];
  multiCardMax: number;
  /** A second pick at a lower rate (TD Cash 2%), saved under "<card id>#2"
   * in the picks map. Mirrors ConfigurableCardSpec.secondTier (Nov 19 2026). */
  secondTier?: { rate: number; eligible: SpendCategory[] };
}

export const secondTierKey = (cardId: string) => cardId + "#2";

/** The second tier as a spec of its own, so an answer it wins reads at its own rate. */
export function secondTierSpec(spec: ConfigurableCardSpec): ConfigurableCardSpec | null {
  if (!spec.secondTier) return null;
  return { ...spec, key: spec.key + "#2", bonusRate: spec.secondTier.rate, slots: 1,
           eligible: spec.secondTier.eligible, secondTier: undefined, multiCardMax: 1 };
}

export const CONFIGURABLE_SPECS: ConfigurableCardSpec[] = [
  {
    // TD Cash (Nov 19 2026, td.com): a 3% pick and a 2% pick, changeable each quarter.
    key: "td_cash", displayName: "TD Cash", bonusRate: 3, slots: 1,
    eligible: ["dining", "entertainment", "gas", "grocery", "travel"],
    note: "TD Cash pays 3% in one category and 2% in another, from dining, entertainment, gas, groceries and travel. You can change both every quarter. A new card starts at 3% on dining and 2% on groceries.",
    matchNeedles: [], exactIDs: ["td_bank_td_cash_credit_card"], multiCardMax: 1,
    secondTier: { rate: 2, eligible: ["dining", "entertainment", "gas", "grocery", "travel"] },
  },
  {
    key: "amex_business_gold", displayName: "Amex Business Gold", bonusRate: 4, slots: 2,
    // Nov 16 2026: Amex took airfare off the 4X list and added transit (mirrors Swift).
    eligible: ["dining", "gas", "transit"],
    note: "4× on the 2 categories your business spends the most on each billing cycle (restaurants, gas, transit, wireless phone service, advertising and select electronics and software), on your first $150,000 of purchases a year (1× after). Amex picks them from your spending. So RightCard can show the bonus, pick the up-to-2 you expect: restaurants, gas, or transit.",
    // US card only: the UK and Canadian Business Gold cards have no top-2 picker.
    matchNeedles: [], exactIDs: ["american_express_american_express_business_gold_card"], multiCardMax: 1,
  },
  {
    key: "bofa_business_customized", displayName: "BofA Business Advantage Customized Cash", bonusRate: 3, slots: 1,
    eligible: ["gas", "travel"],
    note: "3% in your chosen business category (plus an automatic 2% at restaurants), on up to $50,000 in combined choice + dining purchases each year (1% after). Of the categories RightCard tracks, the choice is gas or travel. Gas is the default.",
    matchNeedles: ["businessadvantagecustomized"], multiCardMax: 1,
  },
  {
    key: "bilt_obsidian", displayName: "Bilt Obsidian Card", bonusRate: 3, slots: 1,
    eligible: ["dining", "grocery"],
    note: "3× on your choice of dining OR grocery, set for the calendar year. Pick the one you spend more on (grocery counts up to $25,000/year). Everything else earns 1×.",
    matchNeedles: ["obsidian"], multiCardMax: 1,
  },
  {
    key: "citi_custom_cash", displayName: "Citi Custom Cash", bonusRate: 5, slots: 1,
    eligible: ["dining", "grocery", "gas", "travel", "drugstore", "transit", "streaming"],
    note: "5% on your top eligible category, up to $500 each billing cycle (1% after). Citi applies it to your highest-spend category automatically. Set the one you expect so RightCard recommends it.",
    matchNeedles: ["customcash"], multiCardMax: 3,
  },
  {
    // Citi Strata: 3x on ONE Self-Select category (streaming by default; also
    // fitness clubs, live entertainment, cosmetic stores/salons, pet supply).
    // Only streaming is a category here; the app also takes the store picks.
    key: "citi_strata", displayName: "Citi Strata Card", bonusRate: 3, slots: 1,
    eligible: ["streaming"],
    note: "3x on the one category you picked at citi.com. Citi starts every card on streaming, and you can change it once a quarter. For gyms, salons, pet stores and live events, RightCard counts the big chains it knows. Other stores show 1x.",
    matchNeedles: ["citirewardsplus", "citistratacard"], multiCardMax: 1,
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
    note: "3% back on the category you spend most in each month (2% on your second, 1% everywhere else). Venmo applies the tiers automatically from your actual spending. Set the category you expect to top so RightCard recommends it there. The 2% tier isn't modeled.",
    matchNeedles: ["venmo"], multiCardMax: 1, exactIDs: ["venmo_credit_card"],
  },
];

/** ConfigurableCardCatalog.normalize: lowercase, "+" → "plus", strip non-alphanumerics. */
export function normalizeConfigurable(s: string): string {
  return s.toLowerCase().replace(/\+/g, "plus").replace(/[^\p{L}\p{N}]/gu, "");
}

export function specFor(card: CreditCard): ConfigurableCardSpec | null {
  const hay = normalizeConfigurable(card.id) + normalizeConfigurable(card.displayName);
  return CONFIGURABLE_SPECS.find((spec) =>
    spec.exactIDs ? spec.exactIDs.includes(card.id) : spec.matchNeedles.some((n) => hay.includes(n))) ?? null;
}

export const isConfigurable = (card: CreditCard) => specFor(card) !== null;
