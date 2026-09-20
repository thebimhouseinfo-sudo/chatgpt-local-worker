import path from "node:path";
import { randomUUID } from "node:crypto";

export type ActivationTrigger = "explicit_gptworker" | "task_with_workspace";
export type AdmissionMode = "active" | "control" | "inactive";

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

export interface AdmissionCheckInput {
  userTurn: string;
  hasConcreteTask?: boolean;
  workspace?: string;
}

export interface AdmissionDecision {
  mode: AdmissionMode;
  claimed: boolean;
  reason:
    | "explicit_gptworker"
    | "task_with_workspace"
    | "public_command"
    | "user_did_not_invoke_gptworker";
  trigger?: ActivationTrigger;
  workspace?: string;
  admissionToken?: string;
  next:
    | "continue_gptworker"
    | "run_control_command_only"
    | "stop_gptworker_continue_normal_chat_or_requested_plugin";
}

interface AdmissionProof {
  token: string;
  mode: "active";
  trigger: ActivationTrigger;
  request: string;
  workspace?: string;
  createdAt: number;
}

const ADMISSION_TTL_MS = 30 * 60 * 1000;
const admissions = new Map<string, AdmissionProof>();

function normalizedPath(value: string): string {
  let normalized = path.resolve(value.trim());
  if (process.platform === "win32") normalized = normalized.toLowerCase();
  return normalized.replace(/[\\/]+$/, "");
}

function includesPath(request: string, workspace: string): boolean {
  const requestComparable =
    process.platform === "win32" ? request.toLowerCase() : request;
  const workspaceComparable =
    process.platform === "win32" ? workspace.toLowerCase() : workspace;
  return requestComparable.includes(workspaceComparable);
}

function isPublicControlCommand(userTurn: string): boolean {
  const value = userTurn.trim();
  return (
    /^gptworker\/$/i.test(value) ||
    /^gptworker\/help$/i.test(value) ||
    /^gptworker\/job\s+(list|create|update|remove|export|import|stop)$/i.test(value)
  );
}

function cleanupAdmissions(): void {
  const now = Date.now();
  for (const [token, proof] of admissions) {
    if (now - proof.createdAt > ADMISSION_TTL_MS) admissions.delete(token);
  }
}

export function checkAdmission(input: AdmissionCheckInput): AdmissionDecision {
  cleanupAdmissions();

  const userTurn = input.userTurn?.trim();
  if (!userTurn) {
    return {
      mode: "inactive",
      claimed: false,
      reason: "user_did_not_invoke_gptworker",
      next: "stop_gptworker_continue_normal_chat_or_requested_plugin",
    };
  }

  if (isPublicControlCommand(userTurn)) {
    return {
      mode: "control",
      claimed: false,
      reason: "public_command",
      next: "run_control_command_only",
    };
  }

  let trigger: ActivationTrigger | undefined;
  let workspace: string | undefined;

  if (/@gptworker\b/i.test(userTurn)) {
    trigger = "explicit_gptworker";
  } else {
    const candidate = input.workspace?.trim();
    const hasWorkspace =
      Boolean(candidate) &&
      path.isAbsolute(candidate!) &&
      includesPath(userTurn, candidate!);

    if (input.hasConcreteTask === true && hasWorkspace) {
      trigger = "task_with_workspace";
      workspace = path.resolve(candidate!);
    }
  }

  if (!trigger) {
    return {
      mode: "inactive",
      claimed: false,
      reason: "user_did_not_invoke_gptworker",
      next: "stop_gptworker_continue_normal_chat_or_requested_plugin",
    };
  }

  const token = randomUUID();
  admissions.set(token, {
    token,
    mode: "active",
    trigger,
    request: userTurn,
    workspace,
    createdAt: Date.now(),
  });

  return {
    mode: "active",
    claimed: true,
    reason: trigger,
    trigger,
    workspace,
    admissionToken: token,
    next: "continue_gptworker",
  };
}

export function validateAdmissionToken(
  token: string | undefined,
  expectedWorkspace?: string
): AdmissionProof {
  cleanupAdmissions();
  if (!token) {
    throw new Error(
      "ADMISSION_REQUIRED: call gptworker_admission first. GPTWorker work tools cannot be entered directly."
    );
  }

  const proof = admissions.get(token);
  if (!proof) {
    throw new Error(
      "ADMISSION_REQUIRED: admission token is missing, stale, or invalid. Re-run gptworker_admission against the current user request."
    );
  }

  if (expectedWorkspace && proof.trigger === "task_with_workspace") {
    if (normalizedPath(proof.workspace || "") !== normalizedPath(expectedWorkspace)) {
      throw new Error(
        "ADMISSION_REQUIRED: Workspace does not match the Workspace bound to this admission token."
      );
    }
  }

  return proof;
}

export function activationFromAdmission(
  token: string | undefined,
  bindings?: Record<string, string>
): ActivationGateResult {
  const expectedWorkspace = bindings?.workspace;
  const proof = validateAdmissionToken(token, expectedWorkspace);

  return validateActivationGate({
    trigger: proof.trigger,
    activationWorkspace: proof.workspace,
    activationRequest: proof.request,
    bindings,
  });
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

  if (!includesPath(request, activationWorkspace)) {
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
