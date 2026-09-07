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

export function overrideFromRow(r: any): Override {
  return {
    id: String(r.id), cardId: r.card_id, category: r.category, bonusRate: Number(r.bonus_rate),
    startDate: r.start_date, endDate: r.end_date, requiresActivation: !!r.requires_activation,
    label: r.label ?? null, merchant: r.merchant ?? null,
  };
}

/** UTC-day canon (SupabaseDateFormat.utcCalendar): compare yyyy-MM-dd strings as UTC days. */
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
      return `${m.displayName} usually codes as a superstore (not a supermarket), so grocery bonuses often don't post — this is your best guaranteed card.`;
    case "warehouse_club": {
      const base = `${m.displayName} codes as a warehouse club, so category bonuses usually don't post — this is your best guaranteed card.`;
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
        return "Costco takes Visa only at the register — this is your best card that works in-store. Other networks work on Costco.com.";
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
