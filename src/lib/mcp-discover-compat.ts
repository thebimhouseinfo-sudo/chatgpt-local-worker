/**
 * Compatibility shim for MCP 2026-07-28 clients probing a legacy/stateful
 * MCP SDK v1 server.
 *
 * Modern clients send a stateless server/discover request before deciding
 * whether to use the 2026-07-28 flow. A legacy server should reject that
 * method as JSON-RPC MethodNotFound without creating a session. The client
 * then falls back to the legacy initialize handshake (currently 2025-11-25).
 */

export interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  error: {
    code: -32601;
    message: string;
  };
}

function requestId(body: unknown): string | number | null {
  if (typeof body !== "object" || body === null || !("id" in body)) return null;
  const id = (body as { id?: unknown }).id;
  return typeof id === "string" || typeof id === "number" ? id : null;
}

export function isServerDiscoverRequest(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  return (body as { method?: unknown }).method === "server/discover";
}

export function buildLegacyDiscoverFallback(body: unknown): JsonRpcErrorResponse | null {
  if (!isServerDiscoverRequest(body)) return null;

  return {
    jsonrpc: "2.0",
    id: requestId(body),
    error: {
      code: -32601,
      message: 'method not found: "server/discover"',
    },
  };
}
