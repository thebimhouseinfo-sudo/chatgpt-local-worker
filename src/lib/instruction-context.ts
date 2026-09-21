import { getChatGptToolProfile } from "./tool-profile.js";
import { buildServerInstructions } from "./quickstart.js";

export interface InstructionContextOptions {
  workspaceRoot: string;
  workspaceRoots: string[];
  pid: number;
}

export interface InstructionContext {
  workspaceRoot: string;
  workspaceRoots: string[];
  toolProfile: "full" | "slim";
  contextText: string;
  instructionsText: string;
  instructionBytes: number;
}

export async function buildInstructionContext(
  opts: InstructionContextOptions
): Promise<InstructionContext> {
  const toolProfile = getChatGptToolProfile();

  const contextText = [
    "## GPTWorker control plane",
    "GPTWorker starts idle. Startup folders are environment context only; they are not Job/work authority.",
    "Project files, project-local context, skills, and Git state are loaded only after an explicit GPTWorker Job flow requires them.",
    `Tool profile: **${toolProfile}**.`,
    "",
    "## Runtime environment",
    `Platform: ${process.platform}`,
    `Node: ${process.version}`,
    `MCP PID: ${opts.pid}`,
    `Startup root: ${opts.workspaceRoot}`,
    opts.workspaceRoots.length > 1
      ? `Configured startup roots:\n${opts.workspaceRoots.map((root) => `- ${root}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const instructionsText = buildServerInstructions(
    opts.workspaceRoot,
    opts.workspaceRoots,
    true,
    contextText
  );

  return {
    workspaceRoot: opts.workspaceRoot,
    workspaceRoots: [...opts.workspaceRoots],
    toolProfile,
    contextText,
    instructionsText,
    instructionBytes: Buffer.byteLength(instructionsText, "utf-8"),
  };
}

export function summarizeInstructionContext(
  ctx: InstructionContext
): Record<string, unknown> {
  return {
    mode: "control-plane",
    root: ctx.workspaceRoot,
    workspace_roots: ctx.workspaceRoots,
    instruction_bytes: ctx.instructionBytes,
    tool_profile: ctx.toolProfile,
  };
}
