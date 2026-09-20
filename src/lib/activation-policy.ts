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

export class AdmissionRuntime {
  private readonly admissions = new Map<string, AdmissionProof>();
  private armedAtFlow: ArmedAtFlow | undefined;

  private cleanup(): void {
    const now = Date.now();
    for (const [token, proof] of this.admissions) {
      if (now - proof.createdAt > ADMISSION_TTL_MS) {
        this.admissions.delete(token);
      }
    }
    if (
      this.armedAtFlow &&
      now - this.armedAtFlow.createdAt > ADMISSION_TTL_MS
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

    if (/@gptworker\b/i.test(userTurn)) {
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
      // Continuation is allowed only after an explicit @gptworker invocation
      // was observed in this exact MCP session.
      const candidate = input.workspace?.trim();
      const validWorkspace =
        Boolean(candidate) &&
        path.isAbsolute(candidate!) &&
        includesPath(userTurn, candidate!);

      if (validWorkspace) {
        invocationRequest = this.armedAtFlow.invocationRequest;
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
    this.admissions.set(token, {
      token,
      mode: "ACTIVE",
      trigger: "explicit_gptworker",
      request: userTurn,
      invocationRequest,
      workspace,
      createdAt: Date.now(),
    });

    // The explicit @ flow is one-shot for admitting a new Job/Workspace request.
    // Once a token is minted, the token carries the current flow through
    // nomination + confirmation; future direct requests must invoke @gptworker again.
    this.armedAtFlow = undefined;

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

    const proof = this.admissions.get(token);
    if (!proof) {
      throw new Error(
        "ADMISSION_REQUIRED: admission token is missing, stale, invalid, or belongs to another MCP session. Start again through @gptworker."
      );
    }

    if (expectedWorkspace && proof.workspace) {
      if (normalizedPath(proof.workspace) !== normalizedPath(expectedWorkspace)) {
        throw new Error(
          "ADMISSION_REQUIRED: Workspace does not match the Workspace admitted in this @gptworker flow."
        );
      }
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
      activationWorkspace: proof.workspace,
      activationRequest: proof.invocationRequest,
      bindings,
    });
  }

  consume(token: string | undefined): void {
    this.cleanup();
    if (!token) return;
    this.admissions.delete(token);
  }

  clear(): void {
    this.admissions.clear();
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
      "ACTIVATION_REQUIRED: activation_request must contain the explicit @gptworker invocation observed in this MCP session."
    );
  }

  if (!/@gptworker\b/i.test(request)) {
    throw new Error(
      "ACTIVATION_REQUIRED: explicit_gptworker requires literal @gptworker."
    );
  }

  const workspace = input.bindings?.workspace?.trim();
  return {
    trigger: "explicit_gptworker",
    workspace: workspace ? path.resolve(workspace) : undefined,
    request,
  };
}
