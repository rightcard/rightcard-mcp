# RightCard MCP

[![npm](https://img.shields.io/npm/v/rightcard-mcp)](https://www.npmjs.com/package/rightcard-mcp)

The card-selection oracle for agents: **which of your credit cards should pay here?**
Answers come from RightCard's bank-published, two-source-verified reward data — the same
data the [RightCard iOS app](https://apps.apple.com/app/id6756834989) uses.

- **No bank login. No account. Nothing stored.** You pass card ids and a store name; you get an answer.
- Honest by construction: merchant-code caveats (Costco is a warehouse club, so the grocery bonus
  won't post), rotating quarters with activation flags, ties named, points valued per program.
- Cash value by default; `valuation: "points"` for conservative travel values.

## Use it

Hosted (stateless Streamable HTTP):

```
https://mcp.rightcard.ai/mcp
```

Local (stdio, nothing leaves your machine except a read of the public catalog):

```
npx rightcard-mcp
```

Claude Desktop / Claude Code / Cursor config:

```json
{ "mcpServers": { "rightcard": { "command": "npx", "args": ["-y", "rightcard-mcp"] } } }
```

## Tools

| tool | what it answers |
|---|---|
| `best_card` | which of the given cards earns most at a store or category, today, with caveats |
| `lookup_merchant` | how a store is coded (category, merchant type, MCC-trap caveat) |
| `search_cards` | find card ids by name/issuer; verified first, unverified flagged |
| `card` | one card's verified rates, rotating windows, choose-your-category spec |
| `rotating_calendar` | live + upcoming rotating windows and permanent merchant benefits |

Try: "I have the Amex Gold, Freedom Flex and Citi Double Cash. Which one at Costco?"

## Parity with the app

`src/engine.ts` is a port of the iOS app's Swift engine. `fixtures/engine_golden.json` holds
3,100+ answers produced by the Swift code over the real catalog and merchant directory;
`npm test` fails if the port disagrees on any of them. Offers (a user's personal bank offers)
are deliberately not part of this server — they live on the phone.

## Privacy

The hosted server logs request counts only. No identifiers, no cookies, no storage.
Full policy: https://rightcard.ai/privacy
