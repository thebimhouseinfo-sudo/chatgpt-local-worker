import path from "node:path";
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
    | "public_command"
    | "user_did_not_invoke_gptworker";
  trigger?: ActivationTrigger;
  workspace?: string;
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
  invocationRequest: string;
  workspace?: string;
  createdAt: number;
}

interface ArmedAtFlow {
  invocationRequest: string;
  createdAt: number;
}

const ADMISSION_TTL_MS = 30 * 60 * 1000;
// A bare @gptworker arms this chat flow until explicit stop or idle expiry.
// Match the active-work idle timeout so an abandoned armed flow cannot live forever.
const ARMED_FLOW_TTL_MS = 10 * 60 * 1000;

// Admission authority follows the opaque token, not one concrete MCP transport.
// The OpenAI connector may legitimately rotate/recover transport sessions
// between tool calls in the same chat flow. Keeping proofs process-scoped lets
// the same admission_token survive that transport churn while still requiring
// possession of the opaque token and honoring TTL/workspace binding.
const SHARED_ADMISSIONS = new Map<string, AdmissionProof>();

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

function isExplicitGptworkerInvocation(userTurn: string): boolean {
  return /^\s*@gptworker\b/i.test(userTurn);
}

function isPublicControlCommand(userTurn: string): boolean {
  const value = userTurn.trim();
  return (
    /^(?:gptworker|gr)\/$/i.test(value) ||
    /^(?:gptworker|gr)\/help$/i.test(value) ||
    /^(?:gptworker|gr)\/job\s+(list|create|update|remove|export|import|stop)$/i.test(value)
  );
}

export class AdmissionRuntime {
  private armedAtFlow: ArmedAtFlow | undefined;
  private readonly ownedAdmissionTokens = new Set<string>();

  private cleanup(): void {
    const now = Date.now();
    for (const [token, proof] of SHARED_ADMISSIONS) {
      if (now - proof.createdAt > ADMISSION_TTL_MS) {
        SHARED_ADMISSIONS.delete(token);
      }
    }
    if (
      this.armedAtFlow &&
      now - this.armedAtFlow.createdAt > ARMED_FLOW_TTL_MS
    ) {
      this.armedAtFlow = undefined;
    }
  }

  armExplicitAt(userTurn: string): boolean {
    this.cleanup();
    const request = userTurn?.trim();
    if (!request || !/@gptworker\b/i.test(request)) return false;
    this.armedAtFlow = {
      invocationRequest: request,
      createdAt: Date.now(),
    };
    return true;
  }

  isExplicitAtFlowArmed(): boolean {
    this.cleanup();
    return Boolean(this.armedAtFlow);
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

    let invocationRequest: string | undefined;
    let workspace: string | undefined;

    if (isExplicitGptworkerInvocation(userTurn)) {
      this.armExplicitAt(userTurn);
      invocationRequest = userTurn;
      const candidate = input.workspace?.trim();
      if (
        candidate &&
        path.isAbsolute(candidate) &&
        includesPath(userTurn, candidate)
      ) {
        workspace = path.resolve(candidate);
      }
    } else if (this.armedAtFlow) {
      // Once this chat/session was explicitly armed by @gptworker, subsequent
      // turns remain part of the GPTWorker flow even when Job, Workspace and
      // task arrive in separate messages. A Workspace is bound only when the
      // current turn actually supplies a matching absolute path.
      invocationRequest = this.armedAtFlow.invocationRequest;
      const candidate = input.workspace?.trim();
      const validWorkspace =
        Boolean(candidate) &&
        path.isAbsolute(candidate!) &&
        includesPath(userTurn, candidate!);

      if (validWorkspace) {
        workspace = path.resolve(candidate!);
      }
    }

    if (!invocationRequest) {
      return {
        mode: "INACTIVE",
        claimed: false,
        reason: "user_did_not_invoke_gptworker",
        next: "stop_gptworker_continue_normal_chat_or_requested_plugin",
      };
    }

    const token = randomUUID();
    SHARED_ADMISSIONS.set(token, {
      token,
      mode: "ACTIVE",
      trigger: "explicit_gptworker",
      request: userTurn,
      invocationRequest,
      workspace,
      createdAt: Date.now(),
    });
    this.ownedAdmissionTokens.add(token);

    // Keep the explicit @ flow armed for this chat/session. Admission tokens are
    // short-lived authorities for concrete nomination/confirmation, but minting
    // or consuming one does NOT require the user to repeat @gptworker. The arm
    // is cleared only by explicit job_stop/clear() or idle expiry.
    this.armedAtFlow.createdAt = Date.now();

    return {
      mode: "ACTIVE",
      claimed: true,
      reason: "explicit_gptworker",
      trigger: "explicit_gptworker",
      workspace,
      admission_token: token,
      next: "continue_gptworker",
    };
  }

  validate(
    token: string | undefined,
    expectedWorkspace?: string
  ): AdmissionProof {
    this.cleanup();
    if (!token) {
      throw new Error(
        "ADMISSION_REQUIRED: GPTWorker work must come from an explicit @gptworker flow."
      );
    }

    const proof = SHARED_ADMISSIONS.get(token);
    if (!proof) {
      throw new Error(
        "ADMISSION_REQUIRED: admission token is missing, stale, invalid, or belongs to another GPTWorker admission flow. Start again through @gptworker."
      );
    }

    if (expectedWorkspace) {
      const workspace = expectedWorkspace.trim();
      if (!path.isAbsolute(workspace)) {
        throw new Error(
          "ADMISSION_REQUIRED: Workspace must be an absolute local Workspace path."
        );
      }

      if (
        proof.workspace &&
        normalizedPath(proof.workspace) !== normalizedPath(workspace)
      ) {
        throw new Error(
          "ADMISSION_REQUIRED: Workspace does not match the Workspace admitted in this @gptworker flow."
        );
      }
    }

    return proof;
  }

  bindWorkspace(token: string | undefined, workspace: string): string {
    const proof = this.validate(token);
    const trimmed = workspace.trim();
    if (!path.isAbsolute(trimmed)) {
      throw new Error(
        "ADMISSION_REQUIRED: Workspace must be an absolute local Workspace path."
      );
    }

    const resolved = path.resolve(trimmed);
    if (
      proof.workspace &&
      normalizedPath(proof.workspace) !== normalizedPath(resolved)
    ) {
      throw new Error(
        "ADMISSION_REQUIRED: Workspace does not match the Workspace admitted in this @gptworker flow."
      );
    }

    if (!proof.workspace) proof.workspace = resolved;
    return proof.workspace;
  }

  activation(
    token: string | undefined,
    bindings?: Record<string, string>
  ): ActivationGateResult {
    const proof = this.validate(token, bindings?.workspace);

    return validateActivationGate({
      trigger: proof.trigger,
      activationWorkspace: proof.workspace,
      activationRequest: proof.invocationRequest,
      bindings,
    });
  }

  consume(token: string | undefined): void {
    this.cleanup();
    if (!token) return;
    SHARED_ADMISSIONS.delete(token);
    this.ownedAdmissionTokens.delete(token);
  }

  clear(): void {
    for (const token of this.ownedAdmissionTokens) {
      SHARED_ADMISSIONS.delete(token);
    }
    this.ownedAdmissionTokens.clear();
    this.armedAtFlow = undefined;
  }
}

export function validateActivationGate(input: ActivationGateInput): ActivationGateResult {
  if (input.trigger !== "explicit_gptworker") {
    throw new Error(
      "ACTIVATION_REQUIRED: GPTWorker work may start only from an explicit @gptworker flow. A task, local path, memory, previous chat, project familiarity, or GPTWorker availability is not activation evidence."
    );
  }

  const request = input.activationRequest?.trim();
  if (!request) {
    throw new Error(
      "ACTIVATION_REQUIRED: activation_request must contain the explicit @gptworker invocation for this admission flow."
    );
  }

  if (!isExplicitGptworkerInvocation(request)) {
    throw new Error(
      "ACTIVATION_REQUIRED: explicit_gptworker requires the current user turn to start with @gptworker."
    );
  }

  const workspace = input.bindings?.workspace?.trim();
  if (workspace && !path.isAbsolute(workspace)) {
    throw new Error(
      "ACTIVATION_REQUIRED: Workspace must be an absolute local Workspace path."
    );
  }

  return {
    trigger: "explicit_gptworker",
    workspace: workspace ? path.resolve(workspace) : undefined,
    request,
  };
}
