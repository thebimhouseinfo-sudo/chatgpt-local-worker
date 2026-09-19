import assert from "node:assert/strict";
import {
  buildLegacyDiscoverFallback,
  isServerDiscoverRequest,
} from "../dist/lib/mcp-discover-compat.js";

const discover = {
  jsonrpc: "2.0",
  id: 17,
  method: "server/discover",
  params: {
    _meta: {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    },
  },
};

assert.equal(isServerDiscoverRequest(discover), true);

const fallback = buildLegacyDiscoverFallback(discover);
assert.deepEqual(fallback, {
  jsonrpc: "2.0",
  id: 17,
  error: {
    code: -32601,
    message: 'method not found: "server/discover"',
  },
});

assert.equal(
  buildLegacyDiscoverFallback({
    jsonrpc: "2.0",
    id: 18,
    method: "initialize",
    params: { protocolVersion: "2025-11-25" },
  }),
  null
);

assert.deepEqual(
  buildLegacyDiscoverFallback({
    jsonrpc: "2.0",
    method: "server/discover",
  }),
  {
    jsonrpc: "2.0",
    id: null,
    error: {
      code: -32601,
      message: 'method not found: "server/discover"',
    },
  }
);

console.log("MCP server/discover legacy fallback tests passed");
