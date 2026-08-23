#!/usr/bin/env node
// Local stdio server: `npx rightcard-mcp`. Reads the public catalog once an hour,
// answers over stdin/stdout, sends nothing anywhere else.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "./tools.js";
import { catalogCache } from "./data.js";

const server = buildServer(catalogCache());
await server.connect(new StdioServerTransport());
