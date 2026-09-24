import { buildServerInstructions } from "./quickstart.js";

export interface InstructionContextOptions {
  workspaceRoot: string;
  workspaceRoots: string[];
  pid: number;
}

export interface InstructionContext {
  workspaceRoot: string;
  workspaceRoots: string[];
  contextText: string;
  instructionsText: string;
  instructionBytes: number;
}

export async function buildInstructionContext(
  opts: InstructionContextOptions
): Promise<InstructionContext> {
  const contextText = [
    "## GPTWorker control plane",
    "GPTWorker starts idle. Startup folders are internal environment data only; they are not Job/work authority and are not candidate work folders.",
    "Project files, project-local context, skills, and Git state are loaded only after an explicit GPTWorker Job flow requires them.",
    "",
    "## Runtime environment",
    `Platform: ${process.platform}`,
    `Node: ${process.version}`,
  ]
    .filter(Boolean)
    .join("\n");

  const instructionsText = buildServerInstructions(
    opts.workspaceRoot,
    opts.workspaceRoots,
    contextText
  );

  return {
    workspaceRoot: opts.workspaceRoot,
    workspaceRoots: [...opts.workspaceRoots],
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
  };
}
