import path from "node:path";

export type ActivationTrigger = "explicit_gptworker" | "task_with_workspace";

export interface ActivationGateInput {
  trigger: ActivationTrigger | undefined;
  activationWorkspace?: string;
  activationRequest?: string;
  bindings?: Record<string, string>;
}

export interface ActivationGateResult {
  trigger: ActivationTrigger;
  workspace?: string;
  request?: string;
}

function normalizedPath(value: string): string {
  let normalized = path.resolve(value.trim());
  if (process.platform === "win32") normalized = normalized.toLowerCase();
  return normalized.replace(/[\\/]+$/, "");
}

export function validateActivationGate(input: ActivationGateInput): ActivationGateResult {
  if (!input.trigger) {
    throw new Error(
      "ACTIVATION_REQUIRED: GPTWorker may start only after an explicit @gptworker invocation in this chat, or a concrete work request that includes an explicit absolute local Workspace. Do not infer activation from memory, previous chats, project familiarity, or the availability of GPTWorker."
    );
  }

  if (input.trigger === "explicit_gptworker") {
    return { trigger: input.trigger };
  }

  const request = input.activationRequest?.trim();
  if (!request) {
    throw new Error(
      "ACTIVATION_REQUIRED: task_with_workspace requires the concrete user work request that triggered GPTWorker."
    );
  }

  const activationWorkspace = input.activationWorkspace?.trim();
  if (!activationWorkspace || !path.isAbsolute(activationWorkspace)) {
    throw new Error(
      "ACTIVATION_REQUIRED: task_with_workspace requires an absolute local Workspace explicitly supplied with the activating work request."
    );
  }

  const boundWorkspace = input.bindings?.workspace?.trim();
  if (!boundWorkspace || !path.isAbsolute(boundWorkspace)) {
    throw new Error(
      "ACTIVATION_REQUIRED: task_with_workspace requires bindings.workspace to be the explicit absolute local Workspace."
    );
  }

  if (normalizedPath(activationWorkspace) !== normalizedPath(boundWorkspace)) {
    throw new Error(
      "ACTIVATION_REQUIRED: activation_workspace must match bindings.workspace. Do not substitute a remembered or previously used Workspace."
    );
  }

  return {
    trigger: input.trigger,
    workspace: boundWorkspace,
    request,
  };
}
