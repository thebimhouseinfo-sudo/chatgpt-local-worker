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

  const request = input.activationRequest?.trim();
  if (!request) {
    throw new Error(
      "ACTIVATION_REQUIRED: activation_request must contain the current-session user text that actually triggered GPTWorker. Never synthesize it from memory or another chat."
    );
  }

  if (input.trigger === "explicit_gptworker") {
    if (!/@gptworker\b/i.test(request)) {
      throw new Error(
        "ACTIVATION_REQUIRED: explicit_gptworker requires literal @gptworker in the current-session activating user text."
      );
    }
    return { trigger: input.trigger, request };
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

  const requestComparable =
    process.platform === "win32" ? request.toLowerCase() : request;
  const workspaceComparable =
    process.platform === "win32" ? activationWorkspace.toLowerCase() : activationWorkspace;
  if (!requestComparable.includes(workspaceComparable)) {
    throw new Error(
      "ACTIVATION_REQUIRED: task_with_workspace requires the explicit local Workspace path to appear in the current-session activating user text. A path recovered from memory, another chat, Worker state, or project history is invalid."
    );
  }

  return {
    trigger: input.trigger,
    workspace: boundWorkspace,
    request,
  };
}
