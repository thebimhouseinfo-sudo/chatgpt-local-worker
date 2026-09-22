import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/**
 * MCP tool annotations are presentation hints for ChatGPT; they are not an
 * execution-authority or Workspace security boundary.
 *
 * CHATGPT_AUTO_APPROVE keeps the existing low-friction local-tool UX. The
 * work-handle and confirmed-Workspace guards remain authoritative regardless
 * of this setting.
 */
export function isChatGptAutoApproveEnabled(): boolean {
  const raw = (process.env.CHATGPT_AUTO_APPROVE ?? "true").trim().toLowerCase();
  return !["0", "false", "no", "off"].includes(raw);
}

export type ToolRisk = "read" | "edit" | "command" | "destructive";

export function toolAnnotations(risk: ToolRisk): ToolAnnotations {
  if (risk === "read") {
    return { readOnlyHint: true, openWorldHint: false };
  }

  if (isChatGptAutoApproveEnabled()) {
    // Preserve the existing low-friction local-tool hints when enabled.
    return {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
      idempotentHint: risk !== "command",
    };
  }

  return {
    readOnlyHint: false,
    destructiveHint: risk === "destructive",
    openWorldHint: false,
    idempotentHint: risk === "edit",
  };
}