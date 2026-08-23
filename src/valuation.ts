// Mirrors Core/RewardValuation.swift: programs, cents-per-point, wallet pooling.
import type { CreditCard } from "./model.js";

export type ValuationMode = "cash" | "smart";

export type RewardProgram =
  | "cash" | "amexMR" | "chaseUR" | "capOneMiles" | "citiTYP" | "wellsFargo" | "bilt"
  | "tdRewards" | "scenePlus" | "rbcAvion" | "bmoRewards"
  | "hyatt" | "marriott" | "ihg" | "hilton"
  | "delta" | "united" | "american" | "southwest" | "jetBlue" | "alaska" | "avios" | "aeroplan"
  | "fixedValue" | "genericPoints" | "genericMiles";

export const PROGRAM_DISPLAY: Record<RewardProgram, string> = {
  cash: "Cash back", amexMR: "Amex Membership Rewards", chaseUR: "Chase Ultimate Rewards",
  capOneMiles: "Capital One miles", citiTYP: "Citi ThankYou Points", wellsFargo: "Wells Fargo Rewards",
  bilt: "Bilt Rewards", tdRewards: "TD Rewards", scenePlus: "Scene+", rbcAvion: "RBC Avion points",
  bmoRewards: "BMO Rewards", hyatt: "World of Hyatt", marriott: "Marriott Bonvoy", ihg: "IHG One Rewards",
  hilton: "Hilton Honors", delta: "Delta SkyMiles", united: "United MileagePlus",
  american: "American AAdvantage", southwest: "Southwest Rapid Rewards", jetBlue: "JetBlue TrueBlue",
  alaska: "Alaska Mileage Plan", avios: "British Airways Avios", aeroplan: "Air Canada Aeroplan",
  fixedValue: "Fixed-value miles", genericPoints: "Points", genericMiles: "Miles",
};

export const TRAVEL_CPP: Record<RewardProgram, number> = {
  cash: 1.0, amexMR: 2.0, chaseUR: 2.0, capOneMiles: 1.7, citiTYP: 1.7, wellsFargo: 1.5, bilt: 2.0,
  tdRewards: 0.5, scenePlus: 1.0, rbcAvion: 1.5, bmoRewards: 0.7,
  hyatt: 1.7, marriott: 0.7, ihg: 0.6, hilton: 0.5,
  delta: 1.1, united: 1.3, american: 1.4, southwest: 1.3, jetBlue: 1.3, alaska: 1.4, avios: 1.3, aeroplan: 1.3,
  fixedValue: 1.0, genericPoints: 2.0, genericMiles: 1.5,
};

/** RewardProgram.cashOutCPP */
export function cashOutCPP(p: RewardProgram): number {
  switch (p) {
    case "cash": case "chaseUR": case "citiTYP": case "scenePlus": return 1.0;
    case "amexMR": return 0.6;
    default: return 0.5;
  }
}

/** RewardProgram.infer(issuer:id:currency:) — order matters, mirrors the Swift needle list exactly. */
export function inferProgram(issuer: string | null, id: string, currency: CreditCard["rewardCurrency"]): RewardProgram {
  if (!currency || currency === "cashback") return "cash";
  const s = (id + " " + (issuer ?? "")).toLowerCase();
  const has = (...n: string[]) => n.some((x) => s.includes(x));
  if (has("hilton")) return "hilton";
  if (has("marriott", "bonvoy")) return "marriott";
  if (has("hyatt")) return "hyatt";
  if (has("ihg")) return "ihg";
  if (has("delta", "skymiles")) return "delta";
  if (has("united", "mileageplus")) return "united";
  if (has("aadvantage", "american airlines")) return "american";
  if (has("southwest", "rapid rewards")) return "southwest";
  if (has("jetblue", "trueblue")) return "jetBlue";
  if (has("alaska")) return "alaska";
  if (has("aeroplan", "air canada")) return "aeroplan";
  if (has("british airways", "avios")) return "avios";
  if (has("bilt")) return "bilt";
  if (has("scotia")) return "scenePlus";
  if (s.startsWith("td_") || s.endsWith(" td")) return "tdRewards";
  if (has("rbc")) return "rbcAvion";
  if (has("bmo")) return "bmoRewards";
  if (has("amex", "american express", "membership")) return "amexMR";
  if (has("chase", "sapphire", "freedom", "ink")) return "chaseUR";
  if (has("capital one", "capital_one", "venture")) return "capOneMiles";
  if (has("citi", "thankyou", "premier", "strata")) return "citiTYP";
  if (has("wells")) return "wellsFargo";
  if (has("arrival")) return "fixedValue";
  if (has("travel rewards", "travel_rewards")) return "fixedValue";
  if (has("discover")) return "fixedValue";
  if (has("altitude")) return "fixedValue";
  return currency === "miles" ? "genericMiles" : "genericPoints";
}

export interface Valuation {
  mode: ValuationMode;
  pooledPrograms: Record<string, RewardProgram>;
}

export function makeValuation(mode: ValuationMode = "cash"): Valuation {
  return { mode, pooledPrograms: {} };
}

const hay = (c: CreditCard) => (c.id + " " + c.displayName).toLowerCase();

/** RewardValuation.pooledPrograms(wallet:) */
export function pooledPrograms(wallet: CreditCard[]): Record<string, RewardProgram> {
  const map: Record<string, RewardProgram> = {};
  const urUnlocked = wallet.some((c) => {
    const s = hay(c);
    return s.includes("sapphire") || (s.includes("ink") && s.includes("preferred"));
  });
  if (urUnlocked) {
    for (const c of wallet) {
      if (c.rewardCurrency !== "cashback") continue;
      const s = hay(c);
      if (s.includes("freedom") || (s.includes("ink") && (s.includes("cash") || s.includes("unlimited")))) map[c.id] = "chaseUR";
    }
  }
  const isTYPUnlock = (c: CreditCard) => {
    const s = hay(c);
    const citi = s.includes("citi") || s.includes("thankyou") || s.includes("strata");
    return citi && (s.includes("premier") || s.includes("prestige"));
  };
  if (wallet.some(isTYPUnlock)) {
    for (const c of wallet) {
      if (c.rewardCurrency !== "cashback") continue;
      const s = hay(c);
      if (s.includes("custom_cash") || s.includes("custom cash") || s.includes("double_cash") || s.includes("double cash")) map[c.id] = "citiTYP";
    }
  } else {
    for (const c of wallet) {
      if (!c.rewardCurrency || c.rewardCurrency === "cashback") continue;
      if (!isTYPUnlock(c) && inferProgram(c.issuer, c.id, c.rewardCurrency) === "citiTYP") map[c.id] = "cash";
    }
  }
  return map;
}

export function withPooling(v: Valuation, wallet: CreditCard[]): Valuation {
  return { mode: v.mode, pooledPrograms: pooledPrograms(wallet) };
}

export function effectiveProgram(v: Valuation, card: CreditCard): RewardProgram {
  return v.pooledPrograms[card.id] ?? inferProgram(card.issuer, card.id, card.rewardCurrency);
}

export function centsPerPoint(v: Valuation, card: CreditCard): number {
  return v.mode === "cash" ? 1.0 : TRAVEL_CPP[effectiveProgram(v, card)];
}

export function valuesPointsAboveCash(v: Valuation, card: CreditCard): boolean {
  return centsPerPoint(v, card) !== 1.0;
}

export function earnUnitLabel(v: Valuation, card: CreditCard): string {
  if (v.pooledPrograms[card.id] !== undefined) return "points";
  return card.rewardCurrency ? { points: "points", miles: "miles", cashback: "cash back" }[card.rewardCurrency] : "points";
}

export function basisLabel(v: Valuation, card: CreditCard): string {
  const cpp = centsPerPoint(v, card);
  if (cpp === 1.0) return "Cash value";
  const pooled = v.pooledPrograms[card.id] !== undefined ? " (pooled with your wallet)" : "";
  return `${PROGRAM_DISPLAY[effectiveProgram(v, card)]} · ${fmt1(cpp)}¢ travel value${pooled}`;
}

/** Swift String(format: "%.1f") */
export function fmt1(x: number): string {
  return (Math.round(x * 10) / 10).toFixed(1);
}
