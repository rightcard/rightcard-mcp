// Mirrors Merchant.searchNormalized / compactForm / matchScore / entityKey / withinOneEdit
// and MerchantSearchViewModel.rankedBrandMatches (ranking + family collapse).
import { merchantMatches } from "./matching.js";
import { isCuratedBrand, type Merchant, type SpendCategory } from "./model.js";

const normCache = new Map<string, string>();

/** Merchant.searchNormalized */
export function searchNormalized(s: string): string {
  const hit = normCache.get(s);
  if (hit !== undefined) return hit;
  // diacritic-insensitive + case-insensitive fold
  let t = s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  for (const junk of ["’", "'", "®", "™", "."]) t = t.split(junk).join("");
  t = t.replace(/&/g, " and ");
  t = t.replace(/(?<=[\p{L}\p{N}])\+(?=[\p{L}\p{N}])/gu, " and ");
  t = t.replace(/(?<=\s)\+(?=\s)/g, " and ");
  t = t.replace(/\+/g, " plus ");
  for (const dash of ["-", "–", "—", "/"]) t = t.split(dash).join(" ");
  let words = t.split(/\s+/).filter((w) => w.length > 0);
  if (words.length > 1 && words[0] === "the") words = words.slice(1);
  const result = words.join(" ");
  if (normCache.size > 8192) normCache.clear();
  normCache.set(s, result);
  return result;
}

export function compactForm(normalized: string): string {
  return normalized.split(" ").filter((w) => w !== "and" && w.length > 0).join("");
}

export function entityKey(s: string): string {
  return searchNormalized(s).replace(/ /g, "");
}

/** Merchant.withinOneEdit — Damerau-Levenshtein ≤ 1 */
export function withinOneEdit(aStr: string, bStr: string): boolean {
  if (aStr === bStr) return true;
  const a = [...aStr], b = [...bStr];
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const diffs: number[] = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { diffs.push(i); if (diffs.length > 2) return false; }
    if (diffs.length === 1) return true;
    return diffs.length === 2 && diffs[1] === diffs[0] + 1 && a[diffs[0]] === b[diffs[1]] && a[diffs[1]] === b[diffs[0]];
  }
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  let i = 0, j = 0, skipped = false;
  while (i < long.length && j < short.length) {
    if (long[i] === short[j]) { i++; j++; }
    else if (!skipped) { skipped = true; i++; }
    else return false;
  }
  return true;
}

export interface SearchForms { raw: string; norm: string; compact: string }
export const searchForms = (raw: string): SearchForms => {
  const norm = searchNormalized(raw);
  return { raw, norm, compact: compactForm(norm) };
};

/** Merchant.matchScore(queryNorm:queryCompact:rawQuery:candidates:) */
export function matchScore(q: string, qc: string, rawQuery: string, candidates: SearchForms[]): number | null {
  if ([...q].length < 2) return null;
  let best = -1;
  for (const c of candidates) {
    const n = c.norm;
    if (n.length === 0) continue;
    if (n === q) { best = Math.max(best, 100); continue; }
    if (qc.length > 0 && c.compact === qc) best = Math.max(best, 95);
    if (n.startsWith(q)) best = Math.max(best, 85);
    if ([...qc].length >= 3 && c.compact.startsWith(qc)) best = Math.max(best, 80);
    if (q.startsWith(n + " ")) best = Math.max(best, 75);
    const words = n.split(" ");
    if (words.slice(1).some((w) => w.startsWith(q))) best = Math.max(best, 70);
    if (n.includes(q)) best = Math.max(best, 55);
    if (best < 45 && merchantMatches(c.raw, rawQuery)) best = Math.max(best, 45);
    if (best < 30 && [...q].length >= 5) {
      if (withinOneEdit(n, q) || words.some((w) => [...w].length >= 5 && withinOneEdit(w, q))) best = Math.max(best, 30);
    }
  }
  return best >= 0 ? best : null;
}

export interface IndexEntry {
  merchant: Merchant;
  candidates: SearchForms[];
  entityKey: string;
  displayNorm: string;
}

export function buildIndex(directory: Merchant[]): IndexEntry[] {
  return directory.map((m) => ({
    merchant: m,
    candidates: [m.displayName, ...m.aliases].map(searchForms),
    entityKey: entityKey(m.displayName),
    displayNorm: searchNormalized(m.displayName),
  }));
}

/** Swift localizedCaseInsensitiveCompare ascending (approximation: locale compare, case-insensitive). */
function nameCompare(a: string, b: string): number {
  return a.localeCompare(b, "en", { sensitivity: "accent" });
}

/** MerchantSearchViewModel.rankedBrandMatches(query:index:offerKeys:limit:) */
export function rankedBrandMatches(query: string, index: IndexEntry[], offerKeys: Set<string> = new Set(), limit = 6)
  : { merchant: Merchant; hasOffer: boolean }[] {
  const q = searchNormalized(query);
  if ([...q].length < 2) return [];
  const qc = compactForm(q);
  type Row = [IndexEntry, number, boolean];
  const ranked: Row[] = [];
  for (const e of index) {
    const score = matchScore(q, qc, query, e.candidates);
    if (score === null) continue;
    const hasOffer = offerKeys.has(e.entityKey);
    const specific = (e.merchant.category !== "general" || isCuratedBrand(e.merchant)) ? 1 : 0;
    const boost = hasOffer && score >= 70 ? 400 : 0;
    ranked.push([e, score * 2 + specific + boost, hasOffer]);
  }
  ranked.sort((a, b) => a[1] !== b[1] ? b[1] - a[1] : nameCompare(a[0].merchant.displayName, b[0].merchant.displayName));

  const qKey = q.replace(/ /g, "");
  const glueSuffixes = new Set(["com", "net", "online", "us", "usa", "store", "shop"]);
  const extendsName = (key: string, norm: string, base: { key: string; norm: string }): boolean => {
    if (norm.startsWith(base.norm + " ")) return true;
    if (key.startsWith(base.key) && glueSuffixes.has(key.slice(base.key.length))) return true;
    let glued = "";
    const words = norm.split(" ");
    for (let i = 0; i < words.length; i++) {
      glued += words[i].replace(/[^\p{L}\p{N}]/gu, "");
      if (glued === base.key) return i < words.length - 1;
      if (!base.key.startsWith(glued)) return false;
    }
    return false;
  };

  const kept: Row[] = [];
  let repCategory: SpendCategory | null = null;
  outer: for (const row of ranked) {
    if (kept.length >= limit) break;
    const e = row[0];
    for (let i = 0; i < kept.length; i++) {
      const k = kept[i];
      if (k[0].entityKey === e.entityKey) continue outer;
      if (e.merchant.category === "general" && e.entityKey === "new" + k[0].entityKey) continue outer;
      if (k[0].merchant.category === "general" && k[0].entityKey === "new" + e.entityKey) { kept[i] = row; continue outer; }
    }
    const inQueryFamily = e.displayNorm === q || extendsName(e.entityKey, e.displayNorm, { key: qKey, norm: q });
    if (inQueryFamily) {
      if (row[2]) {
        kept.push(row);
        if (repCategory === null) repCategory = e.merchant.category;
      } else if (e.displayNorm === q && isCuratedBrand(e.merchant)) {
        kept.push(row);
        if (repCategory === null) repCategory = e.merchant.category;
      } else if (repCategory !== null) {
        if (e.merchant.category === repCategory || e.merchant.category === "general") continue;
        kept.push(row);
      } else {
        repCategory = e.merchant.category;
        kept.push(row);
      }
      continue;
    }
    if (!row[2]) {
      for (const k of kept) {
        if (extendsName(e.entityKey, e.displayNorm, { key: k[0].entityKey, norm: k[0].displayNorm })) {
          const sameAnswer = e.merchant.category === k[0].merchant.category || e.merchant.category === "general";
          if (sameAnswer) continue outer;
        }
      }
    }
    kept.push(row);
  }
  return kept.map((r) => ({ merchant: r[0].merchant, hasOffer: r[2] }));
}
