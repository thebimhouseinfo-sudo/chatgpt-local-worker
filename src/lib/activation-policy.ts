import { randomUUID } from "node:crypto";

export type ActivationTrigger = "explicit_gptworker";
export type AdmissionMode = "ACTIVE" | "CONTROL" | "INACTIVE";

export interface ActivationGateInput {
  trigger: ActivationTrigger | undefined;
  activationWorkspace?: string;
  activationRequest?: string;
  bindings?: Record<string, string>;
}

export interface ActivationGateResult {
  trigger: ActivationTrigger;
  request?: string;
}

export interface AdmissionCheckInput {
  userTurn: string;
  // Retained for tool-schema compatibility only. These fields can never
  // activate GPTWorker without a literal @gptworker in userTurn.
  hasConcreteTask?: boolean;
  workspace?: string;
}

export interface AdmissionDecision {
  mode: AdmissionMode;
  claimed: boolean;
  reason:
    | "explicit_gptworker"
    | "public_command"
    | "user_did_not_invoke_gptworker";
  trigger?: ActivationTrigger;
  admission_token?: string;
  next:
    | "continue_gptworker"
    | "run_control_command_only"
    | "stop_gptworker_continue_normal_chat_or_requested_plugin";
}

interface AdmissionProof {
  token: string;
  mode: "ACTIVE";
  trigger: ActivationTrigger;
  request: string;
  createdAt: number;
}

const ADMISSION_TTL_MS = 30 * 60 * 1000;

function isPublicControlCommand(userTurn: string): boolean {
  const value = userTurn.trim();
  return (
    /^gptworker\/$/i.test(value) ||
    /^gptworker\/help$/i.test(value) ||
    /^gptworker\/job\s+(list|create|update|remove|export|import|stop)$/i.test(value)
  );
}

export class AdmissionRuntime {
  private readonly admissions = new Map<string, AdmissionProof>();

  private cleanup(): void {
    const now = Date.now();
    for (const [token, proof] of this.admissions) {
      if (now - proof.createdAt > ADMISSION_TTL_MS) {
        this.admissions.delete(token);
      }
    }
  }

  check(input: AdmissionCheckInput): AdmissionDecision {
    this.cleanup();

    const userTurn = input.userTurn?.trim();
    if (!userTurn) {
      return {
        mode: "INACTIVE",
        claimed: false,
        reason: "user_did_not_invoke_gptworker",
        next: "stop_gptworker_continue_normal_chat_or_requested_plugin",
      };
    }

    if (isPublicControlCommand(userTurn)) {
      return {
        mode: "CONTROL",
        claimed: false,
        reason: "public_command",
        next: "run_control_command_only",
      };
    }

    // Work activation is deliberately @-only.
    // A task plus an absolute local path is NOT activation evidence.
    if (!/@gptworker\b/i.test(userTurn)) {
      return {
        mode: "INACTIVE",
        claimed: false,
        reason: "user_did_not_invoke_gptworker",
        next: "stop_gptworker_continue_normal_chat_or_requested_plugin",
      };
    }

    const token = randomUUID();
    const proof: AdmissionProof = {
      token,
      mode: "ACTIVE",
      trigger: "explicit_gptworker",
      request: userTurn,
      createdAt: Date.now(),
    };
    this.admissions.set(token, proof);

    return {
      mode: "ACTIVE",
      claimed: true,
      reason: "explicit_gptworker",
      trigger: "explicit_gptworker",
      admission_token: token,
      next: "continue_gptworker",
    };
  }

  validate(
    token: string | undefined,
    _expectedWorkspace?: string
  ): AdmissionProof {
    this.cleanup();
    if (!token) {
      throw new Error(
        "ADMISSION_REQUIRED: call gptworker_admission first. GPTWorker work tools cannot be entered directly."
      );
    }

    const proof = this.admissions.get(token);
    if (!proof) {
      throw new Error(
        "ADMISSION_REQUIRED: admission token is missing, stale, invalid, or belongs to another MCP session. Re-run gptworker_admission after an explicit @gptworker invocation."
      );
    }

    return proof;
  }

  activation(
    token: string | undefined,
    bindings?: Record<string, string>
  ): ActivationGateResult {
    const proof = this.validate(token, bindings?.workspace);

    return validateActivationGate({
      trigger: proof.trigger,
      activationRequest: proof.request,
      bindings,
    });
  }

  clear(): void {
    this.admissions.clear();
  }
}

export function validateActivationGate(input: ActivationGateInput): ActivationGateResult {
  if (input.trigger !== "explicit_gptworker") {
    throw new Error(
      "ACTIVATION_REQUIRED: GPTWorker work may start only after a literal @gptworker invocation. A task, local path, memory, previous chat, project familiarity, or GPTWorker availability is not activation evidence."
    );
  }

  const request = input.activationRequest?.trim();
  if (!request) {
    throw new Error(
      "ACTIVATION_REQUIRED: activation_request must contain the current-session user text that actually invoked @gptworker. Never synthesize it from memory or another chat."
    );
  }

  if (!/@gptworker\b/i.test(request)) {
    throw new Error(
      "ACTIVATION_REQUIRED: explicit_gptworker requires literal @gptworker in the current-session activating user text."
    );
  }

  return { trigger: "explicit_gptworker", request };
}
