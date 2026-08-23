// PARITY GATE: every answer in fixtures/engine_golden.json (written by the Swift
// GoldenExportTests) must be reproduced exactly by the TypeScript port.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { cardFromRow, merchantFromRow, overrideFromRow, type SpendCategory } from "../src/model.js";
import { recommend } from "../src/engine.js";
import { buildIndex, rankedBrandMatches } from "../src/search.js";
import { makeValuation } from "../src/valuation.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const iosRepo = path.resolve(here, "../../ios Applications/RightCard/RightCard");
const golden = JSON.parse(readFileSync(path.resolve(here, "../fixtures/engine_golden.json"), "utf8"));
const seed = JSON.parse(readFileSync(path.resolve(iosRepo, "RightCard/Assets.xcassets/CatalogSeed.dataset/catalog_seed.json"), "utf8"));
const merchSnap = JSON.parse(readFileSync(path.resolve(iosRepo, "RightCardTests/Fixtures/merchants_us.json"), "utf8"));

const cards = seed.cards.map(cardFromRow);
const byId = new Map(cards.map((c: any) => [c.id, c]));
const overrides = seed.overrides.map(overrideFromRow);
const directory = merchSnap.rows.map(merchantFromRow);
const index = buildIndex(directory);
const now = new Date(golden.now + "T00:00:00Z");
const cardConfigs: Record<string, Set<SpendCategory>> = {};
for (const [k, v] of Object.entries(golden.cardConfigs as Record<string, string[]>)) cardConfigs[k] = new Set(v as SpendCategory[]);

function project(r: ReturnType<typeof recommend>) {
  if (!r) return null;
  return {
    cardId: r.cardId, rateDisplay: r.rateDisplay, valueCaption: r.valueCaption, reason: r.reason,
    breakdownLines: r.breakdownLines, loggableRate: r.loggableRate, valueMath: r.valueMath,
    valueMathShort: r.valueMathShort, valuationBasis: r.valuationBasis, tieNote: r.tieNote,
    portalNote: r.portalNote, subcategoryBreakdown: r.subcategoryBreakdown,
  };
}

describe("engine parity with Swift (category taps)", () => {
  it("has cases", () => expect(golden.categoryCases.length).toBeGreaterThan(500));
  for (const c of golden.categoryCases) {
    it(`w${c.wallet} ${c.mode} ${c.category}`, () => {
      const wallet = golden.wallets[c.wallet].map((id: string) => byId.get(id));
      const got = project(recommend({ cards: wallet, category: c.category, overrides, valuation: makeValuation(c.mode), cardConfigs, now }));
      expect(got).toEqual(c.result);
    });
  }
});

describe("engine parity with Swift (merchant searches)", () => {
  for (const c of golden.merchantCases) {
    it(`w${c.wallet} ${c.mode} ${c.merchant}`, () => {
      const wallet = golden.wallets[c.wallet].map((id: string) => byId.get(id));
      const got = project(recommend({ cards: wallet, category: c.category, subKey: c.subKey, merchantName: c.merchant, overrides, valuation: makeValuation(c.mode), cardConfigs, now }));
      expect(got).toEqual(c.result);
    });
  }
});

describe("search parity with Swift (ranking + collapse over the live snapshot)", () => {
  for (const c of golden.searchCases) {
    it(`"${c.query}"`, () => {
      expect(rankedBrandMatches(c.query, index).map((r) => r.merchant.id)).toEqual(c.ids);
    });
  }
});
