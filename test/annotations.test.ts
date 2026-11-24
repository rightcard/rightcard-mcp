import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/tools.js";

// The Claude directory reads a tool's human name from annotations.title and
// flags any tool without one. Every tool is read-only, and both must stay true.
describe("tool annotations", () => {
  it("every tool carries its title inside annotations and is read-only", async () => {
    const server = buildServer(async () => { throw new Error("catalog not needed to list tools"); });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await server.connect(serverSide);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(clientSide);

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["best_card", "card", "lookup_merchant", "rotating_calendar", "search_cards"]);
    for (const t of tools) {
      expect(t.annotations?.title, t.name).toBeTruthy();
      expect(t.annotations?.title, t.name).toBe(t.title);
      expect(t.annotations?.readOnlyHint, t.name).toBe(true);
      expect(t.annotations?.destructiveHint, t.name).toBe(false);
    }
    await client.close();
  });
});
