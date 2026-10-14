// Mirrors Models/CreditCard.swift, Models/SpendCategory.swift, SupabaseModels.swift.
// Every rule here has a Swift twin; parity is enforced by test/parity.test.ts.

export type SpendCategory =
  | "dining" | "grocery" | "travel" | "gas" | "online" | "drugstore" | "transit" | "streaming" | "general";

export const ALL_CATEGORIES: SpendCategory[] =
  ["dining", "grocery", "travel", "gas", "online", "drugstore", "transit", "streaming", "general"];

export const CATEGORY_DISPLAY: Record<SpendCategory, string> = {
  dining: "Dining", grocery: "Grocery", travel: "Travel", gas: "Gas", online: "Online",
  drugstore: "Drugstores", transit: "Transit", streaming: "Streaming", general: "General",
};

export type RewardCurrency = "points" | "miles" | "cashback";

export const CURRENCY_DISPLAY: Record<RewardCurrency, string> = {
  points: "points", miles: "miles", cashback: "cash back",
};

export type MultiplierField = number | { default: number; values: Record<string, number> };

export interface CreditCard {
  id: string;
  displayName: string;
  issuer: string | null;
  rewardCurrency: RewardCurrency | null;
  multipliers: Record<string, MultiplierField>;
  annualFee?: number | null;
  verifyStatus?: string | null;
  /** Payment network (migration 0017): visa|mastercard|amex|discover; null = unknown, never gates. */
  network?: string | null;
}

/** Supabase `cards` row → CreditCard (SupabaseCard.toCreditCard). */
export function cardFromRow(row: any): CreditCard {
  const multipliers: Record<string, MultiplierField> = {};
  const sm = row.standard_multipliers ?? {};
  for (const [k, v] of Object.entries(sm)) {
    const key = k === "other" ? "general" : k;
    multipliers[key] = fieldFromJSON(v);
  }
  if (multipliers["general"] === undefined) multipliers["general"] = Number(row.base_rate ?? 1);
  const cur = row.reward_currency;
  return {
    id: row.id,
    displayName: row.name,
    issuer: row.issuer ?? null,
    rewardCurrency: cur === "points" || cur === "miles" || cur === "cashback" ? cur : null,
    multipliers,
    annualFee: row.annual_fee ?? null,
    verifyStatus: row.verify_status ?? null,
    network: row.network ?? null,
  };
}

function fieldFromJSON(v: any): MultiplierField {
  if (typeof v === "number") return v;
  if (v && typeof v === "object") {
    const values: Record<string, number> = {};
    let def = 1;
    for (const [k, x] of Object.entries(v)) {
      if (k === "default") def = Number(x);
      else values[k] = Number(x);
    }
    return { default: def, values };
  }
  return 1;
}

function normalizeSubKey(subKey: string | null | undefined): string | null {
  if (!subKey || subKey.trim() === "") return null;
  let s = subKey.trim().toLowerCase().replace(/-/g, "_").replace(/ /g, "_");
  if (s === "instore" || s === "in_store" || s === "in_store_") return "in_store";
  return s;
}

function fieldValue(f: MultiplierField, subKey: string | null): number {
  if (typeof f === "number") return f;
  if (subKey == null) return f.default;
  const k = subKey.trim().toLowerCase().replace(/-/g, "_").replace(/ /g, "_");
  return f.values[k] ?? f.default;
}

/** CreditCard.multiplier(for:subKey:) — direct key → "other" for general → "general" → 1.0 */
export function multiplier(card: CreditCard, category: SpendCategory, subKey?: string | null): number {
  const key = category; // multiplierKey == rawValue for every case
  const sub = normalizeSubKey(subKey);
  const direct = card.multipliers[key];
  if (direct !== undefined) return fieldValue(direct, sub);
  if (key === "general" && card.multipliers["other"] !== undefined) return fieldValue(card.multipliers["other"], null);
  if (card.multipliers["general"] !== undefined) return fieldValue(card.multipliers["general"], null);
  return 1.0;
}

/** CreditCard.hasAnyReward */
export function hasAnyReward(card: CreditCard): boolean {
  return Object.values(card.multipliers).some((f) =>
    typeof f === "number" ? f > 1.0 : f.default > 1.0 || Object.values(f.values).some((v) => v > 1.0));
}

export interface Override {
  id: string;
  cardId: string;
  category: string;
  bonusRate: number;
  startDate: string; // yyyy-MM-dd
  endDate: string;
  requiresActivation: boolean;
  label: string | null;
  merchant: string | null;
}

/** Quarter categories that are not spend categories, mapped to the directory
 *  merchant_type values they cover (Discover Q4 2026 entertainment/utilities).
 *  Mirrors SupabaseOverride.storeTypeCategories in the app. */
export const STORE_TYPE_CATEGORIES: Record<string, string[]> = {
  entertainment: ["entertainment"],
  utilities: ["telecom", "utility"],
};

/** The store types a row applies to, or null for a category/merchant row. */
export function storeTypes(o: Override): string[] | null {
  if (o.merchant && o.merchant !== "") return null;
  return STORE_TYPE_CATEGORIES[o.category.trim().toLowerCase()] ?? null;
}

/** A card's rotating limit (mirrors RotatingCap in the app): Chase and Discover
 *  $1,500 of combined spend a quarter; Citi Dividend $300 back a year. */
export type RotatingCap = { kind: "spendPerQuarter" | "cashBackPerYear"; amount: number };
export function rotatingCap(cardId: string): RotatingCap | null {
  switch (cardId.toLowerCase()) {
    case "chase_freedom": case "chase_freedom_flex": case "discover_it":
    case "discover_discover_it_student_cash_back": case "discover_nhl_credit_card":
      return { kind: "spendPerQuarter", amount: 1500 };
    case "citi_dividend":
      return { kind: "cashBackPerYear", amount: 300 };
    default:
      return null;
  }
}

/** A STANDING category cap (mirrors StandingCap in the app, Oct 14 2026):
 *  the bonus stops after a spend amount and comes back next period. Quoted
 *  from each issuer page; see the Swift table for the quotes. */
export type CapPeriod = "quarter" | "calendarYear" | "cardYear" | "billingCycle";
export type StandingCap = {
  id: string; categories: SpendCategory[]; everything?: boolean; chosen?: boolean;
  limit: number; period: CapPeriod; after?: number;
};
export function standingCaps(cardId: string): StandingCap[] {
  switch (cardId.toLowerCase()) {
    case "amex_gold":
      return [{ id: "dining", categories: ["dining"], limit: 50000, period: "calendarYear", after: 1 },
              { id: "grocery", categories: ["grocery"], limit: 25000, period: "calendarYear", after: 1 }];
    case "amex_blue_cash_everyday":
      return [{ id: "grocery", categories: ["grocery"], limit: 6000, period: "calendarYear", after: 1 },
              { id: "online", categories: ["online"], limit: 6000, period: "calendarYear", after: 1 },
              { id: "gas", categories: ["gas"], limit: 6000, period: "calendarYear", after: 1 }];
    case "amex_blue_cash_preferred":
      return [{ id: "grocery", categories: ["grocery"], limit: 6000, period: "calendarYear", after: 1 }];
    case "american_express_blue_business_cash_card_from_american_express":
      return [{ id: "all", categories: [], everything: true, limit: 50000, period: "calendarYear", after: 1 }];
    case "sams_club_mastercard":
      return [{ id: "gas", categories: ["gas"], limit: 6000, period: "calendarYear", after: 1 }];
    case "citi_costco_anywhere":
      return [{ id: "gas", categories: ["gas"], limit: 7000, period: "calendarYear", after: 1 }];
    case "marriott_boundless":
      return [{ id: "combined", categories: ["grocery", "gas", "dining"], limit: 6000, period: "cardYear", after: 2 }];
    case "southwest_plus":
      return [{ id: "combined", categories: ["gas", "grocery"], limit: 5000, period: "cardYear", after: 1 }];
    case "chase_southwest_premier":
      return [{ id: "combined", categories: ["grocery", "dining"], limit: 8000, period: "cardYear", after: 1 }];
    case "chase_ink_business_preferred_credit_card":
      return [{ id: "combined", categories: ["travel", "transit"], limit: 150000, period: "cardYear", after: 1 }];
    case "discover_discover_it_chrome": case "discover_discover_it_student_chrome":
      return [{ id: "combined", categories: ["gas", "dining"], limit: 1000, period: "quarter", after: 1 }];
    case "u_s_bank_altitude_go_visa_signature_credit_card": case "u_s_bank_altitude_go_secured_visa_credit_card":
      return [{ id: "dining", categories: ["dining"], limit: 2000, period: "quarter", after: 1 }];
    case "u_s_bank_altitude_connect_visa_signature_credit_card": case "usbank_altitude_connect":
      return [{ id: "gas", categories: ["gas"], limit: 1000, period: "quarter", after: 1 }];
    case "bofa_customized_cash":
      return [{ id: "combined", categories: ["grocery"], chosen: true, limit: 2500, period: "quarter", after: 1 }];
    case "bank_of_america_bank_of_america_business_advantage_customized_cash_rewards":
      return [{ id: "combined", categories: ["dining"], chosen: true, limit: 50000, period: "calendarYear", after: 1 }];
    case "citi_custom_cash":
      return [{ id: "chosen", categories: [], chosen: true, limit: 500, period: "billingCycle", after: 1 }];
    default:
      return [];
  }
}
export function capCovers(cap: StandingCap, category: SpendCategory, chosen: boolean): boolean {
  return !!cap.everything || cap.categories.includes(category) || (!!cap.chosen && chosen);
}

export function overrideFromRow(r: any): Override {
  return {
    id: String(r.id), cardId: r.card_id, category: r.category, bonusRate: Number(r.bonus_rate),
    startDate: r.start_date, endDate: r.end_date, requiresActivation: !!r.requires_activation,
    label: r.label ?? null, merchant: r.merchant ?? null,
  };
}

/** Compare yyyy-MM-dd strings as UTC days.
 *
 *  The iOS app judges windows in the USER'S calendar date (Sep 13 2026: an offer
 *  or quarter marked 9/30 is live through the end of 9/30 where the user is).
 *  This server has no user timezone, so it keeps UTC; the two can differ only
 *  inside the few hours around midnight on a window's first or last day. The
 *  golden fixture is exported at noon UTC so parity is unaffected. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function overrideIsActive(o: Override, now: Date): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(o.endDate)) return false;
  const today = utcDay(now);
  return today >= o.startDate && today <= o.endDate;
}

/** SupabaseOverride.isPermanentMerchantBenefit: merchant-scoped, no activation, ends > 2 years out. */
export function isPermanentMerchantBenefit(o: Override, now: Date): boolean {
  if (!o.merchant || o.merchant === "" || o.requiresActivation) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.endDate)) return false;
  const twoYears = new Date(Date.UTC(now.getUTCFullYear() + 2, now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(o.endDate + "T00:00:00Z");
  return end.getTime() > twoYears.getTime();
}

export interface Merchant {
  id: string;
  displayName: string;
  category: SpendCategory;
  subKey: string | null;
  isOnline: boolean;
  aliases: string[];
  merchantType: string | null;
}

export function merchantFromRow(r: any): Merchant {
  const cat = ALL_CATEGORIES.includes(r.category) ? (r.category as SpendCategory) : "general";
  return {
    id: r.id, displayName: r.display_name, category: cat, subKey: r.sub_key ?? null,
    isOnline: !!r.is_online, aliases: Array.isArray(r.aliases) ? r.aliases : [], merchantType: r.merchant_type ?? null,
  };
}

/** Merchant.exclusionCaveat */
export function exclusionCaveat(m: Merchant): string | null {
  switch (m.merchantType) {
    case "superstore":
      return `${m.displayName} usually codes as a superstore (not a supermarket), so grocery bonuses often don't post. This is your best guaranteed card.`;
    case "warehouse_club": {
      const base = `${m.displayName} codes as a warehouse club, so category bonuses usually don't post. This is your best guaranteed card.`;
      // Costco alone is also NETWORK-locked: warehouse registers take Visa
      // only (Costco.com takes other networks). Mirrors the Swift engine —
      // keep both sides identical or the parity gate fails.
      if (m.displayName.toLowerCase().includes("costco")) {
        return base + " Note: Costco warehouses take Visa only at the register; other networks work on Costco.com.";
      }
      return base;
    }
    default:
      // Physical Costco DEPARTMENTS (pharmacy / gas / tire / …) share the
      // warehouse's Visa-only registers; their own MCC stays honest (no
      // "bonuses don't post" clause). Mirrors the Swift engine (Sep 2026).
      if (acceptedNetworksAtRegister(m) !== null) {
        return "Costco takes Visa only at the register. This is your best card that works in-store. Other networks work on Costco.com.";
      }
      return null;
  }
}

/** Merchant.acceptedNetworksAtRegister — Costco's Visa-only register lock.
 *  EVERY physical Costco row (checkout, pharmacy, gas, tire) is Visa-only
 *  for credit; null for everything else (no restriction). Costco.com /
 *  online rows are never gated (they take other networks). Mirrors the
 *  Swift twin exactly. */
export function acceptedNetworksAtRegister(m: Merchant): Set<string> | null {
  const name = m.displayName.toLowerCase();
  if (!name.includes("costco")) return null;
  // NAME is the online signal, deliberately not isOnline — the LLM-minted
  // flag is noise on this family (costco_pharmacy sat is_online=true).
  // Mirrors the Swift twin exactly.
  if (name.includes(".com") || name.includes("online")) return null;
  return new Set(["visa"]);
}

/** Merchant.isCuratedBrand */
export function isCuratedBrand(m: Merchant): boolean {
  if (m.aliases.length > 0) return true;
  if (m.merchantType && m.merchantType !== "standard") return true;
  return false;
}
