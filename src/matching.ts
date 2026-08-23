// Mirrors MerchantYieldEngine's brand matchers (merchantMatches, merchantMatchesStrict,
// merchantMatchesCoBrandBenefit) — brand identity, not token overlap.

const MERCHANT_STOPWORDS = new Set([
  "the", "and", "for", "inc", "llc", "ltd", "co", "shop", "store", "stores",
  "online", "subscription", "subscriptions", "rent", "rental", "rentals",
  "car", "cars", "hotel", "hotels", "resort", "resorts", "international",
  "monthly", "annual", "premium", "collection", "rewards", "select",
  "destinations", "prepaid", "purchases", "amex", "american", "express",
]);
const ARTICLE_STOPWORDS = new Set(["the", "a", "an", "of", "and", "at"]);
const GENERIC_PLACE = new Set([
  "gas", "station", "fuel", "fueling", "market", "supermarket", "mart",
  "store", "stores", "pharmacy", "drugstore", "supercenter", "super",
  "center", "centre", "outlet", "express", "shopping", "inc", "llc", "farmers",
]);
const COBRAND_GENERIC = new Set(["incorporated", "corporation", "company"]);

const TLD_RE = /\.(com|net|org|co|io|tv|shop|store|us)\b/g;
const isAlnum = (ch: string) => /[\p{L}\p{N}]/u.test(ch);

interface TokenForms { brand: string[]; significant: Set<string>; compact: string }
const cache = new Map<string, TokenForms>();

function forms(s: string): TokenForms {
  const hit = cache.get(s);
  if (hit) return hit;
  const lowered = s.toLowerCase()
    .replace(/&/g, " and ")
    .replace(/(?<=[\p{L}\p{N}])\+(?=[\p{L}\p{N}])/gu, " and ")
    .replace(/(?<=\s)\+(?=\s)/g, " and ");
  const stripped = lowered.replace(TLD_RE, " ");
  const parts = stripped.split(/[^\p{L}\p{N}]+/u).filter((p) => p.length > 0);
  const out: TokenForms = {
    brand: parts.filter((p) => p.length >= 2 && !MERCHANT_STOPWORDS.has(p) && !ARTICLE_STOPWORDS.has(p)),
    significant: new Set(parts.filter((p) => p.length >= 2 && !ARTICLE_STOPWORDS.has(p))),
    compact: parts.join(""),
  };
  if (cache.size > 4096) cache.clear();
  cache.set(s, out);
  return out;
}

const eq = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));
const isSubset = (a: Set<string>, b: Set<string>) => [...a].every((x) => b.has(x));
const isStrictSubset = (a: Set<string>, b: Set<string>) => a.size < b.size && isSubset(a, b);
const minus = (a: Set<string>, b: Set<string>) => new Set([...a].filter((x) => !b.has(x)));

/** MerchantYieldEngine.merchantMatches(offer:query:) */
export function merchantMatches(offerMerchant: string, query: string): boolean {
  const o = forms(offerMerchant).brand, q = forms(query).brand;
  if (o.length > 0 && q.length > 0) {
    const os = new Set(o), qs = new Set(q);
    if (eq(os, qs)) return true;
    if (isStrictSubset(os, qs) && (isSubset(minus(qs, os), GENERIC_PLACE) || arrEq(q.slice(0, o.length), o))) return true;
    if (isStrictSubset(qs, os) && isSubset(minus(os, qs), GENERIC_PLACE)) return true;
  }
  const cm = forms(offerMerchant).compact, cq = forms(query).compact;
  if (cm.length < 4 || cq.length < 4) return false;
  if (cm === cq) return true;
  const [short, long] = cm.length <= cq.length ? [cm, cq] : [cq, cm];
  if (!long.startsWith(short)) return false;
  const rest = long.slice(short.length);
  return GENERIC_PLACE.has(rest) || MERCHANT_STOPWORDS.has(rest);
}

const arrEq = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** MerchantYieldEngine.merchantMatchesStrict(offer:place:) */
export function merchantMatchesStrict(offerMerchant: string, place: string): boolean {
  const o = forms(offerMerchant).significant, p = forms(place).significant;
  if (o.size === 0 || p.size === 0) return false;
  if (eq(o, p)) return true;
  if (isSubset(o, p) && isSubset(minus(p, o), GENERIC_PLACE)) return true;
  return forms(offerMerchant).compact === forms(place).compact;
}

export function offerMatches(offer: string, query: string, strict: boolean): boolean {
  return strict ? merchantMatchesStrict(offer, query) : merchantMatches(offer, query);
}

/** MerchantYieldEngine.merchantMatchesCoBrandBenefit(benefit:query:) */
export function merchantMatchesCoBrandBenefit(benefit: string, query: string): boolean {
  const distinctive = (s: string) => new Set(
    s.toLowerCase().replace(/\.(com|net|org|co|io)\b/g, " ")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length >= 4 && !COBRAND_GENERIC.has(t)));
  const b = distinctive(benefit), q = distinctive(query);
  if (b.size === 0 || q.size === 0) return false;
  if (![...b].some((x) => q.has(x))) return false;
  return isSubset(q, b);
}
