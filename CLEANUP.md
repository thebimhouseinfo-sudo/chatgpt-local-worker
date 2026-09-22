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

### Complete Hoangcoder-derived runtime file map

The table below places **every remaining active runtime/root-script file with Local Coder / Hoangcoder ancestry** into the real current call graph. The position is top-down: launcher/entry → integration/dispatcher → callable tool target → helper target.

“Caller” means a real active runtime caller today. “Calls / depends on” shows the downstream target(s) that this inherited file itself invokes. GPTWorker-specific files may appear in the caller column because they are active callers of inherited targets.

| Hoangcoder-derived file | Graph role / position | Active caller(s) today | Calls / depends on | Current finding | Planned decision |
|---|---|---|---|---|---|
| `start.ps1` | **Launcher target** | `start-worker-background.ps1`, `gptworker-tray.ps1` | starts `node dist/index.js` | Real active startup path. | **KEEP; targeted review only.** |
| `openai-tunnel.ps1` | **Tunnel launcher/connection target** | `setup.bat`, `gptworker-tray.ps1` | OpenAI tunnel CLI / local worker health | Real active connection path, not dead compatibility. | **KEEP; targeted review only.** |
| `src/index.ts` | **Main runtime entry / caller** | `start.ps1` indirectly via compiled `dist/index.js` | `path-security.ts`, `mcp-session-manager.ts`, `activity-log.ts`, `instruction-context.ts`, `tool-profile.ts`, GPTWorker-specific discover/log/work telemetry | Still substantially inherited but now also contains GPTWorker runtime architecture. | **KEEP; targeted cleanup only.** |
| `src/lib/instruction-context.ts` | **Entry helper / caller+target** | `src/index.ts` | `tool-profile.ts`, `quickstart.ts` | Active assembly path for MCP instructions. | **KEEP; small cleanup only.** |
| `src/lib/mcp-session-manager.ts` | **Transport/session target and caller** | `src/index.ts` | `src/server-factory.ts`, `activity-log.ts`, MCP SDK transport/types | Central live MCP session/recovery path. A single caller does not make it redundant because it owns the transport/session lifecycle. | **KEEP; remove only confirmed dead exports such as `isStaleSessionRequest()`.** |
| `src/server-factory.ts` | **Session → tool-runtime integration target / caller** | `src/lib/mcp-session-manager.ts` | GPTWorker-specific Job/control/admission/work-gateway modules, plus inherited `quickstart.ts`, `tool-profile.ts`, `tool-result.ts`, `path-security.ts` | Heavily modified integration layer; not a candidate for wholesale rewrite. | **KEEP; update registrations after tool retirement.** |
| `src/lib/quickstart.ts` | **Instruction target** | `src/lib/instruction-context.ts`, `src/server-factory.ts`, `src/tools/context.ts` | no runtime helper dependency; emits instruction text | Active, heavily GPTWorker-specific now, but currently contains stale dedicated-Git instructions. | **KEEP; fix stale Git and retired-operation guidance immediately.** |
| `src/lib/tool-profile.ts` | **Tool exposure policy target** | `src/index.ts`, `src/server-factory.ts`, `src/tools/work-gateway.ts`, `src/lib/instruction-context.ts` | profile/override file loading | Active policy layer. | **KEEP; prune retired operation names as cleanup proceeds.** |
| `src/tools/filesystem.ts` | **Dynamic callable tool target / caller** | `src/tools/work-gateway.ts` dynamically registers the filesystem family; instructions in `quickstart.ts` drive ChatGPT calls | `path-security.ts`, `audit.ts`, `patch.ts`, `checkpoint.ts`, `tool-annotations.ts`, `tool-result.ts`, `glob-search.ts`, `grep-search.ts` | Core capability is required, but implementation contains duplicate/dead surfaces and old checkpoint/audit coupling. | **REWRITE around only required primitives.** |
| `src/tools/shell.ts` | **Dynamic callable tool target / caller** | `src/tools/work-gateway.ts` dynamically registers the shell family; Job instructions drive calls | `path-security.ts`, `shell-workspace-guard.ts`, `audit.ts`, `tool-annotations.ts`, `tool-result.ts`, `persistent-shell.ts` | Core shell/process capability is required, but persistent shell state and some management tools are unnecessary. | **REWRITE smaller Workspace-first shell/process core.** |
| `src/tools/context.ts` | **Dynamic callable tool target / caller** | `src/tools/work-gateway.ts` dynamically registers context operations | `audit.ts`, `checkpoint.ts`, `path-security.ts`, `quickstart.ts`, `tool-annotations.ts`, `tool-result.ts`, GPTWorker project-context/worker-home helpers | `project_context` / `agent_status` are useful; checkpoint/audit-path reporting is obsolete if those subsystems are removed. | **KEEP; simplify status payload after cleanup.** |
| `src/tools/node-repl.ts` | **Dynamic callable tool target / caller** | `src/tools/work-gateway.ts` dynamically registers repl family | `path-security.ts`, `tool-annotations.ts`, `tool-result.ts` | Distinct capability, already constrained from direct filesystem access. | **KEEP.** |
| `src/lib/persistent-shell.ts` | **Shell implementation target / caller** | `src/tools/shell.ts` | `global-shell-state.ts`, `path-security.ts`, GPTWorker `shell-workspace-guard.ts` | Command execution is active; disk cwd/history persistence is not justified by current architecture. | **REWRITE/REPLACE with smaller executor.** |
| `src/lib/global-shell-state.ts` | **Persistent-shell storage target** | `src/lib/persistent-shell.ts` | filesystem + crypto only | `loadGlobalShellState()` / `saveGlobalShellState()` are called, but persisted state is not restored because `bootstrapShellSession()` has no active runtime caller. Effectively write-only state plus duplicate raw command history. | **REMOVE with shell rewrite.** |
| `src/lib/patch.ts` | **Filesystem edit-engine target / caller** | `src/tools/filesystem.ts` | `path-security.ts` for multi-file targets | All imported patch/diff functions are actually used. Very strongly inherited, but not redundant. | **KEEP unless a concrete technical failure appears.** |
| `src/lib/checkpoint.ts` | **Filesystem safety target** | `src/tools/filesystem.ts` via `checkpointBefore()`; `src/tools/context.ts` via `getCheckpointConfig()` | filesystem/crypto only | Active snapshot creation has no active restore consumer after rewind retirement. Most of the file is dead API. | **REMOVE subsystem unless a real recovery workflow is intentionally restored.** |
| `src/lib/glob-search.ts` | **Search helper target** | `src/tools/filesystem.ts`, GPTWorker-specific `src/tools/workspace-discovery.ts` | filesystem/path only | Two real active callers. | **KEEP behavior; rewrite/simplify with filesystem cleanup if useful.** |
| `src/lib/grep-search.ts` | **Search helper target** | `src/tools/filesystem.ts`, GPTWorker-specific `src/tools/workspace-discovery.ts` | filesystem/path only | Two real active callers. | **KEEP behavior; rewrite/simplify with filesystem cleanup if useful.** |
| `src/lib/audit.ts` | **Tool logging target / caller** | `src/tools/filesystem.ts`, `src/tools/shell.ts`, `src/tools/context.ts` | `activity-log.ts` plus separate `.mcp-audit.log` file | Duplicate logging layer: writes old audit file and then emits essentially the same event into the newer activity system. | **MERGE into activity logging, then REMOVE file if no distinct responsibility remains.** |
| `src/lib/activity-log.ts` | **Shared runtime logging target / caller** | `src/index.ts`, `src/jobs/job-authoring.ts`, `src/lib/mcp-session-manager.ts`, GPTWorker-specific `src/lib/work-registration.ts`, plus `audit.ts` bridge | GPTWorker `runtime-log.ts`, `tool-work-policy.ts`; currently also reads old audit path | Strong live subsystem: MCP/session/work/tool events, redaction, console output, JSONL persistence. | **KEEP; simplify after removing audit bridge and dead UI/history helpers.** |
| `src/lib/tool-result.ts` | **Shared output target** | `src/server-factory.ts`, `src/tools/jobs.ts`, `src/tools/admission.ts`, `src/tools/context.ts`, `src/tools/filesystem.ts`, `src/tools/node-repl.ts`, `src/tools/shell.ts`, `src/tools/workspace-discovery.ts` | Zod only | Heavily shared, active common envelope/schema. | **KEEP; replace stale “Local Coder” wording with GPTWorker.** |
| `src/lib/tool-annotations.ts` | **Shared MCP metadata target** | `src/tools/control.ts`, `jobs.ts`, `admission.ts`, `context.ts`, `filesystem.ts`, `node-repl.ts`, `shell.ts`, `work-gateway.ts`, `workspace-discovery.ts` | MCP SDK types only | Heavily shared and active. | **KEEP; separately review whether auto-approve policy is still needed.** |
| `src/lib/path-security.ts` | **Shared Workspace-boundary target** | `src/index.ts`, `src/server-factory.ts`, `src/tools/context.ts`, `src/tools/filesystem.ts`, `src/tools/node-repl.ts`, `src/tools/shell.ts`, `src/lib/patch.ts`, `src/lib/persistent-shell.ts`, GPTWorker `shell-workspace-guard.ts` and other integration code | Node fs/path/os/AsyncLocalStorage | Same-path ancestry remains, but current implementation is largely GPTWorker-specific and is the core safety boundary. | **KEEP; do not wholesale rewrite.** |

### Dead exports / internal branches inside inherited files

These are not separate files, but they are important because they prove that an otherwise-active inherited file still contains retired behavior.

| Target file | Dead or unconsumed member | Active caller outside declaration? | Decision |
|---|---|---|---|
| `src/lib/checkpoint.ts` | `listCheckpoints()`, `getCheckpoint()`, `previewRestore()`, `restoreToCheckpoint()`, `clearCheckpoints()`, `checkpointFingerprint()` | **No** | **REMOVE.** |
| `src/lib/global-shell-state.ts` | `restoreShellFromDisk()` | **No** | **REMOVE.** |
| `src/lib/persistent-shell.ts` | `initShellSession()`, `getShellCwd()`, `bootstrapShellSession()` | **No active runtime caller** | **REMOVE in shell rewrite.** |
| `src/lib/activity-log.ts` | `subscribeActivity()`, `getRecentActivity()`, `loadAuditHistory()`, `loadActivityHistory()` | **No active runtime caller found** | **REMOVE unless a current operator consumer is identified.** |
| `src/lib/mcp-session-manager.ts` | `isStaleSessionRequest()` | **No** | **REMOVE small dead export only.** |

### Inherited support/config files outside the caller graph

These files share ancestry or same-path history with Local Coder but are not runtime caller/target nodes, so they should not be forced into the dependency graph above.

| File | Current role | Treatment |
|---|---|---|
| `package.json` / `tsconfig.json` | build/runtime metadata | Review only for current packaging/build needs; provenance does not justify rewrite. |
| `.env.example` / `.gitignore` | operator/config metadata | Keep only current GPTWorker settings/patterns. |
| `AGENTS.md` / `README.md` | operator/developer documentation | Keep content aligned with actual GPTWorker architecture; remove stale Local Coder behavior as found. |
| `LICENSE` | current license/attribution | Keep attribution scoped to inherited code that remains active after cleanup. |


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


## Temporary inherited-core implementation checklist

This is a **temporary execution checklist**, not a final architecture freeze. Its purpose is to remove/simplify/rewrite inherited code without breaking current GPTWorker behavior or caller connections.

### Working rules for every inherited file

- [ ] Re-read the file and all active callers from the caller map before mutation.
- [ ] Classify the file/member as **REMOVE / SIMPLIFY / REWRITE / KEEP** based on current technical value, not provenance.
- [ ] Remove only when no required runtime capability or caller depends on it.
- [ ] When multiple public operations duplicate the same implementation, prefer one internal implementation and keep compatibility names temporarily if removing/renaming the public operation would create unnecessary blast radius.
- [ ] Rename a file/function only when the new name materially improves responsibility clarity **and** the caller update is small/contained.
- [ ] If renaming would touch many stable callers, keep the existing exported/file name and simplify/rewrite its internals instead.
- [ ] Do not preserve dead behavior merely because the file itself is still active.
- [ ] Do not split code merely to create more files; do not merge files merely to reduce file count. Group by responsibility.
- [ ] Preserve confirmed-Workspace isolation, work-handle authority, Job lifecycle, lazy runtime loading, and public command behavior.
- [ ] After each material subsystem change, update dispatcher/catalog/instructions in the same batch so runtime and guidance cannot drift.
- [ ] Run targeted validation after each subsystem batch; run the full validation gate only after the batch is coherent.

### Phase 0 — baseline and instruction consistency

- [ ] Fix stale dedicated-Git instructions in `src/lib/quickstart.ts` before deeper refactors.
- [ ] Confirm `work-gateway.ts`, `tool-profile.ts`, `tool-work-policy.ts`, Job YAML, README, and quickstart all describe the same currently available operation set.
- [ ] Record the current exported operation list for filesystem/shell/context/repl so later removals are intentional.
- [ ] Do not call current HEAD green until the post-Git-retirement retest has actually passed.

### Phase 1 — remove obvious dead inherited surfaces first

#### `src/lib/checkpoint.ts`

- [ ] Confirm again that no active runtime caller uses restore/list/preview/clear APIs.
- [ ] Remove dead exports: `listCheckpoints`, `getCheckpoint`, `previewRestore`, `restoreToCheckpoint`, `clearCheckpoints`, `checkpointFingerprint`.
- [ ] Decide whether **any** automatic pre-mutation snapshot remains useful when GPTWorker has no restore workflow.
- [ ] If no real consumer exists, remove `checkpointBefore()` and delete the whole checkpoint subsystem.
- [ ] Remove checkpoint calls and `checkpoint_id` output fields from `src/tools/filesystem.ts`.
- [ ] Remove checkpoint status/config from `src/tools/context.ts`.
- [ ] Remove checkpoint-specific instruction/log summarization from other files.
- [ ] Delete `.mcp-checkpoints` configuration/docs references if the subsystem is removed.
- [ ] Validate all file mutations after removal.

**Preferred temporary decision:** remove the subsystem entirely unless a concrete restore consumer is chosen before implementation.

#### `src/lib/global-shell-state.ts`

- [ ] Confirm persisted cwd/history still has no startup/runtime restore caller.
- [ ] Remove `restoreShellFromDisk()` immediately if still unused.
- [ ] During shell rewrite, remove disk persistence for raw recent commands.
- [ ] Remove the file entirely if no remaining state genuinely needs cross-process persistence.
- [ ] Remove obsolete `MCP_SHELL_STATE_DIR` / `.mcp-state` docs/config if no longer used.

**Preferred temporary decision:** remove after the new shell executor no longer imports it.

#### dead members inside otherwise-active files

- [ ] Remove `isStaleSessionRequest()` from `src/lib/mcp-session-manager.ts` if no caller appears.
- [ ] Remove `subscribeActivity()`, `getRecentActivity()`, `loadAuditHistory()`, `loadActivityHistory()` from `src/lib/activity-log.ts` unless a current operator/runtime caller is found.
- [ ] Remove `initShellSession()`, `getShellCwd()`, `bootstrapShellSession()` when the shell rewrite no longer needs them.

### Phase 2 — collapse duplicate logging

#### `src/lib/audit.ts`

- [ ] Verify that `.mcp-audit.log` contains no unique information required by current tooling.
- [ ] Move the useful `audit()` call semantics into the activity/runtime logging path or replace callers with a small shared helper.
- [ ] Preserve redaction and non-fatal logging behavior.
- [ ] Update callers in `src/tools/filesystem.ts`, `src/tools/shell.ts`, and `src/tools/context.ts`.
- [ ] Remove `getAuditPath()` and old audit-path exposure from `agent_status`.
- [ ] Delete `src/lib/audit.ts` if it no longer has a distinct responsibility.

#### `src/lib/activity-log.ts`

- [ ] Keep MCP/session/work/tool event logging, redaction, console output, and JSONL persistence.
- [ ] Remove old audit-history compatibility.
- [ ] Remove Admin/UI listener/history APIs if still uncalled.
- [ ] Check whether the file now has one clear responsibility; if not, split only by responsibility such as formatting/redaction vs persistence.
- [ ] Keep the filename if renaming would create broad churn without architectural benefit.

**Target state:** one logging pipeline, one persistent runtime log, no duplicate audit file.

### Phase 3 — rewrite shell/process around current GPTWorker needs

#### `src/tools/shell.ts`
#### `src/lib/persistent-shell.ts`
#### `src/lib/global-shell-state.ts`

Treat these three files as **one subsystem review**, not three isolated rewrites.

- [ ] Define the minimal required public shell operations:
  - `run_command`
  - `start_process`
  - `process_status`
  - `process_output`
  - `stop_process`
- [ ] Verify whether `shell_status` provides any value once cwd is explicit and Workspace is already known.
- [ ] Verify whether `shell_reset` is needed at all without persistent cwd.
- [ ] Remove `clear_processes` as a public operation if finished process records can be pruned automatically.
- [ ] Make `working_directory` an explicit one-call option rooted inside the confirmed Workspace.
- [ ] Decide whether commands should always start from Workspace root when `working_directory` is absent. Prefer this simple deterministic model unless a real workflow needs persistent `cd`.
- [ ] Remove disk-persisted shell cwd/history if no real workflow needs it.
- [ ] Preserve PowerShell selection/fallback behavior needed on Windows.
- [ ] Preserve timeout behavior and Workspace command guard.
- [ ] Preserve background-process ownership by Workspace.
- [ ] Add internal auto-pruning for finished process records.
- [ ] Consider merging command execution and process management into one implementation file **only if** the resulting file has a clear responsibility and remains maintainable.
- [ ] If `persistent-shell.ts` becomes just a stateless executor, consider renaming it to something like `shell-executor.ts`; otherwise keep the current filename to avoid unnecessary caller churn.
- [ ] If all useful code fits cleanly in `src/tools/shell.ts`, deleting `persistent-shell.ts` is acceptable.
- [ ] Update `work-gateway.ts`, policy/catalog, quickstart, Job docs, and acceptance tests for removed shell operations.

**Preferred temporary target:** stateless/Workspace-first command executor + small in-memory background process registry; no disk shell state.

### Phase 4 — rewrite filesystem around required primitives

#### `src/tools/filesystem.ts`

- [ ] Define the smallest required public filesystem surface before coding.
- [ ] Keep path validation centralized through `path-security.ts`.
- [ ] Remove checkpoint coupling if Phase 1 removes checkpointing.
- [ ] Remove old audit coupling after Phase 2.
- [ ] Remove `search_files` because `grep` already covers the stronger content-search use case.
- [ ] Remove `list_allowed_directories` because Workspace/authority status already exists elsewhere.
- [ ] Decide whether `directory_tree` materially helps planning/discovery; remove if `list_directory + glob` is enough.
- [ ] Verify Layla/binary workflows before deciding whether `read_file_base64` / `write_file_base64` stay.
- [ ] Preserve core mutations: read/write/create/delete/copy/move.
- [ ] Preserve `glob`, `grep`, and `apply_patch`.

#### edit-operation consolidation

Current `edit_file` and `multi_edit` are **two public operations in the same file**, not two separate files.

- [ ] Compare actual semantics:
  - `edit_file`: one exact replacement, optionally replace-all.
  - `multi_edit`: ordered multiple exact replacements applied atomically to one file.
- [ ] Decide whether both public names are genuinely useful to ChatGPT.
- [ ] Prefer one internal helper such as `applyTextEdits(file, edits, options)`.
- [ ] If compatibility is valuable, keep both public operations but make both thin adapters over the same helper.
- [ ] If one operation can fully replace the other without degrading tool ergonomics, retire the redundant public operation and update quickstart/work-gateway/policy/tests in the same batch.
- [ ] Review `replace_regex` the same way: keep only if regex editing is materially easier/safer than expressing the same edit through the chosen unified edit interface.
- [ ] Do not force every edit style through `apply_patch` if exact replacement remains simpler and more reliable for non-code text.

#### filesystem helper layout

- [ ] Review whether `glob-search.ts` and `grep-search.ts` should remain separate helpers.
- [ ] If both are small and share directory walking/filtering, consider one internal `file-search.ts` helper with distinct glob/grep functions.
- [ ] Do not merge them if that makes the search helper harder to test/read.
- [ ] Keep public operation names `glob` and `grep` unless changing them has a real benefit.

### Phase 5 — review strong inherited KEEP candidates for internal quality

KEEP does not mean “never touch”. It means preserve the capability unless a better implementation has a concrete benefit.

#### `src/lib/patch.ts`

- [ ] Verify all currently supported patch formats are actually needed.
- [ ] Check for parser branches that only supported retired compatibility flows.
- [ ] Check whether diff generation belongs here or in filesystem edit helpers.
- [ ] Keep the current implementation if simplification would add risk without reducing real complexity.
- [ ] Rewrite only if a smaller implementation can preserve current patch behavior and Workspace validation with clear tests.
- [ ] Avoid renaming while `filesystem.ts` is being rewritten unless the new responsibility becomes materially different.

#### `src/lib/mcp-session-manager.ts`

- [ ] Remove only confirmed dead exports first.
- [ ] Map each recovery branch to current `src/index.ts` behavior before changing it.
- [ ] Keep stale-session recovery/raw-header/protocol handling that current ChatGPT tunnel sessions actually need.
- [ ] Do not rewrite wholesale merely because overlap with Local Coder is high.
- [ ] Only consider a rewrite after runtime evidence shows complexity can be safely reduced.

#### `src/lib/tool-result.ts`

- [ ] Keep the shared structured result envelope if all current tools still benefit from it.
- [ ] Replace stale Local Coder naming/comments.
- [ ] Check whether `TOOL_RESULT_OUTPUT_SCHEMA` and `toolResult()` can be made smaller without changing server-factory/tool output behavior.
- [ ] Keep filename/export names unless a rename has low blast radius.

#### `src/lib/tool-annotations.ts`

- [ ] Verify current ChatGPT behavior still needs `CHATGPT_AUTO_APPROVE`.
- [ ] If risk-specific annotations alone are sufficient, simplify and remove the environment toggle.
- [ ] If the toggle still solves a real popup/session issue, keep it and document the reason.
- [ ] Preserve correct read/edit/command/destructive hints.

#### `src/lib/path-security.ts`

- [ ] Treat confirmed-Workspace boundary as a locked invariant.
- [ ] Review for dead inherited branches only.
- [ ] Prefer targeted simplification over rewrite.
- [ ] Do not rename unless every security caller can be updated in one controlled batch.

### Phase 6 — simplify integration files after lower layers settle

#### `src/tools/context.ts`

- [ ] Keep `project_context` and `agent_status`.
- [ ] Remove checkpoint fields if checkpoint subsystem is removed.
- [ ] Remove audit-log path if duplicate audit subsystem is removed.
- [ ] Ensure status reports only real current capabilities.

#### `src/lib/quickstart.ts`

- [ ] Remove stale Git-family guidance.
- [ ] Remove instructions for any filesystem/shell operations retired by this cleanup.
- [ ] Prefer small canonical workflows over a long cheat sheet that can drift from runtime.
- [ ] Consider generating operation summaries from the runtime catalog only if doing so is simpler and less fragile than static text.

#### `src/lib/tool-profile.ts`

- [ ] Remove retired operation names.
- [ ] Check whether full/slim + override logic is still necessary with one `work_tool` gateway.
- [ ] Simplify only if current ChatGPT discovery/tool-list behavior remains intact.

#### `src/server-factory.ts`

- [ ] Update family/operation registrations only after lower-level decisions are frozen.
- [ ] Remove compatibility wiring for retired operations.
- [ ] Preserve work-handle and Workspace authority wrapping.

#### `src/lib/instruction-context.ts`

- [ ] Reassess only after quickstart/profile cleanup.
- [ ] Keep if it still provides a clean assembly boundary.
- [ ] Merge into another file only if it becomes a trivial pass-through with no independent responsibility.

#### `src/index.ts`

- [ ] Review last, after session/logging/instruction layers settle.
- [ ] Remove only wiring made obsolete by earlier phases.
- [ ] Preserve HTTP/MCP routes, health, session recovery, shutdown logging, and current tunnel behavior.

#### `src/tools/node-repl.ts`

- [ ] Confirm it still provides a distinct useful capability beyond `run_command node ...`.
- [ ] Compare why REPL exists: stateful JS evaluation, structured output, restricted fs access.
- [ ] If those benefits are not actually used, consider retiring it like Git.
- [ ] If kept, simplify implementation and preserve the no-direct-filesystem boundary.

### Phase 7 — root scripts with inherited ancestry

#### `start.ps1`

- [ ] Confirm every branch is used by setup, background launcher, tray, or manual recovery.
- [ ] Remove obsolete launch modes/flags only when no caller uses them.
- [ ] Keep filename if external scripts call it widely.

#### `openai-tunnel.ps1`

- [ ] Map setup/tray/manual callers before editing.
- [ ] Identify doctor/init/run/recovery branches actually used by current setup.
- [ ] Remove obsolete compatibility branches only with tunnel acceptance evidence.
- [ ] Prefer targeted simplification; this is a connection-critical script.

### Phase 8 — rename/merge pass only after behavior is stable

- [ ] Do **not** rename during the first remove/rewrite pass unless required.
- [ ] After runtime is green, inspect remaining filenames against actual responsibility.
- [ ] Rename only when it reduces future confusion enough to justify caller churn.
- [ ] Candidate review:
  - `persistent-shell.ts` → remove entirely or rename to `shell-executor.ts` if it becomes stateless.
  - `activity-log.ts` → keep unless responsibility materially changes.
  - `glob-search.ts` + `grep-search.ts` → possibly merge into `file-search.ts`.
  - `filesystem.ts` / `shell.ts` → keep public tool registration filenames unless there is a strong architectural reason to change.
- [ ] Update imports, docs, caller map, and LICENSE attribution only after final names settle.

### Per-batch safety gate

For every subsystem batch:

- [ ] caller map updated before mutation;
- [ ] code mutation complete;
- [ ] retired exports removed from dispatcher/catalog/profile/instructions;
- [ ] no stale tool names remain in quickstart/README/Job docs;
- [ ] TypeScript build passes;
- [ ] relevant targeted test(s) pass;
- [ ] Workspace-boundary behavior is preserved;
- [ ] only then mark the batch complete and continue.

After all batches:

- [ ] `npm run build`
- [ ] `npm run validate:jobs`
- [ ] `npm test`
- [ ] full runtime acceptance: filesystem / shell-process / context / repl / Workspace boundary;
- [ ] optional Git-through-shell check when Git is installed;
- [ ] public command routing smoke including `gr/job stop`;
- [ ] update README and LICENSE to describe only the code/capabilities that actually remain.

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

