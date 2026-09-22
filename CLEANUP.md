# GPTWorker Cleanup Ledger

## Goal

Reduce GPTWorker to the runtime and packaging surfaces actually required by the current product, while preserving behavior and the confirmed-workspace safety invariant.

This cleanup also supports the provenance goal: remove inherited or compatibility code that no longer serves an active workflow before deciding which remaining upstream-derived implementations must be rewritten.

## Scope

Provenance/rewrite review applies to active runtime and files that may ship: `src/**`, active Job configuration, root runtime/setup/tray/tunnel scripts, and runtime/package metadata.

Development-only tests are not rewrite targets. `scripts/test-*.mjs` and other test-only files may remain temporarily for verification, but they are not part of the intended packaged artifact and do not need provenance-driven rewrites.

## Completed quarantine

- Claude workspace compatibility: `skills-loader.ts`, `path-rules.ts`, and their three obsolete context operations.
- Post-edit hook compatibility: `post-edit-hooks.ts`, `edit-enrichment.ts`, and `profiles/post-edit-hooks.json`.

## Current cleanup round

- [x] Retire the no-op legacy permission abstraction `src/lib/permissions.ts`.
- [x] Report confirmed-workspace authority directly instead of the obsolete `open/full machine` permission profile.
- [x] Quarantine unused `profiles/chatgpt-connector-description.txt`.
- [x] Move driver epoch runtime state out of the repository into `getWorkerDataRoot()` and quarantine the obsolete tracked root marker.
- [x] Retire standalone `stop.ps1`; tray/reset-runtime remains the supported stop/reset path.
- [x] Remove inert preload tokens `mcp`, `ponytail`, and `rewind` from runtime-family policy, Job runtime/tool schemas, and default Job configs.
- [x] Run local TypeScript build for the completed dead-compatibility cleanup round.
- [x] Run Job Pack validation for the completed dead-compatibility cleanup round.
- [x] Run runtime acceptance for the completed dead-compatibility cleanup round.
- [x] Remove quarantine after that active runtime validation passed.

> These PASS results predate the later retirement of the dedicated Git runtime family. They remain valid evidence for the earlier cleanup round, but they do **not** certify the current post-Git-retirement HEAD.

## Post-Git-retirement cleanup

The dedicated Git subsystem has now been removed from the active runtime:

- [x] Delete `src/tools/git.ts`.
- [x] Remove `git` from runtime families and lazy work-gateway registration.
- [x] Remove dedicated `git_*` operations from the tool catalog.
- [x] Remove `git` from bundled Job preload families.
- [x] Update Dev Coding / Dev Planing / Layla policy so Git, when needed, is invoked through shell.
- [x] Make Git optional in `setup.bat` and `setup-test.bat`.
- [x] Document Git/GitHub as an optional external CLI capability in README.
- [x] Update runtime acceptance instructions so Git-through-shell is optional rather than a required GPTWorker family.
- [x] Remove Git tooling from the active-code attribution description in LICENSE.

Reason: the former Git tools did not provide an independent Git implementation. They delegated to the host machine's `git` executable, so they failed when Git was absent and duplicated capabilities already available through the confirmed-Workspace shell.

Current model: GPTWorker has no Git runtime family. If `git` is installed and available in `PATH`, Dev Coding may run ordinary Git commands through `run_command` from the confirmed Workspace, including commands that interact with configured GitHub remotes.

### Validation status after Git retirement

**RETEST REQUIRED — current post-Git-retirement HEAD has not yet been certified green.**

The runtime and test expectations were changed during Git-family retirement, but no local validation run has been performed on the user's machine after those commits. Do not treat the earlier all-green acceptance result as validation of this newer HEAD.

Required retest:

- [ ] `npm run build`
- [ ] `npm run validate:jobs`
- [ ] `npm test`
- [ ] runtime acceptance: filesystem
- [ ] runtime acceptance: shell/process
- [ ] runtime acceptance: context
- [ ] runtime acceptance: node_repl
- [ ] runtime acceptance: confirmed-Workspace boundary
- [ ] optional, when Git is installed: run `git status` (and another harmless Git command if useful) through `run_command`
- [ ] public command routing smoke, including `gr/job stop`

Do not mark this subsection complete until the post-retirement build/tests/runtime acceptance have actually passed.

## Compatibility that remains active

`src/lib/mcp-discover-compat.ts` is not dead legacy. It handles the real MCP `server/discover` probe/fallback needed by modern clients with the current stateful SDK/session implementation. Do not remove it unless the MCP/session transport is replaced and verified without it.

## Remaining inherited-core review candidates

After dead compatibility cleanup, review only implementation that is still active. High-priority inherited areas include `src/tools/filesystem.ts`, `src/lib/patch.ts`, `src/lib/mcp-session-manager.ts`, `src/lib/checkpoint.ts`, and `src/tools/shell.ts` / `src/lib/persistent-shell.ts`. The dedicated Git wrapper family has been retired because it only delegated to the machine's external `git` executable; Git remains available through shell when installed.

Smaller active utilities such as audit/search/tool-result/tool-annotations should be reviewed only if they remain part of the final runtime.

Rewrite only when the inherited implementation is technically inadequate, unnecessarily complex, or contains behavior GPTWorker no longer needs. Keep working inherited code when it remains the best fit.

## Packaging task

Before producing the final distributable, define an explicit artifact manifest. The shipped artifact should not include `scripts/test-*.mjs`, other test-only runners, `legacy/**` quarantine, `setup-test.bat`, or completed planning/cleanup artifacts that are not runtime/operator documentation.

Finalize the exact manifest when the distribution format (source package, npm package, or executable bundle) is frozen.


## Cleanup closure

The earlier dead-compatibility cleanup round was validated successfully, including build, Job Pack validation, the default test suite, the full runtime acceptance sequence, and public command routing. The previously failing `gr/job stop` route was fixed and confirmed working.

The temporary quarantine has been removed. The quarantine-only regression checks are no longer part of the default test runner because the quarantine they guarded no longer exists.

That earlier cleanup round remains closed. A later technical cleanup has since retired the dedicated Git runtime family. Because that change touched active runtime/tool registration and test expectations, the **current HEAD requires a fresh validation run** before it can be called green.


## Active inherited caller map — deep audit

This map is based on the current `src/**` runtime after retirement of the dedicated Git family. Test-only callers are intentionally excluded unless they represent a shipping/runtime dependency.

A component can be active in three different ways:

- **Static caller** — another runtime file imports/calls it directly.
- **Dynamic dispatcher** — the operation is exposed through `work_tool` in `src/tools/work-gateway.ts`, so ChatGPT can call it even when there is no ordinary TypeScript caller.
- **Instruction caller** — runtime instructions explicitly tell ChatGPT to invoke the operation. Stale instruction callers are defects even when the underlying operation has been removed.

### Subsystem caller map

| Inherited component | Active runtime caller(s) | Caller file(s) | What is actually used | Current finding | Planned decision |
|---|---|---|---|---|---|
| `src/lib/checkpoint.ts` | filesystem mutations; `agent_status` | `src/tools/filesystem.ts`, `src/tools/context.ts` | `checkpointBefore()`, `getCheckpointConfig()` | Snapshot creation is active, but there is no active runtime restore/list/preview/clear workflow. Snapshots are created and checkpoint IDs are returned, but the retired rewind path means GPTWorker cannot actually consume them for recovery. | **REMOVE subsystem unless a concrete restore workflow is intentionally reintroduced.** |
| checkpoint restore/list API | none in active `src/**` | declaration only in `src/lib/checkpoint.ts` | `listCheckpoints`, `getCheckpoint`, `previewRestore`, `restoreToCheckpoint`, `clearCheckpoints`, `checkpointFingerprint` | No active runtime callers. | **REMOVE.** |
| `src/lib/glob-search.ts` | filesystem `glob`; pre-confirm workspace discovery | `src/tools/filesystem.ts`, `src/tools/workspace-discovery.ts` | `globFiles()` | Two real active callers; not dead. | **KEEP behavior, rewrite/simplify implementation if filesystem is rewritten.** |
| `src/lib/grep-search.ts` | filesystem `grep`; pre-confirm workspace discovery | `src/tools/filesystem.ts`, `src/tools/workspace-discovery.ts` | `grepSearch()` | Two real active callers; not dead. | **KEEP behavior, rewrite/simplify implementation if filesystem is rewritten.** |
| `src/lib/global-shell-state.ts` | persistent shell only | `src/lib/persistent-shell.ts` | `loadGlobalShellState()`, `saveGlobalShellState()` | Disk state is written on command/reset. However `bootstrapShellSession()` has no active runtime caller, so persisted cwd/history is not actually restored by current runtime startup. Disk state is effectively write-only persistence/duplicate command history. | **REMOVE with shell rewrite.** |
| `restoreShellFromDisk()` | none | declaration only in `src/lib/global-shell-state.ts` | nothing | No active runtime caller. | **REMOVE.** |
| `src/lib/persistent-shell.ts` | shell tools | `src/tools/shell.ts` | command execution, cwd state, shell selection, compound-operator compatibility | Core execution is active, but persistent disk history/cwd machinery is more than current architecture needs. | **REWRITE into a smaller Workspace-first shell executor.** |
| `initShellSession()` / `getShellCwd()` | none in active runtime | declaration only in `src/lib/persistent-shell.ts` | nothing | No active runtime callers. | **REMOVE during shell rewrite.** |
| `bootstrapShellSession()` | none in active runtime | declaration only in `src/lib/persistent-shell.ts` | nothing | This confirms persisted shell state is not restored on startup. | **REMOVE with disk shell state.** |
| `src/lib/audit.ts` | filesystem, shell, context | `src/tools/filesystem.ts`, `src/tools/shell.ts`, `src/tools/context.ts` | `audit()`; `getAuditPath()` | `audit()` writes `.mcp-audit.log` and then emits the same event into `activity-log`. This duplicates the newer structured runtime log. | **MERGE into activity logging; remove separate audit file.** |
| legacy audit history path | activity-log helper; agent status path display | `src/lib/activity-log.ts`, `src/tools/context.ts` | `getAuditPath()`, `loadAuditHistory()` | `loadAuditHistory()` has no active caller; `agent_status` merely reports the old audit path. | **REMOVE old audit-history surface and status field.** |
| `src/lib/activity-log.ts` | HTTP/MCP entry, Job authoring, session manager, work registration, audit bridge | `src/index.ts`, `src/jobs/job-authoring.ts`, `src/lib/mcp-session-manager.ts`, `src/lib/work-registration.ts`, `src/lib/audit.ts` | structured events, redaction, console output, `.mcp-activity.jsonl` enqueue | Strong active subsystem. | **KEEP, simplify after audit bridge removal.** |
| activity listener/history helpers | none in active runtime | declaration only in `src/lib/activity-log.ts` | `subscribeActivity()`, `getRecentActivity()`, `loadAuditHistory()`, `loadActivityHistory()` | No active runtime caller found. These appear left over from Admin/UI/history surfaces. | **REMOVE unless a current operator workflow is identified.** |
| `src/lib/patch.ts` | filesystem editing only | `src/tools/filesystem.ts` | unified patch, multi-file patch parser/apply, simple diff | Single caller subsystem, but all imported functions are actively used by `apply_patch` and edit/diff operations. | **KEEP for now; do not rewrite without a technical failure.** |
| `src/lib/tool-result.ts` | server output schema and multiple native tools | `src/server-factory.ts`, `src/tools/jobs.ts`, `admission.ts`, `context.ts`, `filesystem.ts`, `node-repl.ts`, `shell.ts`, `workspace-discovery.ts` | common result envelope, schema, `toolError()` | Heavily shared and active. | **KEEP, rename stale Local Coder wording only.** |
| `src/lib/tool-annotations.ts` | most registered tools and work gateway | `src/tools/control.ts`, `jobs.ts`, `admission.ts`, `context.ts`, `filesystem.ts`, `node-repl.ts`, `shell.ts`, `work-gateway.ts`, `workspace-discovery.ts` | MCP annotations / risk hints | Heavily shared and active. | **KEEP; separately review whether `CHATGPT_AUTO_APPROVE` policy is still necessary.** |
| `src/lib/mcp-session-manager.ts` | HTTP MCP entrypoint | `src/index.ts` | create/get/recover sessions, transport error consumption, request helpers, TTL cleanup | Single direct caller but it is the central MCP transport/session path; not redundant. | **KEEP.** |
| `isStaleSessionRequest()` | none in active runtime | declaration only in `src/lib/mcp-session-manager.ts` | nothing | Unused export/helper. | **REMOVE small dead API only; do not rewrite session manager.** |
| `src/lib/mcp-discover-compat.ts` | MCP POST handling | `src/index.ts` | legacy discover fallback for modern client probing | Real active compatibility path. | **KEEP.** |
| `openai-tunnel.ps1` | setup and tray runtime | `setup.bat`, `gptworker-tray.ps1` | tunnel init/run/doctor/runtime connection | Real active operator/runtime path. | **KEEP; targeted review only.** |
| `start.ps1` | background launcher and tray | `start-worker-background.ps1`, `gptworker-tray.ps1` | starts `node dist/index.js` | Real active runtime launcher. | **KEEP; targeted review only.** |

### Filesystem operation reachability map

Filesystem operations are not normally called by another TypeScript module. They are dynamically reachable because `src/tools/work-gateway.ts` registers the filesystem family and exposes the operation names through `work_tool`.

| Operation | Dynamic caller / dispatcher | Instruction caller | Overlap / necessity finding | Planned action |
|---|---|---|---|---|
| `read_text_file` | `work_tool` → filesystem family | `src/lib/quickstart.ts` | Core read primitive. | **KEEP.** |
| `write_file` | same | quickstart edit flow | Core write primitive. | **KEEP.** |
| `edit_file` | same | quickstart edit flow | Useful exact replacement. | **KEEP.** |
| `multi_edit` | same | quickstart edit flow | Some overlap with repeated `edit_file`, but atomic single-file multi-change is useful. | **KEEP initially; simplify in rewrite.** |
| `replace_regex` | same | no strong default instruction dependency | Distinct regex capability. | **KEEP if implementation remains small.** |
| `apply_patch` | same | explicitly preferred in quickstart | Primary coding edit path. | **KEEP.** |
| `read_file_base64` / `write_file_base64` | same | no normal coding instruction dependency | Useful only for binary/file workflows; not proven redundant yet. | **REVIEW against Layla/binary workflows before removal.** |
| `list_directory` | same | exploration support | Basic directory primitive. | **KEEP.** |
| `glob` | same | explicitly used for exploration | Core discovery capability. | **KEEP.** |
| `grep` | same | explicitly used for exploration | Core content search capability. | **KEEP.** |
| `search_files` | same | no active default instruction need | Duplicates weaker subset of `grep`. | **REMOVE.** |
| `directory_tree` | same | no strong default dependency | Convenience view; can be derived from list/glob but may still help planning. | **REVIEW; keep only if actual planning workflow benefits.** |
| `list_allowed_directories` | same | no current workflow need | Duplicates Workspace/authority information already available through `agent_status`. | **REMOVE.** |
| `create_directory`, `delete_directory`, `copy_file`, `move_file`, `delete_file` | same | quickstart names these filesystem operations | Core mutation primitives. | **KEEP.** |

### Shell/process operation reachability map

Shell operations are dynamically exposed by `src/tools/work-gateway.ts`. Their concrete implementation is registered in `src/tools/shell.ts`.

| Operation | Dynamic caller / dispatcher | Current dependency | Finding | Planned action |
|---|---|---|---|---|
| `run_command` | `work_tool` → shell family | Dev Coding/Planning/Layla; Git now also uses this path | Core execution primitive. | **KEEP in rewritten shell.** |
| `start_process` | same | dev servers / long jobs | Real distinct capability. | **KEEP.** |
| `process_status` | same | process lifecycle | Needed to query background work. | **KEEP.** |
| `process_output` | same | process lifecycle | Needed to inspect background output. | **KEEP.** |
| `stop_process` | same | process lifecycle | Needed for cleanup. | **KEEP.** |
| `clear_processes` | same | no separate workflow dependency | Only deletes completed process records. | **REMOVE tool; auto-prune records internally.** |
| `shell_status` | same | quickstart currently documents persistent shell state | Exists because cwd/history are persistent. | **REMOVE if shell becomes explicit/stateless; otherwise keep only in-memory status.** |
| `shell_reset` | same | quickstart currently documents persistent shell state | Exists only to reset persistent cwd. | **REMOVE with persistent cwd model.** |

### Instruction/runtime drift found during caller audit

The current runtime no longer has a Git family, but `src/lib/quickstart.ts` still contains inherited/stale instructions that tell ChatGPT to:

- treat Git as a dedicated work-tool operation;
- dispatch Git operations through `work_tool`;
- use a `git_*` tool cheat sheet.

These instruction callers no longer match `src/tools/work-gateway.ts` and can cause requests for operations that do not exist.

**Required fix in the next implementation batch:** replace all dedicated-Git guidance in `quickstart.ts` with the current rule: if Git is installed and the task needs it, use ordinary `git ...` commands through `run_command` inside the confirmed Workspace.

### Proposed dependency-aware implementation order

1. **Fix instruction drift first** — remove stale `git_*` guidance from `quickstart.ts`.
2. **Remove dead checkpoint/rewind remainder** — delete unused restore/list APIs and, unless a real recovery consumer is chosen, remove checkpoint creation entirely from filesystem and `agent_status`.
3. **Collapse duplicate logging** — make activity/runtime log the single logging path; remove `.mcp-audit.log`, audit-history helpers, and obsolete status exposure.
4. **Rewrite shell/process core** — remove disk shell state and raw persisted command history; preserve `run_command` plus the four useful background-process operations; auto-prune finished process records.
5. **Rewrite filesystem core** — preserve required primitives and patch integration; remove `search_files` and `list_allowed_directories`; decide base64/tree from actual Job needs.
6. **Update dispatcher/policy/catalog** — remove retired operation names from `work-gateway.ts`, `tool-work-policy.ts`, `tool-profile.ts`, and relevant Job/runtime instructions.
7. **Leave MCP session/patch foundation alone** except for small confirmed dead exports.
8. **Retest from a fresh HEAD** before marking any of these changes green.

## Active inherited core review plan

### Goal

Review the active Local Coder-derived core for technical fitness inside GPTWorker.

There is **no goal to rewrite code merely to remove Hoangcoder attribution**. GPTWorker is allowed to remain built on useful Local Coder core. Attribution should remain wherever substantial inherited implementation remains.

Each inherited module must be classified by its current technical value:

- **KEEP** — implementation is useful, stable, maintainable, and already satisfies GPTWorker requirements.
- **SIMPLIFY / REMOVE** — implementation contains unused, legacy, duplicate, or unnecessary behavior.
- **REFACTOR / REWRITE** — implementation is insufficient, unsafe for current GPTWorker architecture, unnecessarily complex, difficult to maintain, or blocks required functionality.

A rewrite is justified only by a concrete technical need. Do not rewrite a working inherited subsystem solely for provenance.

### Review invariants

During this review:

- preserve confirmed-Workspace isolation;
- preserve work-handle / execution-authority boundaries;
- preserve Job lifecycle behavior;
- preserve lazy runtime-family loading;
- preserve current public command behavior;
- do not reintroduce retired Claude/Codex compatibility, rewind, Ponytail, upstream MCP bridge, or dead permission abstractions;
- validate behavior after every material core change.

### P0 — small inherited utilities

Review these first because they are low-risk and reveal whether the existing implementation is still worth keeping:

- [ ] Review `src/lib/tool-result.ts` → KEEP / SIMPLIFY / REFACTOR.
- [ ] Review `src/lib/tool-annotations.ts` → KEEP / SIMPLIFY / REFACTOR.
- [ ] Review `src/lib/audit.ts` → KEEP / SIMPLIFY / REFACTOR.
- [ ] Review `src/lib/glob-search.ts` → KEEP / SIMPLIFY / REFACTOR.
- [ ] Review `src/lib/grep-search.ts` → KEEP / SIMPLIFY / REFACTOR.
- [ ] Review `src/lib/global-shell-state.ts` → KEEP / SIMPLIFY / REFACTOR.
- [ ] Review `src/lib/checkpoint.ts` → KEEP / SIMPLIFY / REMOVE / REFACTOR.

### P1 — active execution core

These modules are more coupled and must be changed only when the review finds a real deficiency:

- [ ] Review `src/lib/patch.ts`.
- [ ] Review `src/tools/filesystem.ts`.
- [x] Retire dedicated `src/tools/git.ts` / Git runtime family; use the external Git CLI through shell when installed.
- [ ] Review `src/lib/persistent-shell.ts`.
- [ ] Review `src/tools/shell.ts`.
- [ ] Review `src/lib/mcp-session-manager.ts`.
- [ ] Review `src/lib/activity-log.ts`.

For each file, record:

1. what GPTWorker still uses;
2. what behavior is inherited but still valuable;
3. what is obsolete or duplicated;
4. what current GPTWorker requirement is not met, if any;
5. decision: KEEP / SIMPLIFY-REMOVE / REFACTOR-REWRITE;
6. validation required if changed.

### P2 — integration review

These files already contain substantial GPTWorker-specific architecture. Do not rewrite wholesale; inspect only for inherited behavior that is obsolete or technically limiting:

- [ ] Review `src/index.ts`.
- [ ] Review `src/lib/instruction-context.ts`.
- [ ] Review `src/lib/path-security.ts`.
- [ ] Review `src/lib/quickstart.ts`.
- [ ] Review `src/lib/tool-profile.ts`.
- [ ] Review `src/server-factory.ts`.
- [ ] Review `src/tools/context.ts`.
- [ ] Review `src/tools/node-repl.ts`.
- [ ] Review `openai-tunnel.ps1`.
- [ ] Review `start.ps1`.

### Attribution and licensing

- Keep Hoangcoder attribution while substantial Local Coder-derived implementation remains active.
- Do not use attribution removal as a reason to rewrite working code.
- If a subsystem is naturally replaced for technical reasons, reassess attribution only after the active codebase has materially changed.
- Preserve third-party/framework license notices required by the actual upstream sources used.

### Validation gate after any core change

After any material SIMPLIFY / REMOVE / REFACTOR / REWRITE:

- [ ] `npm run build`
- [ ] `npm run validate:jobs`
- [ ] `npm test`
- [ ] runtime acceptance for filesystem, shell/process, context, node_repl, and workspace boundary; optionally verify Git CLI through `run_command` when Git is installed
- [ ] public command routing check, including `gr/job stop`

### Completion condition

This review is complete when every inherited active module has an explicit technical decision and there are no known unnecessary, unsafe, duplicated, or functionally inadequate inherited components.

The desired end state is **the smallest reliable GPTWorker core**, not a from-scratch rewrite.

