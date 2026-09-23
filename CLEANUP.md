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

### Validation status after inherited-core cleanup

**INHERITED-CORE CLEANUP CLOSED / CI GREEN.**

The final code closure commit is `423764c4` (`refactor: close inherited integration cleanup`). GitHub Actions CI #646 passed:

- [x] TypeScript build
- [x] Job Pack validation
- [x] full Linux default test suite
- [x] filesystem / context / work-gateway regression coverage
- [x] confirmed-Workspace boundary checks
- [x] stateless shell/process checks
- [x] public Job lifecycle/routing tests, including stop behavior
- [x] Windows build
- [x] Windows shell executor smoke
- [x] Windows PowerShell 5.1 tunnel parser check
- [x] tunnel preview/setup checks
- [x] detached Worker health smoke

GitHub Actions is the authoritative automated gate for this cleanup. The optional Git CLI remains a host capability rather than a GPTWorker runtime dependency; it is available through `run_command` when installed.

## Manual local verification — 2026-09-23

The user pulled the current repository code and reports that local testing completed successfully and GPTWorker continues to operate normally. This is user-reported functional validation, not an independently inspected test log and not a claim that every test command or every runtime path passed.

- [x] User-reported local functional testing after pulling the latest code: no operational problem observed.
- [ ] Perform a real-file mutation acceptance test in an explicitly confirmed disposable Workspace: create a test file, read it back, perform one exact edit, apply a multi-change patch, verify the content, and clean up only the test artifacts.
- [ ] In that acceptance test, verify that mutation attempts targeting an absolute path outside the confirmed Workspace are rejected and leave the outside file unchanged. Also check an in-Workspace symlink/junction pointing outside if supported by the host.
- [ ] Capture the exact local commands/results and the applicable GitHub Actions status for the tested HEAD before marking this latest verification round fully closed.

**Status:** Local operation is user-confirmed; real-file editing and boundary-negative mutation tests remain **PENDING**. This manual result supplements, but does not replace, the previously recorded CI #646 evidence for commit `423764c4` or establish CI status for later commits. Packaging remains a separate open task.

## Follow-up: module-by-module inherited implementation audit

**Status: OPEN — review each file sequentially.** This is a new technical-quality review, separate from the completed inherited-core dead-code cleanup. The original Local Coder implementation helped bootstrap GPTWorker, but the product now has its own Job lifecycle, confirmed-Workspace boundary, work handles, lazy work-gateway and runtime requirements. Review inherited implementations against those *current* needs rather than assuming that code which still works is either necessary or optimal.

**Objective:** identify actual runtime usage; eliminate unused/duplicate functionality; simplify or redesign code where there is a concrete benefit; keep valuable inherited algorithms or infrastructure when replacing them would add risk without meaningful improvement. This is **not** a project to erase Hoangcoder's name or rewrite code solely for attribution. Preserve the original MIT attribution for any substantial inherited code still distributed; revisit the notices only after provenance has been audited.

### Dev Coding scope: local-first; Git/GitHub optional

**Dev Coding is a local coding agent, not a GitHub agent.** Its primary workflow is to inspect, create, edit, refactor, debug, build and test code **inside the user's explicitly confirmed absolute local Workspace**. It may use the Job's existing local skills/harness and available host programming tools. Preserve the confirmed-Workspace mutation boundary and work-handle authority for all Jobs, including Custom Jobs.

Git and GitHub are **optional external CLI conveniences**, not GPTWorker core capabilities or required dependencies:

- When the machine has `git` and/or `gh` installed and a task actually requires them, Dev Coding may run ordinary commands through the existing Workspace-bound `run_command` shell surface, subject to its normal path and execution safeguards.
- Local coding, editing, debugging, build and tests must work even when neither CLI is installed or authenticated.
- Do not rebuild a dedicated Git/GitHub MCP family, duplicate shell-backed Git operations, add GitHub-specific coding skills/harness solely for integration, or add automatic GitHub workflows to the Dev Coding core.
- Do not infer permission to commit, push, create PRs or otherwise mutate a remote merely from CLI availability; such operations must be within the user's actual task and authority.
- During each inherited-module review, treat behavior that exists *only* for a specialized Git/GitHub workflow as a candidate for removal unless it serves another demonstrated current requirement. Keep any useful general local coding capability regardless of its origin.

This scope is the evaluation baseline for the module-by-module audit. It does not prohibit Git/GitHub CLI usage when explicitly relevant; it prevents optional remote workflows from determining GPTWorker's local runtime architecture.

### Review register — one file at a time

The group reflects the previous cleanup's provenance assessment, **not** an exact line-by-line copyright comparison. A review marked `NOT STARTED` has no new conclusion.

| File | Current responsibility / review focus | Review state | Decision |
|---|---|---|---|
| `src/lib/patch.ts` | Patch parser, hunk matching, diff generation and multi-file mutation | **PRELIMINARY STATIC REVIEW**; tests/mutation acceptance pending | **UNDECIDED** |
| `src/lib/mcp-session-manager.ts` | MCP transport, sessions and recovery; identify indispensable state/compatibility paths | NOT STARTED | UNDECIDED |
| `src/lib/tool-result.ts` | Shared result envelope/schema; enumerate consumers and minimum required contract | NOT STARTED | UNDECIDED |
| `src/lib/tool-annotations.ts` | MCP annotations and presentation-only auto-approve hints | NOT STARTED | UNDECIDED |
| `src/lib/activity-log.ts` | Active tool/session/runtime logging; identify duplicate or unconsumed paths | NOT STARTED | UNDECIDED |
| `src/tools/filesystem.ts` | Actual operation consumers, mutation guarantees and residual inherited implementation | NOT STARTED | UNDECIDED |
| `src/tools/shell.ts` | Stateless command/process execution and Workspace escape limitations | NOT STARTED | UNDECIDED |
| `src/lib/path-security.ts` | Absolute/canonical paths, symlink/junction behavior and scoped authority | NOT STARTED | UNDECIDED |
| `src/index.ts` | HTTP/MCP entry, startup/shutdown and any remaining unnecessary inherited wiring | NOT STARTED | UNDECIDED |
| `src/server-factory.ts` | Tool registration, leases and scope/authority wiring | NOT STARTED | UNDECIDED |
| `src/lib/instruction-context.ts` | Instruction assembly and consumer-specific runtime context | NOT STARTED | UNDECIDED |
| `start.ps1` | Actual launcher modes/callers; remaining complexity versus operator needs | NOT STARTED | UNDECIDED |
| `openai-tunnel.ps1` | Active tunnel setup, diagnostics and recovery; remove only provably unnecessary branches | NOT STARTED | UNDECIDED |

Add any newly discovered inherited file to this register with its **real callers**; do not silently expand or narrow scope.

### Required assessment for every file

1. **Pin evidence:** record the GPTWorker HEAD and the actual source/version of the inherited implementation where available. Compare implementations function-by-function; distinguish copied, modified and independently implemented code. Do not infer provenance from identical filenames alone.
2. **Build a current caller/target map:** include static imports, dynamic `work_tool` dispatch, Job YAML, instructions/skills/harness, root scripts, CI and tests. Classify each public export, code path, parameter and configuration option as used, test-only, genuinely optional, or unconsumed. Tests by themselves do not prove production use.
3. **Inspect actual behavior:** record input/output/error semantics, real workflow requirements, duplicate responsibilities, unnecessary layers, algorithmic complexity, performance/resource costs and security failure modes. Distinguish confirmed defects from plausible risks awaiting reproduction.
4. **Choose one outcome with justification:** **KEEP** (real value; replacement unjustified), **SIMPLIFY** (retain behavior with a smaller implementation), **REWRITE** (current design materially obstructs requirements), or **REMOVE** (no necessary caller/capability). A working inherited implementation is allowed to remain.
5. **Specify a safe migration:** preserve required public behavior or update all callers together. Add characterization, positive/negative, boundary and regression tests before material changes; use a disposable confirmed Workspace for real-file acceptance. Record any intentional API/behavior change explicitly.
6. **Close with evidence:** report changed files, retired names, remaining call paths, build, `validate:jobs`, relevant targeted tests, full suite/CI and real-workflow results as applicable. Never call a file complete based only on static analysis or another commit's green CI.

**Shared invariants:** every file/path binding and actual project mutation stays within the explicitly confirmed absolute Workspace; Job support roots are read/execute support, not mutation destinations. Maintain work-handle authority, Job lifecycle/stop behavior, lazy loading, current MCP compatibility, and the established public Job flow. Shell command string checks are not an OS sandbox: characterize their limitations and test indirect/path-constructed escapes rather than claiming guaranteed isolation.

### First candidate — `src/lib/patch.ts`

**Evidence so far:** preliminary code-level comparison with the currently accessible upstream `hoangcoderr/chatgpt-local-coder/src/lib/patch.ts`, the GPTWorker file, `src/tools/filesystem.ts` and `scripts/test-patch.mjs`. This is **not** yet a pinned historical upstream diff or a completed runtime test.

- Active integration: `filesystem.ts` calls `applyUnifiedPatchToText`, `applyMultiFilePatch`, `buildSimpleDiff` and `isMultiFilePatch` for current edit/patch operations. GPTWorker has dropped upstream's multi-file standard unified-diff route and added Workspace path validation.
- **Risk to reproduce:** numbered hunks currently splice at the computed index without validating the purported old/context lines; this may overwrite unexpected content if the file differs from the patch.
- **Risk to reproduce:** multi-file operations are applied in sequence and report per-file failures; a later failure may leave earlier files modified. Do not describe this as atomic.
- **Quality limitation:** `buildSimpleDiff` compares line positions rather than calculating insertions/deletions; a single insertion can produce misleadingly extensive output.
- **Test gap:** the numbered-hunk fixture in `scripts/test-patch.mjs` has mismatched old text and only asserts that new text appears. It does not establish mismatch rejection.
- **Questions before changing code:** which patch formats do real Job/coding callers generate; is multi-file all-or-nothing a required contract; should preview/diff be an accurate edit script or only a simple summary?

`patch.ts` review checklist:
- [x] Preliminary inspection of current GPTWorker implementation, immediate filesystem integration, existing patch tests and accessible upstream implementation.
- [ ] Pin precise upstream baseline and complete direct/static/dynamic caller map.
- [ ] Reproduce numbered-hunk mismatch, multi-file partial failure, insertion/deletion diff, multi-hunk behavior and CRLF handling in isolated tests.
- [ ] Run real-file create/edit/patch/rollback-related acceptance in a disposable confirmed Workspace; verify out-of-Workspace and symlink/junction mutation rejection.
- [ ] Decide KEEP/SIMPLIFY/REWRITE/REMOVE and document contract, implementation scope and migration tests.
- [ ] Implement the approved technical changes, update callers/docs/tests and capture fresh CI evidence before marking COMPLETE.

### Working sequence and completion rule

Start with `patch.ts`; finish its evidence and decision before moving to the next file. Reorder the remainder based on newly discovered dependencies or safety risks, recording the reason here. A file can be closed as **KEEP** with documented evidence and no code change. A file closed as **SIMPLIFY/REWRITE/REMOVE** requires corresponding implementation, caller migration and validation. When all entries are closed, reconcile `LICENSE`/third-party notices with the actual retained code as part of Packaging; historic credit and legally required notices are distinct from unnecessary implementation dependencies.

---
 
## Final inherited-core cleanup result

The inherited-core cleanup is complete.

Current decisions:

- **REMOVED:** dedicated Git family, checkpoint/rewind, duplicate audit log, persistent shell state, node_repl, obsolete tool-profile layer, redundant filesystem operations, old glob/grep helper split, and dead compatibility exports.
- **REWRITTEN / materially simplified:** filesystem execution surface, shell/process execution, search helper layout, Workspace/security integration, context/status surface, root launcher/tunnel surfaces.
- **KEPT because technically justified:** patch engine, MCP session/recovery manager, tool-result envelope, MCP annotations, activity/runtime logging, MCP discover compatibility, instruction-context boundary, server/work authority integration, and active launcher/tunnel behavior.
- **Attribution retained:** Hoangcoder/Local Coder remains credited for the substantial active inherited implementation that still exists. The LICENSE no longer attributes retired checkpoint/audit/Git subsystems as active code.

No further rewrite is justified solely for provenance. Future changes to the remaining inherited modules should be driven by concrete functional, safety, maintainability, or architectural requirements.

The separate **Packaging task** remains open until the final distribution format is frozen.

## Compatibility that remains active

`src/lib/mcp-discover-compat.ts` is not dead legacy. It handles the real MCP `server/discover` probe/fallback needed by modern clients with the current stateful SDK/session implementation. Do not remove it unless the MCP/session transport is replaced and verified without it.

## Remaining inherited-core review candidates

The major inherited-core review is now substantially complete. Dedicated Git, checkpoint/rewind, duplicate audit logging, persistent shell state, node_repl, legacy search helpers, and the obsolete tool-profile layer have been retired.

The strongest remaining Local Coder-derived implementation is intentionally kept where it still provides real value: `src/lib/patch.ts`, `src/lib/mcp-session-manager.ts`, `src/lib/tool-result.ts`, `src/lib/tool-annotations.ts`, parts of `src/lib/activity-log.ts`, and portions of the local runtime/tunnel foundation. Filesystem and shell were materially rewritten around GPTWorker's current Workspace-first architecture.

Rewrite only when the inherited implementation is technically inadequate, unnecessarily complex, or contains behavior GPTWorker no longer needs. Keep working inherited code when it remains the best fit.

## Packaging task

Before producing the final distributable, define an explicit artifact manifest. The shipped artifact should not include `scripts/test-*.mjs`, other test-only runners, `legacy/**` quarantine, `setup-test.bat`, or completed planning/cleanup artifacts that are not runtime/operator documentation.

Finalize the exact manifest when the distribution format (source package, npm package, or executable bundle) is frozen.


## Cleanup closure

The earlier dead-compatibility cleanup round was validated successfully, including build, Job Pack validation, the default test suite, the full runtime acceptance sequence, and public command routing. The previously failing `gr/job stop` route was fixed and confirmed working.

The temporary quarantine has been removed. The quarantine-only regression checks are no longer part of the default test runner because the quarantine they guarded no longer exists.

That earlier cleanup round remains closed. The latest code baseline before this integration/documentation closure passed GitHub Actions CI #645: Linux full suite, Windows shell executor smoke, Windows PowerShell/tunnel checks, and detached Worker health all passed. Any new integration cleanup commit must still pass a fresh CI run before final closure.


## Historical inherited caller map — pre-rewrite audit snapshot

This section is preserved as audit evidence from the pre-rewrite stage. It is **not** the current runtime map: several targets below were subsequently removed or rewritten. Current-state decisions and validation evidence are recorded in the completed phases later in this file.

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
| `src/tools/node-repl.ts` | **Retired** | no real Job/runtime consumer beyond self-tests | duplicated ad-hoc Node execution already available through Workspace-bound shell | Stateful REPL convenience was not required by any active workflow. | **REMOVE — retired; use Node CLI through `run_command` when needed.** |
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

- [x] Fix stale dedicated-Git instructions in `src/lib/quickstart.ts` before deeper refactors.
- [ ] Confirm `work-gateway.ts`, `tool-profile.ts`, `tool-work-policy.ts`, Job YAML, README, and quickstart all describe the same currently available operation set.
- [ ] Record the current exported operation list for filesystem/shell/context/repl so later removals are intentional.
- [ ] Do not call current HEAD green until the post-Git-retirement retest has actually passed.

### Phase 1 — remove obvious dead inherited surfaces first

#### `src/lib/checkpoint.ts`

- [x] Confirm again that no active runtime caller uses restore/list/preview/clear APIs.
- [x] Remove dead exports and the entire retired checkpoint subsystem.
- [ ] Decide whether **any** automatic pre-mutation snapshot remains useful when GPTWorker has no restore workflow.
- [x] No restore consumer existed; removed `checkpointBefore()` and deleted the whole checkpoint subsystem.
- [x] Remove checkpoint calls and `checkpoint_id` output fields from `src/tools/filesystem.ts`.
- [x] Remove checkpoint status/config from `src/tools/context.ts`.
- [ ] Remove checkpoint-specific instruction/log summarization from other files.
- [ ] Delete `.mcp-checkpoints` configuration/docs references if the subsystem is removed.
- [ ] Validate all file mutations after removal.

**Preferred temporary decision:** remove the subsystem entirely unless a concrete restore consumer is chosen before implementation.

#### `src/lib/global-shell-state.ts`

- [ ] Confirm persisted cwd/history still has no startup/runtime restore caller.
- [ ] Remove `restoreShellFromDisk()` immediately if still unused.
- [x] Remove disk persistence for raw recent commands.
- [x] Remove `src/lib/global-shell-state.ts`; no remaining shell state requires persistence.
- [ ] Remove obsolete `MCP_SHELL_STATE_DIR` / `.mcp-state` docs/config if no longer used.

**Preferred temporary decision:** remove after the new shell executor no longer imports it.

#### dead members inside otherwise-active files

- [ ] Remove `isStaleSessionRequest()` from `src/lib/mcp-session-manager.ts` if no caller appears.
- [ ] Remove `subscribeActivity()`, `getRecentActivity()`, `loadAuditHistory()`, `loadActivityHistory()` from `src/lib/activity-log.ts` unless a current operator/runtime caller is found.
- [ ] Remove `initShellSession()`, `getShellCwd()`, `bootstrapShellSession()` when the shell rewrite no longer needs them.

### Phase 2 — collapse duplicate logging

#### `src/lib/audit.ts`

- [x] Verify that `.mcp-audit.log` contained no unique runtime responsibility.
- [x] Replace audit callers with unified `logToolActivity()` / runtime logging.
- [ ] Preserve redaction and non-fatal logging behavior.
- [ ] Update callers in `src/tools/filesystem.ts`, `src/tools/shell.ts`, and `src/tools/context.ts`.
- [x] Remove `getAuditPath()` and old audit-path exposure from `agent_status`.
- [x] Delete `src/lib/audit.ts`; it had no distinct responsibility after logging unification.

#### `src/lib/activity-log.ts`

- [x] Keep MCP/session/work/tool event logging, redaction, console output, and JSONL persistence.
- [x] Remove old audit-history compatibility.
- [x] Remove uncalled activity listener/history APIs.
- [ ] Check whether the file now has one clear responsibility; if not, split only by responsibility such as formatting/redaction vs persistence.
- [ ] Keep the filename if renaming would create broad churn without architectural benefit.

**Target state:** one logging pipeline, one persistent runtime log, no duplicate audit file.

### Phase 3 — rewrite shell/process around current GPTWorker needs — COMPLETE / CI GREEN

#### `src/tools/shell.ts`
#### `src/lib/persistent-shell.ts`
#### `src/lib/global-shell-state.ts`

Treat these three files as **one subsystem review**, not three isolated rewrites.

- [x] Define and implement the minimal required public shell operations:
  - `run_command`
  - `start_process`
  - `process_status`
  - `process_output`
  - `stop_process`
- [x] `shell_status` removed; no independent value remains with stateless cwd.
- [x] `shell_reset` removed; stateless shell has nothing to reset.
- [x] Remove `clear_processes`; finished records auto-prune by age/cap.
- [x] Make `working_directory` an explicit one-call option rooted inside the confirmed Workspace.
- [x] Commands now always start from Workspace root when `working_directory` is absent.
- [x] Remove disk-persisted shell cwd/history; no real workflow required it.
- [x] Preserve PowerShell selection/fallback behavior; validated on Windows CI.
- [x] Preserve timeout behavior and Workspace command guard.
- [x] Preserve background-process ownership by Workspace.
- [x] Add internal auto-pruning for finished process records.
- [ ] Consider merging command execution and process management into one implementation file **only if** the resulting file has a clear responsibility and remains maintainable.
- [ ] If `persistent-shell.ts` becomes just a stateless executor, consider renaming it to something like `shell-executor.ts`; otherwise keep the current filename to avoid unnecessary caller churn.
- [x] All useful shell/process code now lives cleanly in `src/tools/shell.ts`; deleted `persistent-shell.ts` and `global-shell-state.ts`.
- [x] Gateway/policy/catalog/quickstart/tests updated for removed shell operations.

**Implemented:** stateless/Workspace-first command executor + small in-memory background process registry; no disk shell state. GitHub Actions CI #601 passed on Windows and Linux.


### Executed batch status — checkpoint/audit + shell

- [x] Retired dedicated checkpoint subsystem and removed unusable restore/list/preview APIs.
- [x] Removed duplicate `.mcp-audit.log` pipeline and unified active tool/runtime logging through activity/runtime log.
- [x] Removed dead activity history/listener APIs that no active runtime consumer used.
- [x] Fixed stale dedicated-Git quickstart/test expectations.
- [x] Replaced inherited persistent shell state with a stateless confirmed-Workspace executor.
- [x] Deleted `src/lib/persistent-shell.ts`.
- [x] Deleted `src/lib/global-shell-state.ts`.
- [x] Retired public `shell_status`, `shell_reset`, and `clear_processes`.
- [x] Preserved `run_command`, `start_process`, `process_status`, `process_output`, and `stop_process`.
- [x] Added automatic pruning for finished background-process records.
- [x] Preserved Workspace command/path guard and absolute in-Workspace `working_directory`.
- [x] Added Windows shell-executor smoke coverage.

Validation evidence:

- Baseline after Git/checkpoint/audit cleanup: CI #599 — **GREEN**.
- Stateless shell batch: commit `3433711a`, CI #609 — **GREEN**.
- Linux full suite: **PASS**.
- Windows build: **PASS**.
- Windows shell executor smoke: **PASS**.
- Windows PowerShell 5.1 tunnel-script parser check: **PASS**.
- Detached Worker health smoke: **PASS**.


### Shell rewrite completion — CI green

- [x] Replaced inherited persistent-shell model with a stateless confirmed-Workspace executor.
- [x] Deleted `src/lib/persistent-shell.ts`.
- [x] Deleted `src/lib/global-shell-state.ts`.
- [x] Retired `shell_status`, `shell_reset`, and `clear_processes`.
- [x] Kept `run_command`, `start_process`, `process_status`, `process_output`, and `stop_process`.
- [x] Shell commands now start from the confirmed Workspace root unless an absolute in-Workspace `working_directory` is supplied for that call.
- [x] Removed persisted cwd and raw recent-command history.
- [x] Added automatic pruning of finished background-process records.
- [x] Preserved Workspace command/path guard and Windows PowerShell compatibility.
- [x] Added cross-platform shell executor smoke coverage to CI.
- [x] CI run #640 passed: Linux full suite 37/37 and Windows shell/worker smoke PASS.

### Phase 4 — rewrite filesystem around required primitives

#### `src/tools/filesystem.ts`

- [x] Define and implement the smallest required public filesystem surface: 12 operations.
- [x] Keep path validation centralized through `path-security.ts`.
- [x] Remove checkpoint coupling.
- [x] Remove old audit coupling; filesystem now uses unified activity logging.
- [x] Remove `search_files`; `grep` covers the stronger content-search use case.
- [x] Remove `list_allowed_directories`; Workspace/authority status exists elsewhere.
- [x] Remove `directory_tree`; `list_directory + glob` is sufficient.
- [x] Remove base64 read/write operations from the core; binary workflows can use task-specific/system tooling instead of permanent filesystem API surface.
- [x] Preserve core mutations: read/write/create/delete/copy/move.
- [x] Preserve `glob`, `grep`, and `apply_patch`.

#### edit-operation consolidation

Current `edit_file` and `multi_edit` are **two public operations in the same file**, not two separate files.

- [x] Compare actual edit semantics:
  - `edit_file`: one exact replacement, optionally replace-all.
  - `multi_edit`: ordered multiple exact replacements applied atomically to one file.
- [ ] Decide whether both public names are genuinely useful to ChatGPT.
- [x] Simplified edit surface instead: `edit_file` handles one exact replace/replace-all; `apply_patch` handles structured/multiple edits.
- [ ] If compatibility is valuable, keep both public operations but make both thin adapters over the same helper.
- [x] Retire redundant `multi_edit` and update quickstart/work-gateway/policy/tests in the same batch.
- [x] Retire `replace_regex`; patch/edit/shell cover current workflows without a dedicated permanent operation.
- [ ] Do not force every edit style through `apply_patch` if exact replacement remains simpler and more reliable for non-code text.

#### filesystem helper layout

- [x] Review search helpers; merged `glob-search.ts` + `grep-search.ts` into one `file-search.ts` shared traversal.
- [x] Implement one internal `file-search.ts` helper with distinct `globFiles()` / `grepSearch()` APIs.
- [ ] Do not merge them if that makes the search helper harder to test/read.
- [x] Keep public operation names `glob` and `grep`; only internal helper layout changed.

**Filesystem implementation result:** `src/tools/filesystem.ts` was rewritten around 12 Workspace-bound core operations. Retired operations: base64 read/write, `multi_edit`, `replace_regex`, `search_files`, `directory_tree`, and `list_allowed_directories`. GitHub Actions CI #604 passed on commit `5de5fb1a` (Linux full suite + Windows build/shell/tunnel/Worker smoke).

**Search-helper implementation result:** retired `glob-search.ts` and `grep-search.ts`; replaced them with shared `file-search.ts`, fixed `**/` root matching, and stopped blanket-skipping hidden paths such as `.github` while still skipping `.git` and `node_modules`. GitHub Actions CI #606 passed on commit `6f111d6b`.

### Phase 5 — review strong inherited KEEP candidates for internal quality — COMPLETE / CI GREEN

KEEP does not mean “never touch”. It means preserve the capability unless a better implementation has a concrete benefit.

#### `src/lib/patch.ts`

- [x] Verify supported patch formats against active runtime/instructions/tests.
- [x] Removed unused multi-file standard unified-diff routing; explicit `*** Begin Patch` is now the only multi-file form.
- [x] Kept `buildSimpleDiff()` in patch module because both exact edit and patch flows consume the same diff behavior.
- [x] Kept the working single-file hunk engine and explicit GPT-style multi-file engine; simplified only unused compatibility routing.
- [x] No wholesale rewrite; targeted simplification preserved Workspace validation and patch tests.
- [x] Kept `patch.ts` filename/API because responsibility remains accurate.

#### `src/lib/mcp-session-manager.ts`

- [x] Session manager retained; removed only confirmed dead public/metadata surface (`touch`, `createdAt`, unused protocol constant).
- [x] Mapped recovery branches to current `src/index.ts`; raw-header patch, protocol negotiation, loopback warm-up, pending recovery, serialization, DELETE grace and TTL cleanup are all active.
- [x] Kept stale-session recovery/raw-header/protocol handling.
- [x] No wholesale session-manager rewrite; active transport/recovery behavior is technically justified.
- [x] Decision: KEEP with small dead-surface cleanup only.

#### `src/lib/tool-result.ts`

- [x] KEEP shared structured result envelope; server-factory and native tools still use it.
- [x] Replaced stale Local Coder naming/comments with GPTWorker wording.
- [x] Current schema/envelope is already small and shared; no further reduction justified.
- [x] Kept filename/export names.

#### `src/lib/tool-annotations.ts`

- [x] `CHATGPT_AUTO_APPROVE` remains an exposed `.env` UX option; no runtime dependency requires removing it.
- [x] Did not remove the public toggle without a demonstrated UX benefit; annotations remain hints only.
- [x] Kept toggle and clarified in code that annotations are presentation hints, not authority/security.
- [x] Preserved existing read/edit/command/destructive annotation behavior.

#### `src/lib/path-security.ts`

- [x] Confirmed-Workspace boundary preserved as a locked invariant.
- [x] Removed dead compatibility exports: `setAllowedRoots`, `getAllowedRoots`, `setFullDiskAccess`, `runWithWorkspaceCwd`, `getActiveWorkspaceBoundary`, `isWorkspaceBoundaryActive`.
- [x] Kept path-security core and performed targeted dead-surface cleanup only.
- [x] Kept `path-security.ts` name and active security APIs.

**Phase 5 validation:** patch/tool-metadata simplification commit `28f44a00` passed CI #622. Path-security/session cleanup plus test-caller alignment through commit `b7ce3397` passed CI #627 (Linux full suite + Windows build/shell/tunnel/Worker smoke).

### Phase 6 — simplify integration files after lower layers settle — COMPLETE

#### `src/tools/context.ts`

- [x] Keep `project_context` and `agent_status`.
- [x] Checkpoint and duplicate audit fields are gone.
- [x] Status reports only current Workspace/runtime information.
- [x] Removed the unused startup-workspace registration parameter.

#### `src/lib/quickstart.ts`

- [x] Removed stale Git-family guidance.
- [x] Removed references to retired filesystem/shell/repl operations.
- [x] Kept the canonical static workflow because the routing/confirmation copy is regression-tested and has no stale runtime names.

#### retired `src/lib/tool-profile.ts`

- [x] Removed the obsolete profile/override layer after `work_tool` became the single execution gateway.
- [x] Current operation exposure comes from the real family registry instead of a second profile catalog.

#### `src/server-factory.ts`

- [x] Registration reflects only current control/admission/workspace/Job/work-gateway surfaces.
- [x] No retired tool compatibility wiring remains.
- [x] Work-handle leases and confirmed-Workspace scope wrapping remain authoritative.

#### `src/lib/instruction-context.ts`

- [x] KEEP. It still owns control-plane environment assembly plus instruction summary telemetry.
- [x] Do not merge it into `index.ts`; it is not a trivial pass-through.

#### `src/index.ts`

- [x] Reviewed after lower-layer cleanup.
- [x] Retired wiring is gone; server instructions are built once at startup.
- [x] HTTP/MCP routes, health/status, session recovery, runtime logging, and shutdown behavior remain active.

#### `src/tools/node-repl.ts`

- [x] Confirmed no active Job/workflow requires the stateful REPL capability.
- [x] Compared against `run_command`: Node CLI/script execution already covers the actual active use cases.
- [x] Retire `node_repl` and the entire `repl` runtime family.
- [x] Remove `repl` from Dev Coding preload, gateway, profile, policy, quickstart, acceptance docs, and tests.

**Decision:** REMOVE. Node remains available as an optional host CLI through the Workspace-bound shell.

### Phase 7 — root scripts with inherited ancestry

#### `start.ps1`

- [x] Confirmed all public switches are active: `Port` / `Force` are used by background/setup callers; `Detach` is used by tray and Windows CI.
- [x] Kept all active launch modes/flags; no unnecessary public switch was found.
- [x] Removed stale "Full machine access" wording and aligned startup text with confirmed-Workspace execution.
- [x] Kept filename because background/tray/CI callers use it directly.

#### `openai-tunnel.ps1`

- [x] Mapped setup/tray/CI/manual callers before editing.
- [x] Kept active `Port`, `HealthPort`, `Init`, `Force`, `WizardPreview`, `TunnelId`, `ApiKey`, `NoBrowser`, and `Detach` surfaces.
- [x] Kept `Doctor`: README exposes it as a real manual tunnel diagnostic path.
- [x] Retired standalone `Install` switch: both Init and normal runtime already install/upgrade tunnel-client when necessary.
- [x] Removed unused `ChatGPTUrl` constant and unused `TunnelId` argument from `Show-ConnectorGuide`.
- [x] Preserved tunnel init/doctor/run/recovery behavior; no wholesale rewrite performed.

**Phase 7 validation:** current CI #645 passed PowerShell syntax/tunnel checks, Linux full suite, Windows shell executor smoke, and detached Worker health. Phase 7 is closed.

### Phase 8 — rename/merge pass after behavior stabilized — COMPLETE

- [x] Deleted `persistent-shell.ts` and `global-shell-state.ts` instead of keeping misleading names.
- [x] Merged `glob-search.ts` + `grep-search.ts` into `file-search.ts`.
- [x] Kept `activity-log.ts`, `filesystem.ts`, and `shell.ts`; their names still match their responsibilities.
- [x] Avoided renames that would create caller churn without architectural benefit.
- [x] Updated README and LICENSE attribution to match the runtime that actually remains.

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

- [x] `npm run build` — covered by CI #646
- [x] `npm run validate:jobs` — covered by CI #646
- [x] `npm test` — full Linux suite passed in CI #646
- [x] automated runtime acceptance: filesystem / shell-process / context / Workspace boundary
- [x] Git remains optional and routed through `run_command` when installed; it is not a runtime-family dependency
- [x] public command/Job lifecycle regression suite, including stop behavior
- [x] README and LICENSE describe only the code/capabilities that currently remain.

## Original inherited core review plan — superseded by completed phases above

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
- [ ] runtime acceptance for filesystem, shell/process, context, and workspace boundary; optionally verify Git CLI through `run_command` when Git is installed
- [ ] public command routing check, including `gr/job stop`

### Completion condition

This review is complete when every inherited active module has an explicit technical decision and there are no known unnecessary, unsafe, duplicated, or functionally inadequate inherited components.

The desired end state is **the smallest reliable GPTWorker core**, not a from-scratch rewrite.

