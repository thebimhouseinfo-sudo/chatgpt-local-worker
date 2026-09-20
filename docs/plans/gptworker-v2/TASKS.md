# GPTWorker v2 — Execution Ledger

This ledger supersedes the previous session-centric task mapping. The architecture is now Work Registration + Workspace Ownership + shared Tool Families with on-demand ephemeral instances.

| ID | Status | Task / Output | Depends On | Acceptance | Progress / Notes |
|---|---|---|---|---|---|
| TASK-V2-LOG-001 | DONE | Automatic structured runtime logging, redaction, rotation, Admin history | None | CI pass + live Windows/ChatGPT/tunnel log; secrets redacted; MCP/session/tool evidence captured | Live evidence collected 2026-09-20; transport session proved unsuitable as work identity |
| TASK-V2-001 | IN_PROGRESS | WorkRegistration contract, WorkspaceKey, DriverEpoch and work-handle naming | TASK-V2-LOG-001 | deterministic workspace key; readable execution ID; opaque authority token; epoch/generation non-reuse; live handle continuity | First implementation slice: work registration + ephemeral native tool lease logging; live acceptance defined in WORK_TOOL_LEASE_PILOT.md |
| TASK-V2-002 | READY | WorkspaceOwnershipRegistry + registration/confirmation/replace gate | TASK-V2-001 | one owner per canonical workspace; missing/stale/wrong-token → NO_ACTIVE_WORK; duplicate → WORKSPACE_BUSY; explicit confirmed replace recovers orphaned registration | No fallback or silent attach to most-recent Job/workspace |
| TASK-V2-003 | TODO | ExecutionContext injection and removal of global Job/cwd/context authority | TASK-V2-002 | A/B interleaving does not change each other's Job/workspace/context | Covers current global cwd/instruction context risks |
| TASK-V2-004 | TODO | Tool Family Registry + ephemeral instance factory + immutable ToolContext | TASK-V2-003 | shared families; Job cannot register duplicate core tools; instances cannot rebind | No fixed pool/free-list |
| TASK-V2-005 | TODO | ActiveToolLeaseRegistry + stateful resource ownership + stop/switch cleanup | TASK-V2-004 | short leases disappear after call; long resource leases persist correctly; stop A does not affect B | Lease ID contains family/job/workspace/generation/call sequence |
| TASK-V2-006 | TODO | Multi-execution concurrency acceptance and remaining global-state refactor | TASK-V2-005 | many executions call same family concurrently on different workspaces without family-level queue | Stress read/write/shell/git/process |
| TASK-V2-007 | DEFERRED | Optional Driver / IPC split | TASK-V2-003, TASK-V2-005 | Only implement if monolithic/manual launch becomes insufficient | Not a v2 finalization gate |
| TASK-V2-008 | TODO | Stateful resource ownership + 10-minute full idle stop | TASK-V2-005 | no active call is killed mid-flight; after 10 idle minutes WorkRegistration, workspace ownership and owned resources are released | Does not require Driver split |
| TASK-V2-009 | DEFERRED | AppData migration trial after repo-local v2 finalization | TASK-V2-003, TASK-V2-012 | same Job lifecycle works from AppData; customized packs preserved | Do only after live repo-local acceptance |
| TASK-V2-010 | TODO | Manifest/API compatibility + immutable pack revision snapshots | TASK-V2-004, TASK-V2-009 | active execution pins revision; malformed/colliding resources rejected | Keep JSON-compatible YAML initially |
| TASK-V2-011 | IN_PROGRESS | Repo-local staging/validate/publish primitives | TASK-V2-005 | invalid pack never live; update rollback safe; path scope validated | Implemented in current authoring wave |
| TASK-V2-012 | IN_PROGRESS | Job Authoring workflow + public list/create/update/remove | TASK-V2-011 | create/list/update/remove works live through ChatGPT | stop remains internal only |
| TASK-V2-013 | DEFERRED | Optional Windows background host | TASK-V2-008, TASK-V2-009 | implement only if manual launch is insufficient | Not a release gate |
| TASK-V2-014 | DEFERRED | EXE packaging after AppData trial | TASK-V2-009, TASK-V2-012 | clean-machine packaging preserves customized Jobs | Last step only |

## Execution Rules

- Status: TODO, READY, IN_PROGRESS, BLOCKED, DEFERRED, DONE.
- Do not use MCP transport session as execution authority.
- Do not introduce a global active Job or global cwd fallback.
- Do not add a fixed number of tool instances per family.
- Do not queue calls merely because they use the same Tool Family.
- Every execution tool must resolve a valid WorkRegistration and matching authority token before creating its instance.
- Tool instance identity is immutable for its lifetime.
- Workspace ownership is exclusive at canonical workspace level.
- Active registration auto-stops after 10 idle minutes; active foreground leases suspend the timeout until release.
- DriverEpoch changes on every Driver start; readable execution IDs must not be reused across epochs.
- Lost-handle/orphan recovery is explicit confirmed replacement, never auto-attach.
- P1 is not DONE until live ChatGPT proves handle continuity across repeated and interleaved calls.
- DONE requires deterministic tests plus live acceptance when transport/Windows lifecycle is involved.
- Scope changes must update ARCHITECTURE.md before implementation.

## Completion Summary

2026-09-20:
- Public Job UX changed to list/create/update/remove; stop is internal only.
- Mutable Job Packs remain repo-local until v2 behavior is finalized.
- Driver and EXE work are deferred; AppData migration comes after repo-local live acceptance.
- P0 logging implementation and hardening merged; CI passed.
- Live runtime evidence collected.
- Architecture changed from session-centric identity to explicit Job + Workspace Work Registration.
- MCP transport session is now explicitly non-authoritative.
- P1 starts with WorkRegistration + WorkspaceOwnership, then ExecutionContext and Tool Family refactor.
