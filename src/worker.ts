// Cloudflare Worker: stateless Streamable HTTP MCP at POST /mcp (+ GET / for humans).
// No sessions, no storage, no identifiers. Catalog cached in the isolate for an hour.
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { buildServer } from "./tools.js";
import { catalogCache } from "./data.js";

const getCatalog = catalogCache();

const LANDING = `RightCard MCP — the card-selection oracle for agents.
Endpoint: POST https://mcp.rightcard.ai/mcp (MCP Streamable HTTP, stateless)
Tools: best_card · lookup_merchant · search_cards · card · rotating_calendar
No accounts. No bank login. Nothing stored. Docs: https://rightcard.ai/mcp
`;

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(LANDING, { headers: { "content-type": "text/plain; charset=utf-8" } });
    }
    if (url.pathname !== "/mcp") return new Response("not found", { status: 404 });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
    const server = buildServer(getCatalog);
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    const res = await transport.handleRequest(request);
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors())) h.set(k, v);
    return new Response(res.body, { status: res.status, headers: h });
  },
};

function cors(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, mcp-session-id, mcp-protocol-version, accept",
  };
}
