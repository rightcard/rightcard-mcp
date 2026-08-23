// Mirrors MerchantYieldEngine (BASE-RATE mode only — offers live on the phone, never here).
import {
  CATEGORY_DISPLAY, isPermanentMerchantBenefit, multiplier, overrideIsActive,
  type CreditCard, type Override, type SpendCategory,
} from "./model.js";
import { merchantMatchesCoBrandBenefit, offerMatches } from "./matching.js";
import { specFor, type ConfigurableCardSpec } from "./configurable.js";
import {
  basisLabel, cashOutCPP, centsPerPoint, earnUnitLabel, effectiveProgram, fmt1, valuesPointsAboveCash,
  withPooling, type RewardProgram, type Valuation,
} from "./valuation.js";

export interface SubcategoryBest { label: string; cardName: string; rate: string }

export interface Recommendation {
  cardId: string;
  cardName: string;
  rateDisplay: string;
  valueCaption: string;
  reason: string;
  breakdownLines: string[];
  loggableRate: number | null;
  valueMath: string | null;
  valueMathShort: string | null;
  valuationBasis: string | null;
  valuationMode: Valuation["mode"];
  tieNote: string | null;
  portalNote: string | null;
  subcategoryBreakdown: SubcategoryBest[];
  /** set by the caller from the directory (exclusionCaveat) */
  caveat?: string | null;
}

export interface RecommendInput {
  cards: CreditCard[];
  category: SpendCategory;
  subKey?: string | null;
  merchantName?: string | null;
  overrides: Override[];
  valuation: Valuation;
  cardConfigs?: Record<string, Set<SpendCategory>>;
  now: Date;
  strictMerchantMatch?: boolean;
}

// ── formatting (Swift twins) ──
export function formatPercent(v: number): string {
  return v === Math.round(v) ? `${Math.round(v)}%` : `${fmt1(v)}%`;
}
export function formatMultiplier(v: number): string {
  return v === Math.round(v) ? `${Math.round(v)}x` : `${fmt1(v)}x`;
}

/** shortName: trim issuer/boilerplate so a card name fits a one-line note. */
function shortName(name: string): string {
  let s = name;
  for (const term of ["American Express", "Bank of America", "Wells Fargo", "Capital One", "Credit Card", " Card", "®", "™"]) {
    s = s.split(term).join(term === "American Express" ? "Amex" : "");
  }
  return s.trim();
}

const TRANSFERABLE = new Set<RewardProgram>(["amexMR", "chaseUR", "capOneMiles", "citiTYP", "wellsFargo"]);

function optionalityRank(card: CreditCard, v: Valuation): number {
  const program = effectiveProgram(v, card);
  const isTransferable = TRANSFERABLE.has(program);
  const isCash = program === "cash";
  if (v.mode === "smart") return isTransferable ? 2 : (isCash ? 0 : 1);
  if (!isCash && cashOutCPP(program) >= 1.0) return 3;
  if (isCash) return 2;
  return isTransferable ? 1 : 0;
}

const PREMIUM_NEEDLES = [
  "sapphire reserve", "sapphire preferred", "venture x", "platinum card",
  "gold card", "amex gold", "strata premier", "citi premier", "prestige",
  "ritz-carlton", "aspire", "altitude reserve", "brilliant",
];
function premiumRank(card: CreditCard): number {
  const n = card.displayName.toLowerCase();
  return PREMIUM_NEEDLES.some((x) => n.includes(x)) ? 1 : 0;
}

function tieNote(winner: CreditCard, runnerUp: CreditCard, value: number, v: Valuation): string {
  const rate = formatPercent(value);
  const other = shortName(runnerUp.displayName);
  const win = shortName(winner.displayName);
  const wRank = optionalityRank(winner, v), rRank = optionalityRank(runnerUp, v);
  if (wRank > rRank) {
    const winProgram = effectiveProgram(v, winner);
    if (v.mode === "cash" && winProgram !== "cash" && cashOutCPP(winProgram) >= 1.0) {
      return `${win} ties ${other} at ${rate} — picked ${win}: its points cash out the same, and can be worth more if you ever redeem for travel.`;
    }
    const smart: Valuation = { mode: "smart", pooledPrograms: v.pooledPrograms };
    if (v.mode === "cash" && centsPerPoint(smart, runnerUp) > 1.0) {
      return `${win} and ${other} tie at ${rate} for cash. ${other}'s points can be worth more if you redeem for travel — switch to Points & miles to compare.`;
    }
    const why = v.mode === "smart" ? "transfer flexibility" : "guaranteed cash back";
    return `${win} ties ${other} at ${rate} — picked ${win} for ${why}.`;
  }
  if (premiumRank(winner) > premiumRank(runnerUp)) {
    return `${win} ties ${other} at ${rate} — picked ${win}: the premium card's purchase protections come free at the same rate.`;
  }
  return `${win} ties ${other} at ${rate} — either works.`;
}

interface PortalBonus { needles: string[]; rate: number; portal: string; premium: boolean }
const PORTAL_BONUSES: PortalBonus[] = [
  { needles: ["sapphire reserve"], rate: 10, portal: "Chase Travel", premium: true },
  { needles: ["sapphire preferred"], rate: 5, portal: "Chase Travel", premium: true },
  { needles: ["freedom flex", "freedom unlimited"], rate: 5, portal: "Chase Travel", premium: false },
  { needles: ["venture x"], rate: 10, portal: "Capital One Travel", premium: true },
  { needles: ["venture"], rate: 5, portal: "Capital One Travel", premium: false },
  { needles: ["strata premier", "citi premier"], rate: 10, portal: "Citi Travel", premium: true },
  { needles: ["platinum card", "amex platinum", "american express platinum"], rate: 5, portal: "Amex Travel", premium: true },
];
function portalBonus(card: CreditCard): PortalBonus | null {
  const hay = (card.id + " " + card.displayName).toLowerCase();
  return PORTAL_BONUSES.find((pb) => pb.needles.some((n) => hay.includes(n))) ?? null;
}
function portalNote(cards: CreditCard[], recommended: CreditCard): string | null {
  let best: { card: CreditCard; pb: PortalBonus } | null = null;
  for (const card of cards) {
    const pb = portalBonus(card);
    if (!pb) continue;
    let better: boolean;
    if (best === null) better = true;
    else if (pb.rate !== best.pb.rate) better = pb.rate > best.pb.rate;
    else better = pb.premium && !best.pb.premium;
    if (better) best = { card, pb };
  }
  if (!best) return null;
  const everyday = multiplier(recommended, "travel", null);
  if (!(best.pb.rate > everyday)) return null;
  return `Booking through ${best.pb.portal}? ${shortName(best.card.displayName)} earns up to ${formatMultiplier(best.pb.rate)} there.`;
}

interface Applied { rate: number; override: Override | null; configured: ConfigurableCardSpec | null }

function appliedRate(card: CreditCard, category: SpendCategory, subKey: string | null, merchantQuery: string | null,
                     overrides: Override[], cardConfigs: Record<string, Set<SpendCategory>>, now: Date, strict: boolean): Applied {
  let rate = multiplier(card, category, subKey);
  let winningOverride: Override | null = null;
  let winningConfig: ConfigurableCardSpec | null = null;
  for (const o of overrides) {
    if (o.cardId !== card.id || !overrideIsActive(o, now)) continue;
    let matches: boolean;
    if (o.merchant && o.merchant !== "") {
      if (!merchantQuery || merchantQuery === "") continue;
      matches = isPermanentMerchantBenefit(o, now)
        ? merchantMatchesCoBrandBenefit(o.merchant, merchantQuery)
        : offerMatches(o.merchant, merchantQuery, strict);
    } else {
      matches = o.category.trim().toLowerCase() === category;
    }
    if (matches && o.bonusRate > rate) { rate = o.bonusRate; winningOverride = o; winningConfig = null; }
  }
  const spec = specFor(card);
  if (spec && spec.eligible.includes(category) && cardConfigs[card.id]?.has(category) && spec.bonusRate > rate) {
    rate = spec.bonusRate; winningConfig = spec; winningOverride = null;
  }
  return { rate, override: winningOverride, configured: winningConfig };
}

interface Winner { card: CreditCard; earn: number; valueCents: number; override: Override | null; configured: ConfigurableCardSpec | null; tieNote: string | null }

function bestBaseCard(cards: CreditCard[], category: SpendCategory, subKey: string | null, merchantQuery: string | null,
                      overrides: Override[], cardConfigs: Record<string, Set<SpendCategory>>, v: Valuation, now: Date, strict: boolean): Winner | null {
  const candidates = cards.map((card) => {
    const a = appliedRate(card, category, subKey, merchantQuery, overrides, cardConfigs, now, strict);
    return { card, earn: a.rate, value: a.rate * centsPerPoint(v, card), override: a.override, configured: a.configured };
  });
  if (candidates.length === 0) return null;
  const maxValue = Math.max(...candidates.map((c) => c.value));
  const tied = candidates.filter((c) => Math.abs(c.value - maxValue) < 0.0001).sort((a, b) => {
    const ra = optionalityRank(a.card, v), rb = optionalityRank(b.card, v);
    if (ra !== rb) return rb - ra;
    const pa = premiumRank(a.card), pb = premiumRank(b.card);
    if (pa !== pb) return pb - pa;
    return a.card.displayName.localeCompare(b.card.displayName, "en", { sensitivity: "accent" });
  });
  const w = tied[0];
  if (!w) return null;
  const note = tied.length >= 2 ? tieNote(w.card, tied[1].card, w.value, v) : null;
  return { card: w.card, earn: w.earn, valueCents: w.value, override: w.override, configured: w.configured, tieNote: note };
}

function rateContext(card: CreditCard, earn: number, valueCents: number, override: Override | null,
                     configured: ConfigurableCardSpec | null, v: Valuation, category: SpendCategory, now: Date,
                     chosenCategoryCount: number): Recommendation {
  const valueStr = formatPercent(valueCents);
  const cat = CATEGORY_DISPLAY[category].toLowerCase();
  const disp = CATEGORY_DISPLAY[category];
  let reason: string;
  const lines: string[] = [];
  const pointsAbove = valuesPointsAboveCash(v, card) && card.rewardCurrency !== null;

  if (configured) {
    const bonusStr = formatPercent(configured.bonusRate);
    reason = `${card.displayName} is your choose-your-category card — you set ${disp} for ${bonusStr}, the most in your wallet here.`;
    if (chosenCategoryCount > configured.slots) {
      reason += ` You hold more than one — use the copy you set for ${disp}.`;
      lines.push(`${bonusStr} on ${disp} — your chosen category (the ${disp} copy)`);
    } else {
      lines.push(`${bonusStr} on ${disp} — your chosen category`);
    }
    lines.push(configured.note);
  } else if (override) {
    const scope = override.merchant ? `at ${override.merchant}` : cat;
    if (isPermanentMerchantBenefit(override, now)) {
      reason = `${card.displayName} earns ${valueStr} ${scope} — the most in your wallet here.`;
      lines.push(`${valueStr} ${scope} — card benefit`);
    } else {
      const what = override.label ?? `${formatPercent(override.bonusRate)} rotating ${scope} bonus`;
      reason = `${card.displayName} has a rotating bonus ${scope} active right now — ${valueStr} this quarter, the most in your wallet.`;
      lines.push(`Rotating bonus: ${what}`);
    }
    if (pointsAbove) {
      lines.push(`${formatMultiplier(override.bonusRate)} ${earnUnitLabel(v, card)} × ${fmt1(centsPerPoint(v, card))}¢ → ${valueStr} per $1`);
    }
    if (override.requiresActivation) {
      const issuer = card.issuer ?? "issuer";
      reason += ` Activate it in your ${issuer} app to earn the bonus.`;
      lines.push(`⚠︎ Activate this quarter in your ${issuer} app`);
    }
  } else if (pointsAbove) {
    const earnStr = formatMultiplier(earn);
    const unit = earnUnitLabel(v, card);
    const cppStr = fmt1(centsPerPoint(v, card));
    reason = `${card.displayName} earns ${earnStr} ${unit} on ${cat} — at ${cppStr}¢ each that's ${valueStr} per dollar, the most in your wallet.`;
    lines.push(`Earns ${earnStr} ${unit}`);
    lines.push(`Valued at ${cppStr}¢/pt → ${valueStr} per $1`);
  } else {
    reason = `${card.displayName} earns the most for ${cat} — ${valueStr} per dollar.`;
    lines.push(`Base ${cat} earn: ${valueStr}`);
  }

  let caption = configured ? "your bonus category · value per $1" : override ? "rotating bonus · value per $1" : "value per $1";
  let valueMath: string | null = null;
  let valueMathShort: string | null = null;
  if (pointsAbove) {
    caption = `${formatMultiplier(earn)} ${earnUnitLabel(v, card)} · ${caption}`;
    const effectiveEarn = configured?.bonusRate ?? override?.bonusRate ?? earn;
    const cpp = centsPerPoint(v, card);
    valueMath = `${formatMultiplier(effectiveEarn)} ${earnUnitLabel(v, card)} × ${fmt1(cpp)}¢ = ${fmt1(effectiveEarn * cpp)}¢ per $1`;
    const cppShort = cpp === Math.round(cpp) ? `${Math.round(cpp)}¢` : `${fmt1(cpp)}¢`;
    valueMathShort = `${formatMultiplier(effectiveEarn)} pts × ${cppShort}`;
  }
  return {
    cardId: card.id, cardName: card.displayName, rateDisplay: valueStr, valueCaption: caption, reason,
    breakdownLines: lines, loggableRate: valueCents, valueMath, valueMathShort,
    valuationBasis: basisLabel(v, card), valuationMode: v.mode, tieNote: null, portalNote: null, subcategoryBreakdown: [],
  };
}

function subcategoryBreakdown(cards: CreditCard[], category: SpendCategory, overrides: Override[],
                              cardConfigs: Record<string, Set<SpendCategory>>, v: Valuation, now: Date): SubcategoryBest[] {
  let subs: [string, string][];
  if (category === "grocery") subs = [["in_store", "In a store"], ["online", "Online / delivery"]];
  else if (category === "travel") subs = [["flight", "Flights"], ["hotel", "Hotels"]];
  else return [];
  const rows: SubcategoryBest[] = [];
  for (const [key, label] of subs) {
    const w = bestBaseCard(cards, category, key, null, overrides, cardConfigs, v, now, false);
    if (!w) continue;
    rows.push({ label, cardName: w.card.displayName, rate: formatPercent(w.valueCents) });
  }
  const distinct = new Set(rows.map((r) => `${r.cardName}|${r.rate}`));
  return distinct.size > 1 ? rows : [];
}

/** MerchantYieldEngine.recommend — base-rate mode (offers: []) */
export function recommend(input: RecommendInput): Recommendation | null {
  const { cards, category, overrides, now } = input;
  if (cards.length === 0) return null;
  const v = withPooling(input.valuation, cards);
  const cardConfigs = input.cardConfigs ?? {};
  const strict = input.strictMerchantMatch ?? false;
  const subKey = input.subKey ?? null;
  const merchantName = input.merchantName && input.merchantName.trim() !== "" ? input.merchantName : null;
  const query = merchantName ? merchantName.toLowerCase() : null;
  const w = bestBaseCard(cards, category, subKey, query, overrides, cardConfigs, v, now, strict);
  if (!w) return null;
  const ctx = rateContext(w.card, w.earn, w.valueCents, w.override, w.configured, v, category, now,
                          cardConfigs[w.card.id]?.size ?? 0);
  ctx.tieNote = w.tieNote;
  if (category === "travel") ctx.portalNote = portalNote(cards, w.card);
  if (input.merchantName == null && input.subKey == null) {
    ctx.subcategoryBreakdown = subcategoryBreakdown(cards, category, overrides, cardConfigs, v, now);
  }
  return ctx;
}
