// The MCP surface (RIGHTCARD_MCP_SPEC.md §5). Read-only. Every answer carries `basis`
// and `caveats`; verified rows only in rankings; quarantined cards are NAMED, never ranked.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ALL_CATEGORIES, exclusionCaveat, hasAnyReward, multiplier, overrideIsActive, isPermanentMerchantBenefit,
  type CreditCard, type Merchant, type SpendCategory } from "./model.js";
import { recommend, formatPercent, formatMultiplier, type Recommendation } from "./engine.js";
import { rankedBrandMatches, searchNormalized } from "./search.js";
import { makeValuation, centsPerPoint, withPooling, effectiveProgram, PROGRAM_DISPLAY, TRAVEL_CPP, type ValuationMode } from "./valuation.js";
import { specFor, isConfigurable } from "./configurable.js";
import type { Catalog } from "./data.js";

const CategorySchema = z.enum(ALL_CATEGORIES as [SpendCategory, ...SpendCategory[]]);

const PRIVACY = "RightCard never receives a bank login, balances, or transactions. This tool takes a list of card ids and a store name, returns an answer, and stores nothing.";

function cardSummary(c: CreditCard) {
  return {
    id: c.id, name: c.displayName, issuer: c.issuer, reward_currency: c.rewardCurrency,
    verify_status: c.verifyStatus ?? "unknown", annual_fee: c.annualFee ?? null,
  };
}

function resolveWallet(catalog: Catalog, ids: string[]) {
  const cards: CreditCard[] = [];
  const unknown: string[] = [];
  const unverified: string[] = [];
  for (const id of ids) {
    const c = catalog.cardsById.get(id);
    if (!c) { unknown.push(id); continue; }
    if (c.verifyStatus !== "verified" && !isConfigurable(c)) unverified.push(id);
    cards.push(c);
  }
  return { cards, unknown, unverified };
}

function resolveMerchant(catalog: Catalog, name: string): Merchant | null {
  return rankedBrandMatches(name, catalog.index)[0]?.merchant ?? null;
}

function shapeAnswer(r: Recommendation, merchant: Merchant | null, mode: "cash" | "points", unverified: string[]) {
  const caveats: string[] = [];
  if (merchant) { const cv = exclusionCaveat(merchant); if (cv) caveats.push(cv); }
  if (r.tieNote) caveats.push(r.tieNote);
  if (r.portalNote) caveats.push(r.portalNote);
  if (unverified.length) caveats.push(`Not yet verified by two independent sources (ranked on published data, treat with care): ${unverified.join(", ")}.`);
  return {
    card_id: r.cardId, card_name: r.cardName, rate_display: r.rateDisplay,
    value_per_dollar_cents: r.loggableRate, basis: r.valuationBasis, valuation: mode,
    reason: r.reason, details: r.breakdownLines, value_math: r.valueMath,
    subcategory_split: r.subcategoryBreakdown, caveats, privacy: PRIVACY,
  };
}

export function buildServer(getCatalog: () => Promise<Catalog>): McpServer {
  const server = new McpServer({ name: "rightcard", version: "0.1.0" }, {
    instructions: "RightCard answers 'which of these credit cards should pay here?' from bank-published, two-source-verified reward data. " +
      "Pass the user's card ids (from search_cards) plus a store name or a category. Cash value is the default; ask for valuation='points' to value points at conservative per-program travel values. " +
      "Every answer includes honest caveats: superstores/warehouse clubs that do not post grocery bonuses, rotating quarters that need activation, ties. " + PRIVACY,
  });

  server.registerTool("best_card", {
    title: "Best card for a store or category",
    description: "Which of the given cards earns the most at a store (merchant) or for a spend category, today. Returns the card, the honest rate, why, and caveats (merchant-code traps, activation, ties). Base rates + rotating bonuses + built-in card benefits only; a user's personal bank offers live on their phone and are not consulted here.",
    inputSchema: {
      wallet: z.array(z.string()).min(1).describe("Card ids the person holds (from search_cards)."),
      merchant: z.string().optional().describe("Store name, e.g. 'Costco', 'Whole Foods', 'Uber'. Use this OR category."),
      category: CategorySchema.optional().describe("Spend category when there is no specific store."),
      valuation: z.enum(["cash", "points"]).default("cash").describe("'cash' counts every point at 1¢ (default). 'points' values points per program at conservative travel values."),
      on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Date (YYYY-MM-DD, UTC) for rotating windows; defaults to today."),
      chosen_categories: z.record(z.string(), z.array(CategorySchema)).optional().describe("For choose-your-category cards (Citi Custom Cash, BofA Customized, Venmo): card id → the categories the person set."),
    },
  }, async ({ wallet, merchant, category, valuation, on, chosen_categories }) => {
    const catalog = await getCatalog();
    const { cards, unknown, unverified } = resolveWallet(catalog, wallet);
    if (cards.length === 0) return err(`No known cards in wallet. Unknown ids: ${unknown.join(", ")}. Use search_cards to find ids.`);
    let cat: SpendCategory | undefined = category;
    let subKey: string | null = null;
    let dir: Merchant | null = null;
    if (merchant) {
      dir = resolveMerchant(catalog, merchant);
      cat = dir?.category ?? cat ?? "general";
      subKey = dir?.subKey ?? null;
    }
    if (!cat) return err("Pass a merchant or a category.");
    const mode: ValuationMode = valuation === "points" ? "smart" : "cash";
    const configs: Record<string, Set<SpendCategory>> = {};
    for (const [k, v] of Object.entries(chosen_categories ?? {})) configs[k] = new Set(v as SpendCategory[]);
    const now = on ? new Date(on + "T00:00:00Z") : new Date();
    const r = recommend({ cards, category: cat, subKey, merchantName: merchant ?? null, overrides: catalog.overrides,
                          valuation: makeValuation(mode), cardConfigs: configs, now });
    if (!r) return err("No recommendation could be computed.");
    const answer = {
      ...shapeAnswer(r, dir, valuation, unverified),
      merchant: dir ? { id: dir.id, name: dir.displayName, category: dir.category, merchant_type: dir.merchantType } : null,
      category: cat, unknown_card_ids: unknown,
    };
    return ok(answer);
  });

  server.registerTool("lookup_merchant", {
    title: "How a store is coded",
    description: "The store's reward category as RightCard's directory files it, its merchant type, and the merchant-code caveat when a category bonus usually will not post there (superstores like Walmart/Target, warehouse clubs like Costco/Sam's). Same ranking the app uses.",
    inputSchema: { name: z.string().min(2) },
  }, async ({ name }) => {
    const catalog = await getCatalog();
    const rows = rankedBrandMatches(name, catalog.index);
    if (rows.length === 0) return ok({ query: name, found: false, note: "Not in the directory. The app would classify it by name and answer with the base rate." });
    const top = rows[0].merchant;
    return ok({
      query: name, found: true,
      match: { id: top.id, name: top.displayName, category: top.category, sub_key: top.subKey, merchant_type: top.merchantType, caveat: exclusionCaveat(top) },
      family: rows.slice(1).map((r) => ({ id: r.merchant.id, name: r.merchant.displayName, category: r.merchant.category, merchant_type: r.merchant.merchantType })),
    });
  });

  server.registerTool("search_cards", {
    title: "Find card ids",
    description: "Search RightCard's catalog by card or issuer name to get the ids to pass into best_card. Verified cards first; unverified cards are flagged, never hidden.",
    inputSchema: { query: z.string().min(2), issuer: z.string().optional(), limit: z.number().int().min(1).max(50).default(12) },
  }, async ({ query, issuer, limit }) => {
    const catalog = await getCatalog();
    const q = searchNormalized(query);
    const toks = q.split(" ").filter((t) => t.length > 0);
    let hits = catalog.cards.filter((c) => {
      if (issuer && !(c.issuer ?? "").toLowerCase().includes(issuer.toLowerCase())) return false;
      const hay = searchNormalized(`${c.displayName} ${c.issuer ?? ""} ${c.id.replace(/_/g, " ")}`);
      return toks.every((t) => hay.includes(t));
    });
    hits.sort((a, b) => (rank(a) - rank(b)) || a.displayName.localeCompare(b.displayName));
    return ok({ query, results: hits.slice(0, limit).map(cardSummary), total: hits.length });
    function rank(c: CreditCard) { return c.verifyStatus === "verified" ? 0 : (hasAnyReward(c) ? 1 : 2); }
  });

  server.registerTool("card", {
    title: "A card's verified rates",
    description: "Everything RightCard knows about one card: rates by category, base rate, currency, annual fee, verification status, live rotating windows, and the choose-your-category spec if it has one.",
    inputSchema: { id: z.string() },
  }, async ({ id }) => {
    const catalog = await getCatalog();
    const c = catalog.cardsById.get(id);
    if (!c) return err(`Unknown card id '${id}'. Use search_cards.`);
    const now = new Date();
    const rates: Record<string, string> = {};
    for (const cat of ALL_CATEGORIES) {
      const m = multiplier(c, cat, null);
      rates[cat] = c.rewardCurrency === "cashback" || !c.rewardCurrency ? formatPercent(m) : formatMultiplier(m);
    }
    const rot = catalog.overrides.filter((o) => o.cardId === id).map((o) => ({
      category: o.category, merchant: o.merchant, bonus_rate: o.bonusRate, start: o.startDate, end: o.endDate,
      activation_required: o.requiresActivation, label: o.label,
      status: isPermanentMerchantBenefit(o, now) ? "card benefit" : overrideIsActive(o, now) ? "live now" : (o.startDate > now.toISOString().slice(0, 10) ? "upcoming" : "past"),
    }));
    const spec = specFor(c);
    const v = withPooling(makeValuation("smart"), [c]);
    return ok({
      ...cardSummary(c), rates_by_category: rates,
      points_program: c.rewardCurrency && c.rewardCurrency !== "cashback" ? { name: PROGRAM_DISPLAY[effectiveProgram(v, c)], travel_cents_per_point: centsPerPoint(v, c) } : null,
      rotating_and_benefits: rot,
      choose_your_category: spec ? { bonus_rate: spec.bonusRate, slots: spec.slots, eligible: spec.eligible, note: spec.note } : null,
      verification_note: c.verifyStatus === "verified" ? "Two independent sources agreed on these rates." : `verify_status=${c.verifyStatus ?? "unknown"}: not yet confirmed by two sources; shown, not vouched for.`,
    });
  });

  server.registerTool("rotating_calendar", {
    title: "Rotating 5% windows",
    description: "Live and upcoming rotating-category windows (Freedom Flex, Discover it, Citi Dividend…) and permanent merchant benefits, from the same verified data as the app. Optionally filter by card id.",
    inputSchema: { card_id: z.string().optional() },
  }, async ({ card_id }) => {
    const catalog = await getCatalog();
    const today = new Date().toISOString().slice(0, 10);
    const rows = catalog.overrides.filter((o) => !card_id || o.cardId === card_id).filter((o) => o.endDate >= today)
      .map((o) => ({ card_id: o.cardId, card_name: catalog.cardsById.get(o.cardId)?.displayName ?? o.cardId,
        category: o.category, merchant: o.merchant, bonus_rate: o.bonusRate, start: o.startDate, end: o.endDate,
        activation_required: o.requiresActivation, label: o.label,
        status: isPermanentMerchantBenefit(o, new Date()) ? "card benefit" : o.startDate <= today ? "live now" : "upcoming" }))
      .sort((a, b) => a.start.localeCompare(b.start) || a.card_id.localeCompare(b.card_id));
    return ok({ as_of: today, windows: rows, note: "A window appears only after it passed two-source verification. Nothing here is predicted." });
  });

  server.registerResource("catalog", "rightcard://catalog", { title: "Verified card catalog", mimeType: "application/json" }, async (uri) => {
    const catalog = await getCatalog();
    return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(catalog.cards.map(cardSummary)) }] };
  });
  server.registerResource("valuation", "rightcard://valuation", { title: "How points are valued", mimeType: "application/json" }, async (uri) => ({
    contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify({ mode_cash: "every point = 1¢", mode_points_travel_cents_per_point: TRAVEL_CPP, source: "Conservative blended baselines (The Points Guy, Bankrate, Frequent Miler), Q2 2026." }) }],
  }));

  server.registerPrompt("which-card", {
    title: "Which card should I use here?",
    description: "Ask RightCard for the best card at a store, given the cards you hold.",
    argsSchema: { cards: z.string().describe("Your cards, in your own words"), store: z.string().describe("Where you're paying") },
  }, ({ cards, store }) => ({
    messages: [{ role: "user", content: { type: "text", text:
      `I hold these cards: ${cards}. First call search_cards to resolve each to an id, then call best_card with the wallet and merchant "${store}". Tell me the card, the rate, and repeat any caveat about the store's merchant code or activation exactly as returned.` } }],
  }));

  return server;
}

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data as Record<string, unknown> };
}
function err(message: string) {
  return { isError: true as const, content: [{ type: "text" as const, text: message }] };
}
