// Public-tier data access. ANON key only (publishable, RLS-gated, read-only) — the same
// key the iOS app ships. No private tables, no auth, no user data, ever.
import { cardFromRow, merchantFromRow, overrideFromRow, type CreditCard, type Merchant, type Override } from "./model.js";
import { buildIndex, type IndexEntry } from "./search.js";

export const SUPABASE_URL = "https://janvnoyczokisiepefol.supabase.co/rest/v1";
export const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphbnZub3ljem9raXNpZXBlZm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxOTc5NDUsImV4cCI6MjA5NTc3Mzk0NX0." +
  "WdNuhqWft11jh5btv0tvbAA2IUIgpbNTPKaf_YluvwM";

export interface Catalog {
  cards: CreditCard[];            // every US row (verify_status kept on each)
  cardsById: Map<string, CreditCard>;
  overrides: Override[];
  merchants: Merchant[];
  index: IndexEntry[];
  loadedAt: number;
}

async function getAll(path: string, fetchImpl: typeof fetch): Promise<any[]> {
  const out: any[] = [];
  const page = 1000;
  for (let off = 0; off < 50000; off += page) {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetchImpl(`${SUPABASE_URL}/${path}${sep}limit=${page}&offset=${off}`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
    });
    if (!res.ok) throw new Error(`supabase ${path}: HTTP ${res.status}`);
    const rows = (await res.json()) as any[];
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

export async function loadCatalog(fetchImpl: typeof fetch = fetch): Promise<Catalog> {
  const [cardRows, overrideRows, merchantRows] = await Promise.all([
    getAll("cards?select=id,name,issuer,reward_currency,base_rate,standard_multipliers,annual_fee,verify_status&country=eq.US&order=id", fetchImpl),
    getAll("active_overrides?select=*&order=id", fetchImpl),
    getAll("merchants?select=id,display_name,category,sub_key,merchant_type,is_online,aliases&country=eq.US&order=id", fetchImpl),
  ]);
  const cards = cardRows.map(cardFromRow);
  const merchants = merchantRows.map(merchantFromRow);
  return {
    cards, cardsById: new Map(cards.map((c) => [c.id, c])), overrides: overrideRows.map(overrideFromRow),
    merchants, index: buildIndex(merchants), loadedAt: Date.now(),
  };
}

/** One-hour edge/process cache; a failed refresh keeps serving the last good catalog. */
export function catalogCache(fetchImpl: typeof fetch = fetch, ttlMs = 60 * 60 * 1000) {
  let current: Catalog | null = null;
  let inflight: Promise<Catalog> | null = null;
  return async (): Promise<Catalog> => {
    if (current && Date.now() - current.loadedAt < ttlMs) return current;
    if (!inflight) {
      inflight = loadCatalog(fetchImpl).then((c) => { current = c; return c; })
        .catch((e) => { if (current) return current; throw e; })
        .finally(() => { inflight = null; });
    }
    return inflight;
  };
}
