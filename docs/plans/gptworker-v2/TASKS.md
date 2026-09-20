# GPTWorker v2 — Execution Ledger

This ledger supersedes the previous session-centric task mapping. The architecture is now Work Registration + Workspace Ownership + shared Tool Families with on-demand ephemeral instances.

| ID | Status | Task / Output | Depends On | Acceptance | Progress / Notes |
|---|---|---|---|---|---|
| TASK-V2-LOG-001 | DONE | Automatic structured runtime logging, redaction, rotation, Admin history | None | CI pass + live Windows/ChatGPT/tunnel log; secrets redacted; MCP/session/tool evidence captured | Live evidence collected 2026-09-20; transport session proved unsuitable as work identity |
| TASK-V2-001 | READY | WorkRegistration contract, WorkspaceKey, DriverEpoch and work-handle naming | TASK-V2-LOG-001 | deterministic workspace key; readable execution ID; opaque authority token; epoch/generation non-reuse; live handle continuity | New architecture approved; final review added epoch/token/live-carry acceptance |
| TASK-V2-002 | READY | WorkspaceOwnershipRegistry + registration/confirmation/replace gate | TASK-V2-001 | one owner per canonical workspace; missing/stale/wrong-token → NO_ACTIVE_WORK; duplicate → WORKSPACE_BUSY; explicit confirmed replace recovers orphaned registration | No fallback or silent attach to most-recent Job/workspace |
| TASK-V2-003 | TODO | ExecutionContext injection and removal of global Job/cwd/context authority | TASK-V2-002 | A/B interleaving does not change each other's Job/workspace/context | Covers current global cwd/instruction context risks |
| TASK-V2-004 | TODO | Tool Family Registry + ephemeral instance factory + immutable ToolContext | TASK-V2-003 | shared families; Job cannot register duplicate core tools; instances cannot rebind | No fixed pool/free-list |
| TASK-V2-005 | TODO | ActiveToolLeaseRegistry + stateful resource ownership + stop/switch cleanup | TASK-V2-004 | short leases disappear after call; long resource leases persist correctly; stop A does not affect B | Lease ID contains family/job/workspace/generation/call sequence |
| TASK-V2-006 | TODO | Multi-execution concurrency acceptance and remaining global-state refactor | TASK-V2-005 | many executions call same family concurrently on different workspaces without family-level queue | Stress read/write/shell/git/process |
| TASK-V2-007 | TODO | Driver public gateway + versioned IPC executor | TASK-V2-003, TASK-V2-005 | Driver remains authority while Worker can restart; protocol state separated from execution state | MCP sessions remain transport-only |
| TASK-V2-008 | TODO | WakeCoordinator + quiescence-based Worker sleep | TASK-V2-007 | registrations survive >=3 sleep/wake cycles; no inactivity timeout required; live resources block sleep | Driver/tunnel stay alive |
| TASK-V2-009 | TODO | installRoot/dataRoot split + AppData migration + portable harness | TASK-V2-003 | packs run outside checkout; customized packs preserved | job.yaml remains sole registry |
| TASK-V2-010 | TODO | Manifest/API compatibility + immutable pack revision snapshots | TASK-V2-004, TASK-V2-009 | active execution pins revision; malformed/colliding resources rejected | Keep JSON-compatible YAML initially |
| TASK-V2-011 | TODO | Pack staging/publish/history transaction primitives | TASK-V2-005, TASK-V2-010 | invalid pack never live; revision conflict deterministic; crash recovery valid | Internal publish infrastructure |
| TASK-V2-012 | TODO | Job Authoring workflow + minimal chat control mapping | TASK-V2-011 | create/update validated; four public commands stay minimal | Internal register/status/switch allowed |
| TASK-V2-013 | TODO | Windows logon host, supervision, tunnel/executor lifecycle | TASK-V2-008, TASK-V2-009 | duplicate start/network reconnect/suspend/child crash handled; no credential leak | User-mode Driver |
| TASK-V2-014 | TODO | Packaging, clean-machine upgrade/uninstall, v2 release acceptance | TASK-V2-010, TASK-V2-012, TASK-V2-013 | install→register→parallel work→sleep/wake→upgrade preserving Jobs | Final release gate |

## Execution Rules

- Status: TODO, READY, IN_PROGRESS, BLOCKED, DONE.
- Do not use MCP transport session as execution authority.
- Do not introduce a global active Job or global cwd fallback.
- Do not add a fixed number of tool instances per family.
- Do not queue calls merely because they use the same Tool Family.
- Every execution tool must resolve a valid WorkRegistration and matching authority token before creating its instance.
- Tool instance identity is immutable for its lifetime.
- Workspace ownership is exclusive at canonical workspace level.
- Active registration has no inactivity timeout by default.
- DriverEpoch changes on every Driver start; readable execution IDs must not be reused across epochs.
- Lost-handle/orphan recovery is explicit confirmed replacement, never auto-attach.
- P1 is not DONE until live ChatGPT proves handle continuity across repeated and interleaved calls.
- DONE requires deterministic tests plus live acceptance when transport/Windows lifecycle is involved.
- Scope changes must update ARCHITECTURE.md before implementation.

## Completion Summary

2026-09-20:
- P0 logging implementation and hardening merged; CI passed.
- Live runtime evidence collected.
- Architecture changed from session-centric identity to explicit Job + Workspace Work Registration.
- MCP transport session is now explicitly non-authoritative.
- P1 starts with WorkRegistration + WorkspaceOwnership, then ExecutionContext and Tool Family refactor.
