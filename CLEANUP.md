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

**Status: REVIEW COMPLETE — selective improvement only; no new full-module rewrites.** This is a new technical-quality review, separate from the completed inherited-core dead-code cleanup. The original Local Coder implementation helped bootstrap GPTWorker, but the product now has its own Job lifecycle, confirmed-Workspace boundary, work handles, lazy work-gateway and runtime requirements. Review inherited implementations against those *current* needs rather than assuming that code which still works is either necessary or optimal.

**Final scope decision (2026-09-23, supersedes earlier proposals below):** keep the inherited architecture and existing module paths/APIs. **Do not implement any greenfield rewrite, rewrite-in-place, or wholesale redesign** from this audit. Improve **only** selected files where the completed source review identified a concrete safety/correctness benefit: `src/lib/patch.ts`, `src/tools/filesystem.ts`, and `src/lib/path-security.ts`. For `src/lib/mcp-session-manager.ts`, keep the present implementation; investigate protocol/recovery failures through integration tests and make a narrowly scoped fix **only if a defect is reproduced**. The remaining audited modules stay unchanged; optional focused tests for launcher/tunnel behavior are allowed without refactoring them. Existing proposals for greenfield patch engine, session-manager rewrite-in-place, and mutation-core replacement are **withdrawn**, not pending approvals. Reassess scope only if concrete test evidence reveals a blocker. Retain licensing/attribution for reused code.

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
| `src/lib/patch.ts` | Patch parser, hunk matching, diff generation and multi-file mutation | **DESIGN REVIEW**; targeted runtime tests pending | **TARGETED CORRECTNESS IMPROVEMENTS ONLY; no rewrite** |
| `src/lib/mcp-session-manager.ts` | MCP transport, sessions and recovery; identify indispensable state/compatibility paths | **SOURCE REVIEW COMPLETE**; protocol/integration acceptance pending | **KEEP; focused defect fix only if integration tests reproduce one** |
| `src/lib/tool-result.ts` | Shared result envelope/schema; enumerate consumers and minimum required contract | **SOURCE REVIEW COMPLETE** | **KEEP unchanged** |
| `src/lib/tool-annotations.ts` | MCP annotations and presentation-only auto-approve hints | **SOURCE REVIEW COMPLETE** | **KEEP unchanged** |
| `src/lib/activity-log.ts` | Active tool/session/runtime logging; identify duplicate or unconsumed paths | **SOURCE REVIEW COMPLETE** | **KEEP unchanged** |
| `src/tools/filesystem.ts` | Actual operation consumers, mutation guarantees and residual inherited implementation | **SOURCE REVIEW COMPLETE**; grouped mutation/boundary tests pending | **TARGETED IMPROVEMENTS approved; NO wholesale rewrite** |
| `src/tools/shell.ts` | Stateless command/process execution and Workspace escape limitations | **SOURCE REVIEW COMPLETE** | **KEEP unchanged** |
| `src/lib/path-security.ts` | Absolute/canonical paths, symlink/junction behavior and scoped authority | **SOURCE REVIEW COMPLETE**; Windows/TOCTOU integration pending | **TARGETED SECURITY HARDENING approved; no rewrite** |
| `src/index.ts` | HTTP/MCP entry, startup/shutdown and any remaining unnecessary inherited wiring | **SOURCE REVIEW COMPLETE** | **KEEP unchanged** |
| `src/server-factory.ts` | Tool registration, leases and scope/authority wiring | **SOURCE REVIEW COMPLETE** | **KEEP unchanged** |
| `src/lib/instruction-context.ts` | Instruction assembly and consumer-specific runtime context | **SOURCE REVIEW COMPLETE** | **KEEP unchanged proposed** |
| `start.ps1` | Actual launcher modes/callers; remaining complexity versus operator needs | **SOURCE REVIEW COMPLETE**; Windows acceptance pending | **KEEP; optional narrow -Force ownership safeguard** |
| `openai-tunnel.ps1` | Active tunnel setup, diagnostics and recovery; remove only provably unnecessary branches | **SOURCE REVIEW COMPLETE**; Windows/tunnel acceptance pending | **KEEP; targeted download/credential tests only** |

Add any newly discovered inherited file to this register with its **real callers**; do not silently expand or narrow scope.

### Existing-module compatibility rule

**Default:** retain the existing file, public exports, signatures and caller-visible results. Make small internal corrections only where evidence requires them; do not replace the module core or introduce parallel implementations/adapters. Test existing Job/work-tool contracts and confirmed Workspace security before and after any change.

### Required assessment for every file

1. **Pin evidence:** record the GPTWorker HEAD and the actual source/version of the inherited implementation where available. Compare implementations function-by-function; distinguish copied, modified and independently implemented code. Do not infer provenance from identical filenames alone.
2. **Build a current caller/target map:** include static imports, dynamic `work_tool` dispatch, Job YAML, instructions/skills/harness, root scripts, CI and tests. Classify each public export, code path, parameter and configuration option as used, test-only, genuinely optional, or unconsumed. Tests by themselves do not prove production use.
3. **Inspect actual behavior:** record input/output/error semantics, real workflow requirements, duplicate responsibilities, unnecessary layers, algorithmic complexity, performance/resource costs and security failure modes. Distinguish confirmed defects from plausible risks awaiting reproduction.
4. **Select only evidence-backed outcomes:** **KEEP unchanged** (default), **TARGETED IMPROVEMENT** (small bug/security/performance fix with measured benefit), or **REMOVE** (only genuinely dead functionality with no active callers). **No new module rewrites or greenfield implementations** under this decision. Record concrete risk, minimum viable change and targeted tests.
5. **Specify a safe migration:** preserve required public behavior or update all callers together. Add characterization, positive/negative, boundary and regression tests before material changes; use a disposable confirmed Workspace for real-file acceptance. Record any intentional API/behavior change explicitly.
6. **Close with evidence:** report changed files, retired names, remaining call paths, build, `validate:jobs`, relevant targeted tests, full suite/CI and real-workflow results as applicable. Never call a file complete based only on static analysis or another commit's green CI.

**Shared invariants:** every file/path binding and actual project mutation stays within the explicitly confirmed absolute Workspace; Job support roots are read/execute support, not mutation destinations. Maintain work-handle authority, Job lifecycle/stop behavior, lazy loading, current MCP compatibility, and the established public Job flow. Shell command string checks are not an OS sandbox: characterize their limitations and test indirect/path-constructed escapes rather than claiming guaranteed isolation.

### Three-file upgrade implementation record

**Implemented on `main`, source and regression tests committed (2026-09-23):**
- `src/lib/path-security.ts`: reject relative or malformed active Workspace/support roots and malformed path argument types; existing canonical/symlink boundary logic retained.
- `src/lib/patch.ts`: numbered hunk old/context validation; reject invalid/empty hunks; support unified insertion at old line zero; preflight all multi-file operations and duplicate targets before mutations; prevent create overwrite; revalidate before filesystem mutation; explicitly report remaining operations skipped if a commit step fails. No rollback or full atomic guarantee.
- `src/tools/filesystem.ts`: revalidate target (and source when applicable) immediately before write/edit/patch/copy/move after parent creation where relevant; no public tool or result schema removed.
- Targeted tests: `scripts/test-patch.mjs`, `scripts/test-filesystem-core.mjs`, `scripts/test-workspace-boundary.mjs`.

**Validation still pending:** The connected repository returned no status/check runs for the current commit. A direct local clone/build/test attempt could not run because the execution environment could not resolve github.com. Do not mark runtime tests, `npm run build`, `npm run validate:jobs`, `npm test`, CI, Windows junction/TOCTOU or operator acceptance as PASS without an actual result. New failures, if revealed, must be fixed within the approved narrow scope.

### Approved three-file upgrade plan (2026-09-23)

**Scope:** preserve current module implementations, file names, public API, active callers and Job behavior. Change only `src/lib/path-security.ts`, `src/lib/patch.ts`, `src/tools/filesystem.ts` and their focused tests.

1. **Path boundary:** reject non-absolute Workspace roots and invalid path argument types; revalidate destinations after creating their parent directories. Keep existing read-only support-root behavior and scope lifecycle. Test symlink escape and out-of-Workspace refusal.
2. **Patch correctness:** require numbered hunks to match actual context/removal lines before splicing; reject invalid/empty patch hunks. Preserve GPT explicit multi-file format and existing exported functions.
3. **Grouped filesystem safety:** preflight all explicit multi-file operations before the first mutation; reject duplicate targets and existing `Add File` destinations; report errors without implying transaction-level atomicity on unforeseen I/O failures. Keep `filesystem.ts` result envelope and add revalidation at mutation time.
4. **Validation gate:** update targeted pure patch and disposable-Workspace filesystem tests; then build, validate Job packs, run test suite and inspect CI for the current commit. Cross-platform junction/TOCTOU and real operator acceptance remain explicitly pending unless actually tested.

**Non-goals:** full patch engine rewrite, global filesystem transaction layer, added dependencies or claims of OS sandbox/atomicity.

### Selective-improvement criteria

Keep current modules and algorithms unless targeted tests demonstrate a defect or measurable overhead. Make the smallest change that resolves the issue, preserving API and current patch format semantics. Priorities: (1) Workspace and work-handle containment, (2) prevention of unintended file mutation and accurate errors, (3) regression coverage of the current local coding workflow, (4) maintainability without new abstractions. Do not pursue greenfield designs or rewrite internals merely to improve style or provenance.

**Approved candidates:** `patch.ts` (validate old/context content in numbered hunks; reject malformed or ambiguous patches; verify true diff needs before changing presentation), `filesystem.ts` (make multi-file preflight/partial-failure semantics safe and explicit without replacing the tool), `path-security.ts` (narrow hardening for proven symlink/junction or canonical-path gaps). `mcp-session-manager.ts` remains KEEP unless real SDK/protocol/recovery testing proves a specific defect. All other reviewed files remain KEEP; validation tests are not permission for broad refactoring.

### First candidate — `src/lib/patch.ts`

**Evidence so far:** preliminary code-level comparison with the currently accessible upstream `hoangcoderr/chatgpt-local-coder/src/lib/patch.ts`, the GPTWorker file, `src/tools/filesystem.ts` and `scripts/test-patch.mjs`. This is **not** yet a pinned historical upstream diff or a completed runtime test.

- Active integration: `filesystem.ts` calls `applyUnifiedPatchToText`, `applyMultiFilePatch`, `buildSimpleDiff` and `isMultiFilePatch` for current edit/patch operations. GPTWorker has dropped upstream's multi-file standard unified-diff route and added Workspace path validation.
- **Risk to reproduce:** numbered hunks currently splice at the computed index without validating the purported old/context lines; this may overwrite unexpected content if the file differs from the patch.
- **Risk to reproduce:** multi-file operations are applied in sequence and report per-file failures; a later failure may leave earlier files modified. Do not describe this as atomic.
- **Quality limitation:** `buildSimpleDiff` compares line positions rather than calculating insertions/deletions; a single insertion can produce misleadingly extensive output.
- **Test gap:** the numbered-hunk fixture in `scripts/test-patch.mjs` has mismatched old text and only asserts that new text appears. It does not establish mismatch rejection.
- **Questions before changing code:** which patch formats do real Job/coding callers generate; is multi-file all-or-nothing a required contract; should preview/diff be an accurate edit script or only a simple summary?
- **Approved improvement scope:** strengthen existing numbered-hunk validation and malformed-patch rejection; verify existing multi-file caller/error semantics with isolated tests. Keep current module, exported API and supported patch formats.

`patch.ts` review checklist:
- [x] Preliminary inspection of current GPTWorker implementation, immediate filesystem integration, existing patch tests and accessible upstream implementation.
- [x] Map direct integration from `filesystem.ts` and indirect Work Gateway, work-handle/Workspace, Job and existing-test dependencies; capture current external result shapes.
- [ ] Pin precise upstream baseline; finish checking dynamic instructions/harness and any externally authored Custom Job consumers.
- [ ] Reproduce numbered-hunk mismatch, multi-file partial failure, insertion/deletion diff, multi-hunk behavior and CRLF handling in isolated tests.
- [ ] Run real-file create/edit/patch/rollback-related acceptance in a disposable confirmed Workspace; verify out-of-Workspace and symlink/junction mutation rejection.
- [x] Scope decision: retain the current engine and make only targeted corrections; greenfield and wholesale refactor proposals withdrawn.
- [x] Decision: TARGETED IMPROVEMENTS ONLY. Record the precise fix and caller-facing compatibility before coding.
- [ ] Implement the approved technical changes, update callers/docs/tests and capture fresh CI evidence before marking COMPLETE.

#### Approved targeted improvement plan for `patch.ts`

**Keep the existing parser/engine and all active exports.** Add strict verification of expected old/context lines before numbered-hunk mutations; strengthen malformed-input rejection and existing tests. Characterize repeated context, multi-hunk behavior, LF/CRLF and EOF. Preserve current supported patch formats and `filesystem.ts` result contracts. Improve diff output only if a focused test demonstrates user-visible misleading results and a small local fix suffices. Coordinate multi-file preflight/error handling with `filesystem.ts` without rewriting either module. Test in a disposable confirmed Workspace, including outside-Workspace and symlink/junction negative cases. No replacement parser, new transaction engine or generalized Git patch support.

### Historical design discussions (retained as audit evidence; superseded)

Sections below that discuss greenfield replacements, rewrite-in-place, or full mutation-core redesign describe **rejected earlier alternatives**, not current implementation tasks. Only the selective-improvement scope and review register above are authoritative.

#### `patch.ts` integration impact and migration boundary

**Review type: source-level integration mapping; implementation and runtime acceptance are still pending.** GPTWorker `src/lib/patch.ts` exposes four runtime functions, all imported directly by `src/tools/filesystem.ts`: `applyUnifiedPatchToText`, `applyMultiFilePatch`, `isMultiFilePatch` and `buildSimpleDiff`. `MultiPatchResult` is a TypeScript interface available to consumers. The immediate production dependency appears deliberately narrow: `filesystem.ts` is the adapter between the patch implementation and the public MCP/Job execution surface.

| Integration | Current relationship | Rewrite boundary / action |
|---|---|---|
| `src/tools/filesystem.ts` | Directly imports four patch exports; `edit_file` calls `buildSimpleDiff`; `apply_patch` routes single/multi-file inputs, performs some filesystem I/O, emits structured result and activity log | **Direct impact:** adapt at this boundary, preserving user-facing names/input/output until all actual consumers are migrated |
| `src/lib/path-security.ts` | `patch.ts` calls `validatePath` for multi-file targets; `filesystem.ts` also validates single-file/base paths | **Security contract:** preserve absolute confirmed-Workspace mutation validation; revalidate targets near commit after preflight and test canonical symlink/junction escapes |
| `src/tools/work-gateway.ts` | Advertises `apply_patch` and `edit_file` in the filesystem family and lazily imports `filesystem.ts` | **Indirect dependency:** no anticipated API changes if filesystem tool names/schema remain stable; regression-test lazy dispatch |
| `src/server-factory.ts` | Supplies work-handle lease and `runWithWorkspaceScope` to tool invocation | **Indirect security dependency:** do not modify authorization plumbing to rewrite a local patch engine; integration-test scoped invocation |
| `src/lib/tool-result.ts`, `src/lib/activity-log.ts` | Used by `filesystem.ts` to publish results and activity, not directly imported by `patch.ts` | **Result/observability dependency:** retain outward result semantics or migrate and test them deliberately |
| `jobs/dev-coding/job.yaml` and other Jobs/Custom Jobs | Dev Coding preloads filesystem; actual consumers can reach `apply_patch` via generic `work_tool` | **Contract dependency:** preserve public operation name, input fields and successful/error result interpretation; inspect relevant skills/harness and do not infer all Custom Job usage from repository source |
| `scripts/test-patch.mjs`, `scripts/test-tools.mjs`, `scripts/test-filesystem-core.mjs`, `scripts/test-work-gateway.mjs` | Direct helper tests, one multi-file on-disk smoke test, filesystem end-to-end callback test and lazy-gateway dispatch coverage | **Test dependency:** revise the invalid numbered-hunk fixture; add negative, transaction/recovery and workspace-boundary tests; maintain positive integration coverage |

**Observed public compatibility points:** `apply_patch({ path, patch, dry_run })` returns `{ path, diff, dry_run }` for single-file and `{ files: [{ path, operation, ok, diff?, error? }], dry_run, multi_file: true }` for multi-file, wrapped by `toolResult`; overall multi-file `ok` is false when any operation reports failure. `edit_file` reports `diff`, `replacements`, and `dry_run`. Preserve these shapes for compatibility, or migrate consumers and tests explicitly; report true commit/rollback state instead of implying all-or-nothing success.

**Important implementation constraint:** `edit_file` currently depends on `patch.ts` **only for diff output**, not for exact replacement. Replacing the patch engine must not inadvertently alter `edit_file` text-replacement semantics. Consider separating presentation-only diff generation into a small pure helper if that reduces coupling without duplicating logic.

**Recommended migration plan:**
1. Capture current outward `filesystem.ts` contracts and job/harness patch instructions. Add tests for both single-file and explicit multi-file formats **through `work_tool`** as well as pure helpers.
2. **Rewrite in place:** keep `src/lib/patch.ts` at its existing path and retain the exact externally used exported function names (`applyUnifiedPatchToText`, `applyMultiFilePatch`, `isMultiFilePatch`, `buildSimpleDiff`), callable signatures, return/result shapes and caller-relevant error behavior. Replace their internal implementations and private helpers directly; do not introduce a separate compatibility adapter unless a specific technical need is demonstrated. Keep the existing `filesystem.ts` MCP operation/schema, `work-gateway.ts` family mapping and `server-factory.ts` lease/Workspace wrapper unchanged except for any explicitly justified compatibility or safety fixes.
3. Isolate on-disk multi-file staging/commit/recovery. Preflight all targets/content before mutation; detect changes between preflight and commit; validate the confirmed Workspace immediately before each mutation and address symlink/junction and path-swap race limitations. Do not promise unconditional atomicity or perfect rollback.
4. Add real-file acceptance in a disposable confirmed absolute Workspace: positive add/update/delete, dry-run, mismatch, duplicate target, partial-write fault injection and recovery, outside path, symlink/junction. Test `edit_file` diff separately.
5. Run targeted patch/filesystem/work-gateway/job tests, TypeScript build, `validate:jobs`, the default test suite and applicable CI. Only after these pass remove the old internal implementation. If unexpectedly broad compatibility requirements surface, revisit REFACTOR instead of forcing greenfield.

**Blast radius assessment:** **small at the direct import layer, moderate at the behavioral layer, high for file-integrity failure modes**. No justified need to rewrite MCP transport, Job Runtime or Work Gateway merely for this change. Runtime behavior through dynamic/externally authored Custom Jobs cannot be exhaustively proven from static repository inspection alone.

#### Review 02 — `src/lib/mcp-session-manager.ts`

**Status: SOURCE REVIEW COMPLETE; concurrency/transport fault-injection and runtime acceptance PENDING. No implementation changes.** Compared current GPTWorker module with accessible upstream `hoangcoderr/chatgpt-local-coder/src/lib/mcp-session-manager.ts`; examined current `src/index.ts`, `src/server-factory.ts`, `src/lib/mcp-discover-compat.ts`, and relevant existing tests. A current-upstream comparison is not proof of the precise historical fork baseline.

**Actual interface and caller map:**
- `src/index.ts` directly imports `createSessionManager`, `consumeSessionTransportError`, `extractRequestId`, and `isInitializeRequest`. The manager's live API includes `get`, `count`, `createNew`, `handleExisting`, `tryRecoverStale`, `sendSessionNotFound`, `sendBadRequest`, `startCleanup`, and `stopCleanup`. Preserve these exported function names, type contracts and caller-visible semantics if rewriting in place.
- `src/server-factory.ts` is used inside `buildSession` to create an MCP server for each transport; each new MCP server instantiates its own admission/job orchestration. MCP transport recovery must therefore not be represented as recovering old in-memory Job/work state.
- `src/lib/activity-log.ts` receives session init/delete/removal/expiry/recovery and transport events. `src/lib/mcp-discover-compat.ts` is a separate active compatibility shim called by `index.ts` before stateful session creation; do not remove or merge it without protocol-level tests.
- `scripts/test-idle-runtime.mjs` currently asserts some recovery-function names exist in source; `scripts/test-mcp-discover-compat.mjs` covers stateless discovery fallback. These do **not** constitute exhaustive tests of recovery, concurrent HTTP requests or timed cleanup.

**Existing Tool Lease ownership (do not duplicate):** `src/lib/work-registration.ts` already issues a distinct `leaseId` in `acquireToolLease` for each authorized tool invocation and tracks active leases against the work registration. `src/server-factory.ts` acquires/releases each lease and invokes the tool under `runWithWorkspaceScope`. The MCP session identifier is a **connection identity**, not a replacement work ID, tool ID, authority token or active-operation ledger. A session-manager rewrite must not introduce duplicate tool IDs, active-tool registries, work leases, work-authorization logic, or a second Job lifecycle. Session serialization remains distinct: it orders HTTP transport requests for a session and must not be confused with the existing per-tool lease. If graceful DELETE/shutdown needs to know whether a request is in flight, use the existing lease authority/lifecycle through an explicitly scoped integration **only if necessary**, instead of duplicating its state. Verify that losing/recovering an MCP connection neither silently extends authority nor falsely claims to restore the previous Job runtime.

**Required behavior:**
- Session creation and routing through SDK Streamable HTTP transport for POST, GET/SSE, and DELETE.
- Keep GET/SSE out of the per-session serialized POST/DELETE operation chain to avoid blocking subsequent tool requests.
- Correct session-ID and protocol-version handling, TTL expiry, explicit DELETE grace, recovery of stale MCP connection when enabled, error responses and useful logging.
- No Codex hooks, MCP upstream proxy or GitHub-specific logic. Current GPTWorker has already retired upstream-specific proxy/hook dependencies.

**Design/safety issues requiring tests, not yet confirmed runtime defects:**
1. `tryRecoverStale` can build pending recovery state and perform loopback HTTP initialize/initialized before handling the original request. Model concurrent recovery requests for the same stale ID, duplicate pending builds, warm-up failure and stale transport teardown. Evaluate whether a per-ID single-flight promise and an explicit recovery state machine would be simpler/safer.
2. `stopCleanup` clears the periodic cleanup interval but does not presently drain DELETE grace timers or close tracked transports. Specify shutdown ownership and safe cleanup semantics, including any active in-flight requests.
3. Closing a transport and retaining its session entry for recovery differs from a genuinely usable open transport. Validate behavior after SSE disconnect, DELETE, TTL expiry, SDK close events and restart.
4. `withSessionIdHeader` mutates `req.headers` **and** `req.rawHeaders` to satisfy current SDK/Hono conversion. Preserve this compatibility only if required by the pinned SDK/client integration; test supported/unsupported protocol-version negotiation instead of casually removing the shim.
5. In-memory maps for sessions, pending recoveries, operation queues, delete timers and recent transport errors have related lifetimes. Check orphaned state, duplicate disposal, memory growth and one-time error consumption. Do not assume that deleting a queue map entry cancels an already-running operation.
6. After stale-ID recovery, `createMcpServer` establishes a **new** admission/Job runtime; document that the same MCP session identifier is not a guarantee of restored Job authority, execution id or work progress.

**Greenfield rewrite-in-place alternative:** preserve `src/lib/mcp-session-manager.ts` and its current exported names/signatures. Design a compact session record and explicit lifecycle states (new/active/recovering/closing/closed), clear ownership of timers/transports, single-flight stale recovery per session ID, and testable transport/clock/loopback seams without multiplying production layers. Prefer SDK-native facilities whenever proven compatible. Keep existing `index.ts` routing, `server-factory.ts` and discover fallback unchanged unless a necessary integration fix is evidenced. Evaluate KEEP or targeted REFACTOR against GREENFIELD REWRITE after behavior/SDK tests; do not decide based on code provenance.

**Reassessment after existing Tool Lease review:** The manager should own **MCP connection/session lifecycle only**. The existing `src/lib/work-registration.ts` already owns work authority, per-call `leaseId`, active Tool Lease tracking and the work idle timeout; `src/server-factory.ts` acquires/releases leases around scoped tool execution. Do not add a second operation-ID, active-tool registry or Job lifecycle to MCP sessions. Keep the per-session request queue only for transport ordering (with GET/SSE excluded from the serialized POST/DELETE path); it has a different purpose from Tool Lease.

**Concrete source-level findings to test:**
- `touch()` currently cancels an existing DELETE grace timer. Requests arriving after DELETE may therefore defer removal. Determine intended protocol behavior, then test DELETE followed by requests; do not let unrelated traffic indefinitely extend a closing session.
- When DELETE grace expires, `removeSession()` deletes bookkeeping but does **not** itself call `transport.close()`. Confirm SDK close-event semantics and ensure resources are actually released exactly once. TTL explicitly invokes `transport.close()`, but without waiting for completion.
- `stopCleanup()` currently stops the periodic sweep only; it is not a full shutdown/drain API. Determine whether a separate graceful shutdown is needed, taking care not to cancel active work merely because a transport disconnects.
- `tryRecoverStale()` has no visible single-flight guard by stale session ID. Two concurrent recovery requests may build separate transports and race to install the same ID; add a targeted concurrency test.
- Several state containers have different ownership: instance-local `sessions`/`pendingRecoveries`/`deleteGraceTimers` and module-global `sessionOpChains`/`lastTransportErrors`. Check teardown and cross-instance isolation.
- Recreating an MCP server for a recovered transport also recreates the per-server Job/admission components. Restoring a session ID must never implicitly reauthorize or promise resurrection of the previous Job/work handle.
- The 45-second DELETE grace and 24-hour session TTL are **transport policies**, not substitutes for the existing active Tool Lease and work-idle rules. Only add a narrow integration to consult existing lease state if verified necessary for safe transport shutdown.

**Updated implementation options:** KEEP the proven SDK transport/compatibility behavior. Compare a **targeted in-place REFACTOR** of session state ownership, DELETE/TTL/shutdown cleanup and per-ID recovery single-flight against a greenfield in-place implementation with the exact same exported caller contract. Prefer the smaller change if protocol-level tests show no material benefit from full replacement. Do not add a compatibility adapter or duplicate Tool Lease. The final decision remains pending the full cross-file review and integration/fault-injection tests.

**Dependency cluster:** MCP session manager + `index.ts` router + `server-factory.ts` construction boundary + active protocol compatibility + logging. These are a review and test cluster, **not** an instruction to rewrite every member.

**Acceptance tests before final decision:** initialize and normal request flow; concurrent POST/DELETE; long-lived GET/SSE plus concurrent POST; explicit DELETE grace with in-flight tool; TTL expiry; recovery enabled/disabled and concurrent stale-ID requests; loopback init/notification failure; duplicate/invalid protocol headers; session cleanup/shutdown; no leaked pending recovery or timers; modern `server/discover` fallback; separation of transport recovery from Job authority. Include real HTTP/SDK integration, not just source-string tests.

**Updated decision — add UPGRADE GREENFIELD REWRITE-IN-PLACE as an explicit option.** KEEP is the existing safe baseline, but the user's aim is to make GPTWorker functionally more robust, not merely shorten code or remove rarely used paths. Evaluate targeted REFACTOR and a **requirements-first full rewrite of the module's internals** against KEEP, prioritizing measurable improvements in connection reliability and recoverability. The final implementation choice will be made in the single cross-file plan after all file reviews and protocol/integration tests; do not start rewriting this file in isolation.

**Detailed greenfield upgrade direction (keep the same file and caller-facing API):**
1. **Strict scope and compatibility:** retain `src/lib/mcp-session-manager.ts`, all `index.ts`-used exports (`createSessionManager`, `consumeSessionTransportError`, `extractRequestId`, `isInitializeRequest`), the existing `SessionManager` methods/signatures and caller-visible MCP responses. Preserve SDK-backed Streamable HTTP POST/GET/SSE/DELETE and modern-client discovery fallback. Internal functions/data structures may be designed anew; no compatibility-adapter module by default.
2. **Connection-only state machine:** design one owner for each session's transport, timers, error/recovery status and explicit transitions (initializing, active, recovering, closing, closed). Keep request ordering separate from lifecycle state. Never create a second Job/work registry.
3. **Single-flight reconnect:** concurrent requests referencing the same stale MCP session ID must share one recovery attempt or fail deterministically; bound recovery, ensure failed init/notification clears pending state, close abandoned transports, and preserve SDK-required protocol negotiation/header behavior.
4. **Correct close semantics:** distinguish a transient SSE disconnection from explicit client DELETE, TTL expiry and process shutdown. Once a session enters closing, later requests must not indefinitely reset its close timer. Ensure exactly-once best-effort resource disposal and auditable errors; do not claim OS-level or network-level guarantees.
5. **Long-running calls without duplicated tracking:** preserve GET/SSE nonblocking behavior; leave per-tool `leaseId`, work authority, active-call tracking and work idle timeout to existing `work-registration.ts` plus `server-factory.ts`. Consult the existing lease lifecycle through a narrow, proven necessary interface only if a tested close/shutdown scenario requires it. A recovered transport ID must never imply a recovered or reauthorized previous Job; never blindly replay a potentially mutating tool call.
6. **Robust shutdown and observability:** explicitly drain/cancel timers, close or safely retire transports, clean per-manager session/recovery/queue/error resources and log meaningful transitions/failures through existing `activity-log.ts`. Keep optional diagnostics from becoming an additional registry or logging system.
7. **Design constraints:** use installed MCP SDK primitives when behavior is demonstrably compatible; avoid additional dependencies and new production modules unless they materially improve reliability or testability. Review `index.ts`, `server-factory.ts`, `mcp-discover-compat.ts`, `activity-log.ts` in the same dependency cluster before finalizing the shared implementation plan.
8. **Proof of improvement:** compare KEEP, targeted REFACTOR and UPGRADE GREENFIELD in a test matrix: initial handshake and normal requests; long GET/SSE plus POST; concurrent stale-ID recovery; failed loopback init/notification; repeated DELETE/late request; TTL/stop and resource cleanup; protocol versions and discovery fallback; disconnect while an active Tool Lease executes; no duplicate tool execution or accidental Job authority restoration. Prefer full rewrite only when it demonstrates a material functional/reliability gain relative to the baseline, not because of provenance or minor unused code.

**Evidence limit:** DELETE grace, race, cleanup and reconnect weaknesses above are source-level risks pending runtime reproduction, not established production failures. Keep substantial inherited code attribution until actual retained distribution is audited.

#### Review 03 — `src/lib/tool-result.ts`

**Status: SOURCE REVIEW COMPLETE; targeted helper and actual MCP output-schema integration tests pending. No code changes.** Current GPTWorker blob `7b3d352c42cda22ed2580344ff19d5bfb283205a`; accessible upstream `hoangcoderr/chatgpt-local-coder` blob `bde6e40866ac03f1ce0c87c39f14dc17d87a76c4`. Their small implementations are substantially the same, with GPTWorker-specific labeling. Current upstream is not proof of historical fork provenance.

**Public exports to keep:** `ToolResultPayload<T>`, `TOOL_RESULT_OUTPUT_SCHEMA`, `toolResult<T>(tool,data,options?)` and `toolError(tool,message,data?)`. The stable envelope is `{ok:boolean,tool:string,summary:string,data:object}`, returned both as readable JSON text in `content` and structured JSON in `structuredContent`. `defaultSummary` is private.

**Caller and integration map:** Direct imports of `toolResult` occur in `src/tools/filesystem.ts`, `shell.ts`, `context.ts`, `admission.ts`, `workspace-discovery.ts`, and `jobs.ts`; `jobs.ts` also calls `toolError` to return recoverable Job-control errors. `src/server-factory.ts` imports `TOOL_RESULT_OUTPUT_SCHEMA` and advertises it by default for registered tools without a custom output schema. The generic `work_tool` dispatches the selected captured callback and returns its result unchanged; it does not independently rewrap tool-result envelopes. An intentional exception is `gptworker_control`, which declares and returns its own `{text}` output schema. Other direct MCP tool callback and test consumers must preserve this distinction.

**Behavioral dependencies:** `scripts/test-filesystem-core.mjs` explicitly reads `result.structuredContent.ok` and fields under `data`. `scripts/test-work-gateway.mjs` exercises deferred callback forwarding. `src/tools/shell.ts` sets `ok` from the command's exit code; `jobs.ts` translates caught exceptions through `toolError`. Changing the shared envelope or `ok` interpretation would affect multiple active Job families and the MCP output schema, so retain it.

**Concrete low-cost improvement opportunities:**
- `toolError(tool,message,data)` currently constructs `{error:message,...data}`, permitting a supplied `data.error` property to overwrite the original message. Consider `{...data,error:message}` only if existing caller semantics support it, with a focused regression test.
- `toolResult` calls `JSON.stringify(payload)`; non-JSON-safe or cyclic data would throw during text generation. Assess whether any active tool produces such values before adding sanitization or dependencies; favor simple explicit serialization failure reporting if needed.
- Validate a real MCP SDK interaction to distinguish GPTWorker payload `ok:false` from protocol-level `isError` behavior; do not silently change the outward contract or add `isError` until caller/client expectations and schema are tested.
- The open `data` schema is intentional: each tool has different structured fields. Replacing it with a single rigid schema would introduce cross-file coupling and is not justified by current evidence.

**User-approved decision: KEEP unchanged.** The shared envelope is compact and broadly used across active tools; rewriting, opportunistic hardening and removing rarely used code are out of scope for this cleanup. Retain the existing filename, public exports, call signatures, schema, text and structured-content behavior. If future integration tests confirm a materially consequential defect, document it as a separate, narrowly scoped fix rather than treating it as justification for this cleanup to rewrite the module.

**Grouped acceptance:** verify successful and failed command results, Job `toolError`, optional summary/default summary, text JSON equality with structured content, default vs custom MCP output schemas, work-gateway forwarding, all active tool-family integrations and non-serializable input handling if it is in scope. Do not mark runtime validation complete from source inspection alone.

#### Review 04 — `src/lib/tool-annotations.ts`

**Status: SOURCE REVIEW COMPLETE; real client approval/presentation tests pending. No code changes.** Current GPTWorker blob `0b6fc50f5b5e79a2308b27ea420bb11455c6ed09`; currently accessible upstream `hoangcoderr/chatgpt-local-coder` blob `51a56b5f8d2db18429f3744a87721f3dad486f58`. Main code is effectively inherited; GPTWorker's comments correctly clarify that annotations do not confer authority. Upstream HEAD is not proof of a historical source baseline.

**Public interface:** `isChatGptAutoApproveEnabled(): boolean`, `ToolRisk = "read" | "edit" | "command" | "destructive"`, `toolAnnotations(risk): ToolAnnotations`. The environment flag `CHATGPT_AUTO_APPROVE` defaults to true; `0`/`false`/`no`/`off` disable it. Keep existing filename and exported names/signatures if any changes are approved.

**Confirmed static caller map:** `toolAnnotations()` is imported by the active tool modules `src/tools/filesystem.ts`, `shell.ts`, `jobs.ts`, `work-gateway.ts`, `context.ts`, `control.ts`, `admission.ts` and `workspace-discovery.ts` (nine modules). Their registered tool annotations cover filesystem reads/edits/deletes, shell commands/process controls, work gateway and control/Job flows. `src/server-factory.ts` independently enforces work-handle admission and scopes execution using existing Tool Lease; `src/lib/tool-work-policy.ts` owns the separate control/work family policy. Tool annotations do **not** enforce read-only, prevent deletion, grant work authority or bypass Workspace checks. Individual external ChatGPT clients control how or whether they consume hint metadata.

**Behavioral review:**
- `read` always returns `{readOnlyHint:true,openWorldHint:false}`.
- With default auto-approve enabled, all non-read risk classes return `{readOnlyHint:false, destructiveHint:false,openWorldHint:false,idempotentHint:risk!=="command"}`, including `destructive` deletion and `edit` operations. This is explicitly low-friction presentation behavior, not a statement of actual destructive capability.
- When disabled, `destructiveHint` is true only for `destructive`, and `idempotentHint` true for all `edit` calls. Real operations such as patching, copying/moving and repeated edits may not always be idempotent. Shell commands can access external/network resources despite `openWorldHint:false`; this flag should not be interpreted as a sandbox.
- `work_tool` is annotated once as `edit` although its dynamic subtools range from read to shell to destructive. Per-subtool public metadata is not dynamically exposed by the current gateway, so annotation changes must consider this envelope-level mismatch rather than falsely asserting all work_tool operations have one risk type.

**Design options:** **KEEP baseline** has a small, straightforward implementation and broad caller integration; a full GREENFIELD rewrite gives no demonstrated functional gain. If real approval UX or misleading metadata causes a material problem, prefer narrowly scoped in-place corrections to hint semantics and/or gateway metadata policy **only alongside a related caller group**, while preserving the existing authorization model. Avoid duplicate risk registries, extra modules and broad changes solely to reduce lines. In particular, do not label hints as security enforcement or infer that they guarantee client auto-approval.

**User-approved decision: KEEP unchanged.** Preserve this module's source, filename, exported helpers and existing client-facing hint behavior. Do not rewrite or change annotation semantics as part of this cleanup merely because some hints are imperfect or rarely used. Only revisit if later real client integration tests demonstrate a material issue; authorization is still enforced independently by Work Registration and Workspace scope.

**Acceptance tests for grouped work:** check every risk class with auto-approve ON/OFF and truthy/falsey environment variants; assert annotation values and tool registration in representative tool families; verify generic `work_tool` exposes what the client actually receives; observe real client approval UX if any metadata policy is changed; run Work Handle/Workspace/Tool Lease negative tests to prove hint variations never change actual authority.

#### Review 05 — `src/lib/activity-log.ts`

**Status: SOURCE REVIEW COMPLETE; focused runtime security, tool-lease/log correlation and logging-failure tests pending. No code changes.** Current GPTWorker blob `251ea07af89713d1bc29657b93344669f3a60c95`; accessible upstream `hoangcoderr/chatgpt-local-coder` blob `044bcb731098fdc3cf7b1ae0b12d85ef1d86e421`. Current source is substantially adapted from upstream: GPTWorker removed upstream's live in-memory subscriber/recent-audit model and writes through `runtime-log.ts`, added schema/work/lease metadata, sanitized persistent event payloads and improved status reporting. Accessible upstream HEAD is not the pinned historical fork point.

**Confirmed direct integration and responsibilities:**
- `src/tools/filesystem.ts` and `src/tools/shell.ts` import `logToolActivity` for tool-level action outcomes.
- `src/lib/work-registration.ts` imports `appendActivity` and logs work registration/release, tool-lease acquisition/release/rejections and timeouts. This is the source of actual work/lease decision events.
- `src/lib/mcp-session-manager.ts` imports `logSystemEvent` for transport and session events, including initialization, DELETE grace, recovery and expiry.
- `src/index.ts` imports `logMcpHttpEvent`, `logMcpRequest` and `logSystemEvent` for HTTP, MCP and process lifecycle; it independently calls `flushRuntimeLog` from `runtime-log.ts` at shutdown.
- `src/lib/activity-log.ts` imports `enqueueRuntimeLog` from `runtime-log.ts` and `requiresWorkHandle`/`toolFamily` from `tool-work-policy.ts`. **Keep responsibilities separate**: activity-log shapes, sanitizes and reports events; runtime-log owns queued JSONL persistence and rotation. The current implementation has no active in-memory history/subscription copy of upstream's former audit layer.

**Public API to preserve if changes are necessary:** `ActivityKind`, `ActivityEntry`, `sanitizeActivityValue`, `summarizeToolArgs`, `appendActivity`, `logSystemEvent`, `ToolActivityEvent`, `logToolActivity`, `logMcpHttpEvent`, `logMcpRequest`. The canonical activity record includes `schema_version:1`, event ID/time, optional session/request IDs, `work_id`, `lease_id`, `job_id` and `tool_family`.

**Observed strengths to keep:** consolidated event model; redaction by sensitive field and known token/assignment/credential-URL patterns including configured secrets; bounded detail traversal and summary lengths; useful console diagnostics; nonblocking queued runtime persistence; explicit Work ID and Tool Lease correlation. No demonstrated benefit from reintroducing another audit-history registry or a wholesale greenfield rewrite.

**Targeted issues to test before proposing fixes:**
1. `logMcpRequest` infers `NO_ACTIVE_WORK` when a `tools/call` request lacks outer `execution_id` or `authority_token`. Generic `work_tool` has nested `arguments` for the delegated tool and can be mistaken for an unauthorized delegated request; moreover, inferring rejection from the request shape/HTTP status is not equivalent to an actual `acquireToolLease` outcome. Prefer authoritative lease events for security verdicts and avoid duplicate/misleading blocked records after testing current flows.
2. `summarizeToolArgs` may return raw `command`/`path` strings to its caller, but `appendActivity` sanitizes emitted summary, target and details. Test both helper behavior and emitted/persisted records to avoid accidental leaks through any future caller that bypasses `appendActivity`.
3. `sanitizeActivityValue` uses bounded traversal and regex/configured-secret redaction; it is a useful best-effort mechanism, not proof that all possible secrets are removed. Test nested tool arguments, error strings, shell commands, work_handle tokens, credential URLs and actual log output.
4. Current `logMcpRequest` classifies HTTP 2xx tool calls as `ok` unless an inferred work-handle rejection is detected, even though the MCP tool payload can represent `ok:false`. Avoid treating HTTP success as proof the tool action succeeded; actual Tool Lease and tool-result events should be correlated where possible.
5. `runtime-log.ts` intentionally swallows persistence failures to keep execution uninterrupted. Test the failure/rotation paths and confirm acceptable observability loss; do not make synchronous logging a new dependency for tool execution. Its configured `ACTIVITY_LOG_PATH` belongs to worker logging, not an implicit permission to mutate Job support roots or arbitrary project paths.

**KEEP vs rewrite options:** **KEEP baseline**. Small, real correctness/security gains may justify focused in-place edits to `activity-log.ts` along with any necessary narrowly scoped caller/lease event alignment in the shared logging cluster. GREENFIELD rewrite provides no proven advantage at this stage and risks changing widely consumed event fields or weakening secret redaction. Do not change the public event schema or add a duplicate ledger merely to reorganize code.

**Existing tests and missing coverage:** `scripts/test-activity-log.mjs` checks persisted activity, MCP request records, missing-handle events and token redaction. `scripts/test-runtime-log.mjs` exercises redaction, rotation, truncation and fail-open persistence in a disposable temporary directory. These scripts were inspected, not executed in this review. Add integration coverage through actual `work_tool`, real `acquireToolLease` success/rejection, content-level `ok:false`, secret-bearing errors and cross-session isolation before any intentional behavior change.

**User-approved decision: KEEP unchanged.** Retain the existing event schema, redaction, Tool Lease correlation, runtime-log persistence and callers. Do not refactor or rewrite the logging subsystem as part of this cleanup. Keep the noted accuracy/security concerns as test-only follow-ups; any consequential confirmed defect requires a separately scoped fix.\n\n#### Review 06 — `src/tools/filesystem.ts`

**Status: SOURCE REVIEW COMPLETE; security/race/mutation tests and cross-file implementation decisions pending. No code change.** Current GPTWorker blob `29749d1e886834b1be251a211b120f0bbd68cb99`. Compared against currently accessible upstream `hoangcoderr/chatgpt-local-coder/src/tools/filesystem.ts` (not assumed to be the exact historical fork revision). GPTWorker already retired redundant base64/regex/multi-edit/tree/legacy-search/checkpoint paths and consolidated the active local file API.

**Caller and dependency map:** `src/tools/work-gateway.ts` lists twelve current filesystem operations in `FAMILY_TOOLS.filesystem`, loads `filesystem.ts` lazily and invokes callbacks under the existing work-handle/Tool Lease and confirmed-Workspace scope supplied via `src/server-factory.ts`. `registerFilesystemTools(server)` is the only exported function. This file imports `validatePath`/`validateReadPath`/`getDefaultCwd` from `path-security.ts`, `applyMultiFilePatch`/`applyUnifiedPatchToText`/`buildSimpleDiff`/`isMultiFilePatch` from `patch.ts`, `globFiles`/`grepSearch` from `file-search.ts`, plus shared `toolResult`, `toolAnnotations` and `logToolActivity`. All these helpers have direct runtime call sites. The active Dev Coding Job preloads the filesystem family; other Jobs/Custom Jobs can use its exposed operations when authorized.

**Must retain current public operations and argument/result contracts:** `read_text_file`, `write_file`, `edit_file`, `apply_patch`, `list_directory`, `glob`, `grep`, `delete_file`, `create_directory`, `delete_directory`, `copy_file`, `move_file`. Do not reintroduce upstream's retired redundant tool family. Preserve the external `registerFilesystemTools` export, the twelve registrations, Work Gateway names, structured results and documented existing behavior unless there is an explicitly tested safety/correctness improvement.

**Established architecture worth keeping:**
- Separate exact `edit_file` from structured `apply_patch`, since they address different tasks. `edit_file` depends on `patch.ts` only for diff presentation.
- Reads use `validateReadPath`: confirmed Workspace plus active read-only Job support roots. Structured mutation targets use `validatePath`: confirmed absolute Workspace only. `copy_file` correctly uses read validation for source, mutation validation for destination; `move_file` requires both endpoints to be writable. No support-root write exceptions.
- Parsing/matching belong to `patch.ts`; glob/grep algorithms belong to `file-search.ts`; path-policy/canonicalization belongs to `path-security.ts`. Filesystem remains a narrow public MCP operation layer, not another independent security or tool-ID registry.
- `delete_directory` and `move_file` explicitly reject the active Workspace root. Their path alias/symlink edge cases still require real-filesystem tests.

**Source-level improvement opportunities (not yet runtime-proven defects):**
1. `write_file`, `edit_file`, single-file `apply_patch`, `copy_file` and `move_file` perform validation and later path-based mutation in separate operations. Inspect symlink/junction swaps and TOCTOU near commit, especially on Windows. `validatePath` itself is not an OS sandbox. Do not invent a guarantee of complete race-free containment without handle-level/platform tests.
2. `write_file` intentionally overwrites existing destinations; `copy_file` and `move_file` rely on Node filesystem semantics for collisions. Document and test exact current overwrite/failure behavior before changing it. Avoid introducing blanket no-overwrite rules that silently break legitimate Job workflows.
3. `apply_patch` uses the shared `patch.ts` parser and multi-file executor; its quality/integrity issues belong in the joint patch/filesystem/path-security batch. Keep outward `{path,diff,dry_run}` and `{files,dry_run,multi_file}` result shapes stable if internals change. Single-file and multi-file `dry_run` must perform zero mutation, including no unintended directory creation.
4. `edit_file` supports first exact replacement or `replace_all`; preserve those distinct behaviors while independently improving diff generation if the patch engine rewrite is selected. Confirm behavior for multiple occurrences, empty new text, CRLF and stale file contents.
5. Large reads and recursive search should be characterized against actual coding workloads, response size and existing limits rather than redesigned speculatively; `read_text_file` currently reads entire file before slicing offset/head/tail.
6. `delete_directory`/root checks compare lexical resolved paths; canonical aliases, symlink/junction targets and recursive deletion need direct tests. Error/log behavior for failed or partially completed operations must remain intelligible.

**Candidate outcome:** KEEP the current twelve-tool facade and overall file/module structure. If full-repo audit and grouped tests demonstrate meaningful reliability improvements, make **targeted rewrite-in-place of the mutation internals** in `filesystem.ts` alongside the planned `patch.ts` rewrite and `path-security.ts` review. Avoid a separate compatibility adapter, duplicate path-security layer, wholesale reimplementation of stable read/search code or unnecessary edits to Work Gateway. A full greenfield rewrite of all twelve operations is not justified by static evidence alone; reconsider only if later caller/security review finds broader structural defects.

**User-approved decision — targeted improvements, not a rewrite:** keep the current `src/tools/filesystem.ts` and its twelve public MCP operations, input and output contracts, existing module split and sound read/search flows. Plan only focused changes that demonstrably improve correctness, filesystem safety or the new `patch.ts` integration. Do not rewrite the complete tool facade, split it into new public modules, add a compatibility adapter, reinstate redundant tools or change unrelated helper implementations.

**Implementation scope for the later grouped patch/filesystem/path-security batch:**
1. Preserve `registerFilesystemTools`, all twelve registered operation names and `work_tool` dispatch. Ensure that `edit_file` exact/replace-all behavior and read-only Job support roots remain unchanged.
2. Integrate the approved `patch.ts` parser/hunk validation and preflight/error handling without changing `apply_patch`'s outward single-file/multi-file response shape. Prove that a failed preflight cannot partially mutate a multi-file patch; document fault/recovery semantics accurately.
3. Target mutation safety at the I/O boundary: recheck confirmed absolute Workspace authorization near mutation; characterize symlink/junction races and root aliases on Windows; strengthen only what the selected `path-security.ts` design can actually enforce. Do not promise perfect OS sandboxing.
4. Clarify and test current overwrite/collision semantics for `write_file`, `copy_file` and `move_file` before changing behavior. Preserve compatibility by default; any safety-driven behavior change must be explicit and regression-tested.
5. Add targeted negative tests covering `dry_run` (no disk writes), failed edits, file-content drift, out-of-Workspace paths, Job support-root write attempts, root move/delete, symlink/junction escapes, duplicate/conflicting patch targets and multi-file failure/rollback. Keep error results and activity logs useful.
6. Review the combined changes once after all 13 files have been evaluated and the unified implementation plan is written. Only then implement and run targeted tests, full build/Job validation and CI **as one related batch**, per the agreed repository-wide process.

**Acceptance in combined batch:** positive/negative for all twelve operations via both registered callback and Work Gateway; exact edits and patch formats; multi-file preflight, fault injection and recovery if implemented; dry-run file-system snapshot; existing/destination collision behavior; Workspace root and outside-Workspace write denial; read-only Job support roots; canonical symlink/junction escapes and TOCTOU characterization; tool result/activity compatibility; build, `validate:jobs`, targeted/full CI. `scripts/test-filesystem-core.mjs` already covers twelve-operation registration and a positive sequence inside a temporary confirmed Workspace but not the required full negative matrix; source inspection is not a fresh test run.

#### Review 07 — `src/tools/shell.ts`

**Status: SOURCE REVIEW COMPLETE; process ownership, command/Workspace boundary and runtime fault-injection tests pending. No code changes.** GPTWorker current blob `c273d1ac814abdd624f7b42428fc9e77ebd8bbf8`; accessible upstream `hoangcoderr/chatgpt-local-coder` blob `1658122a1f17349b6dee84033feac7133654a9e1`. Current upstream is not the proven fork-base revision. GPTWorker already removed upstream's persistent-shell bootstrap/status/reset, audit/checkpoint dependencies and `clear_processes`; it now runs each short command from the scoped Workspace root (or an explicit validated absolute `working_directory`), and tracks background processes in memory.

**Confirmed active public contract and callers:** exported `registerShellTools(server, timeoutSec)` and `runShellCommand(command,workspaceRoot,timeoutMs,workingDirectory?)`. `src/tools/work-gateway.ts` lazy-loads `shell.ts` and registers the five active tools `run_command`, `start_process`, `process_status`, `process_output`, `stop_process`; `server-factory.ts` supplies the existing Work Handle/Tool Lease gate and `runWithWorkspaceScope`. Helpers: `path-security.ts` (`assertPathInsideWorkspaceSync`, `getDefaultCwd`, `validatePath`), `shell-workspace-guard.ts` (`assertShellCommandWorkspaceBound`), plus activity, result and annotation helpers. `scripts/test-workspace-boundary.mjs` directly calls `runShellCommand`; `scripts/test-shell-persist.mjs` registers all five and tests stateless cwd, background process lifecycle/output and retirement of old surfaces. Review these as live test consumers; preserve signatures and result envelopes.

**Architecture to KEEP:** separate child-process launch from tool registration; no persistent cross-call cwd; a fresh short-lived shell per `run_command`; stateless per-call explicit absolute `working_directory`; Job support scripts remain executable/readable only under the declared support-root guard, not general writable roots; workspace-scoped background process listing/output/stop, bounded retained output (currently 400k chars) and pruning of finished records (currently 30-minute retention and 100-record soft cap). Shell does not issue Tool Lease or independently control Job admission.

**Important architectural limits and focused improvements:**
1. **No false OS-sandbox claim:** `assertShellCommandWorkspaceBound` extracts some absolute paths and blocks `../` patterns and the `cd`/pushd family, but arbitrary shell commands can construct paths dynamically, resolve env vars, invoke nested interpreters or spawn other tools; static string scanning cannot enforce that every file mutation remains within the confirmed Workspace. The helper currently also allows trusted Job support script references in read/execute contexts. Test realistic Windows PowerShell, cmd, Git and nested commands; determine a practical enforcement/authorization model in the combined `shell.ts` + `path-security.ts` + `shell-workspace-guard.ts` review rather than treating static parsing as a complete security boundary. Never silently run untrusted commands under an unsupported sandbox guarantee.
2. **Lifecycle vs process registry:** current module-global `processes` map keys authorization by `workspaceRoot` only. A new Job generation with the same Workspace may find or control a process from an earlier Job. Define behavior for Job stop/switch, idle cleanup, restart and concurrent same-Workspace work; integrate narrowly with existing `work-registration.ts` generation/work lifecycle only when confirmed necessary. Do not duplicate Tool Lease, add a second job registry or stop unrelated local processes.
3. **Process termination:** `runShellCommand` timeout sends `SIGTERM` to the shell process and relies on child `close`. `stop_process` returns after sending a signal, not after verifying termination of all subprocesses. Characterize spawned process trees and Windows behavior; design explicit best-effort kill/cleanup and accurate output/exit reporting for the selected platforms.
4. **Output bounds/failures:** short `run_command` concatenates stdout/stderr without a maximum, unlike background processes. Test huge output, timeout, failed spawn, nonzero exit codes and sensitive output; bound memory and return a clear truncated indicator if a cap is introduced. Preserve existing `toolResult` shape unless a documented enhancement is necessary.
5. **Windows compatibility:** `windowsShell()` prefers PowerShell 7 then Windows PowerShell; `transpileLegacyPowerShellAndOr()` attempts to emulate `&&`/`||` by scanning quotes, but it is not a full PowerShell parser. Test quoted/literal operators, multi-line commands and PowerShell 5.1 fallback. Do not remove it just to shrink code while active users still need that platform.
6. **Runtime invariants:** `process_status`/`process_output` currently filter by canonicalized lexical Workspace equality, not by Work ID or lease. Background spawn currently generates a short timestamp/random ID. Test collisions, cross-Job isolation, finished-process cleanup and lack of leaked child processes; only change process IDs or record internals if concrete tests motivate it.

**Candidate decision:** **KEEP** the current stateless shell design and five-tool API. Consider **targeted in-place improvements**, not a blanket greenfield rewrite, when the full 13-file audit has compared the boundary and lifecycle responsibilities with `path-security.ts`, `server-factory.ts` and Work Registration. Security or process lifecycle changes may need a coordinated limited edit to existing neighboring modules; preserve caller-visible names/signatures and only expand results deliberately. Full rewrite remains an alternative only if evidence shows that targeted improvement cannot meet the approved invariants.

**Acceptance tests:** all five registered operations; per-call cwd isolation; positive and negative absolute paths; Job support scripts read/execute but never write; root/parent/symlink/junction escape characterization; nested commands and dynamic path bypass attempts; two Job generations sharing one Workspace; stop/idle and background process lifecycle; timeout with spawned children; very large stdout/stderr; PowerShell 5.1/7 semantics and Windows process-tree behavior where runner supports Windows. Existing `test-shell-persist.mjs`/`test-workspace-boundary.mjs` were inspected, not freshly executed; add integration/negative tests and full CI only when the unified implementation batch begins.

**User-approved decision: KEEP unchanged.** Retain the five operations and current stateless execution design. Do not refactor or rewrite `shell.ts` in this cleanup; record process ownership/security observations for independent test-led follow-up if they become material. The lexical shell command guard is not a guaranteed OS sandbox.

#### Review 08 — `src/lib/path-security.ts`

**Status: SOURCE REVIEW COMPLETE; Windows-specific symlink/junction, scope and mutation race tests pending. No code changes.** Current blob `b788c49d5d4058076c197d92ecf0eb37bf13d19c`; accessible upstream `hoangcoderr/chatgpt-local-coder` blob `3cab305010f0ae92193fe8cea0e722556da00f42`. GPTWorker's implementation has substantively replaced the upstream all-machine-root model with scoped absolute Workspace and read-only support-root checks. The accessible upstream is not necessarily the exact original fork baseline.

**Exports / actual callers:** `setDefaultCwd` / `getDefaultCwd` from entrypoint, filesystem, shell, workspace discovery and tests; `runWithWorkspaceScope` from `server-factory.ts` to execute callbacks within the active leased Workspace; `getActiveSupportRoots` from `shell-workspace-guard.ts`; `validatePath` / `validateReadPath` from filesystem, shell, patch and workspace-related tools; `assertPathInsideWorkspaceSync` / `isPathInsideWorkspaceSync` / `isPathInsideAnyRootSync` from shell workspace guard, supporting authorization checks and tests. Preserve signatures and absolute-path requirements.

**Keep:** per-call `AsyncLocalStorage` Workspace scope; canonical existing-ancestor resolution; Windows case normalization; lexical segment-aware containment; separate read permission for active Job support roots and write permission for the confirmed Workspace. `validatePath` without an active scope deliberately validates absolute paths for pre-confirmation/control-plane tasks; only the server registration wrapper grants execution authority.

**Candidate targeted hardening:** root/candidate canonical identities under junctions, symlinks and nonexisting descendants; normalize Windows network and case alias edge cases; inspect race windows between path check and actual filesystem mutation (Node path-based I/O cannot provide a blanket no-TOCTOU guarantee); verify support-root symlinks do not enlarge read authority; preserve graceful support for valid Windows paths with spaces. Coordinate only necessary implementation changes with `filesystem.ts`, `patch.ts` and `shell.ts` in the later dependency batch; do not add a duplicate Job authority layer or promise OS sandboxing.

**Tests:** existing `scripts/test-workspace-boundary.mjs` checks scoped absolute paths, outside writes, read-only support roots, junction/symlink escape when available, shell guard and multi-file patch denial. Add true Windows junction/UNC/alias/parent-swap and concurrency characterization, including actual write denial after path changes; run direct helper tests and real work-tool acceptance before claiming complete confinement.

**Provisional decision:** KEEP the strong existing scope architecture, with strictly targeted mutation-boundary hardening if tests substantiate a useful improvement.

#### Review 09 — `src/index.ts`

**Status: SOURCE REVIEW COMPLETE; HTTP/MCP runtime and shutdown integration pending. No code changes.** Current blob `b02b8d128a9d679caa83d6b6caa8725cbc7a73e9`; accessible upstream blob `2016953d9effddb588bc2eb47a79ee297d50e656`. GPTWorker already uses a slim control-plane instruction context, its own session manager and work telemetry rather than upstream's rich memory/upstream-MCP wiring; current upstream HEAD does not establish historical provenance.

**Responsibilities and actual callees:** single process entrypoint, dotenv and workspace-root configuration, `setDefaultCwd`, `buildInstructionContext`, `createSessionManager`, Express and CORS, JSON body parser, tokenized MCP route aliases, GET/POST/DELETE MCP dispatch, stateless `buildLegacyDiscoverFallback`, structured request/system logging, `/health` telemetry via Work Registration and Work Gateway, startup diagnostics, port errors and SIGINT/flush. `src/lib/mcp-session-manager.ts` provides the concrete transport/session methods and errors; `server-factory.ts` creates per-session MCP registration and Job/admission runtimes. Preserve client-facing route and error behavior.

**KEEP:** existing POST handler routing (discovery probe, active session, initialize, stale recovery and required-session errors), separate GET/SSE and DELETE handlers, localhost default binding, transport compatibility, root and tokenized MCP aliases, slim health and control-plane status. Do not merge session manager into index or reimplement Job/Tool Lease here.

**Focused candidates:** (1) GET and DELETE currently await asynchronous transport handling without a symmetrical explicit error boundary to POST; validate Express version/async rejection behavior and ensure one JSON-RPC response where headers have not been sent, especially during SSE. (2) SIGINT calls `sessionManager.stopCleanup()`, flushes logs, then waits for HTTP server close, but `stopCleanup` is not currently a transport-drain API; coordinate with the selected MCP session lifecycle upgrade and bound shutdown without terminating unrelated local jobs. (3) `/health` returns Workspace paths and MCP endpoints, and CORS is enabled; test exposure when configured HOST is reachable off localhost. Token-as-URL-route remains existing operational behavior: avoid logging actual secrets; do not infer tokenized URLs equal strong general authentication. (4) validate PORT/SHELL_TIMEOUT and user-supplied workspace-root configuration and error paths instead of accidentally emitting misleading health/guarantees.

**Tests:** existing `scripts/run-all-tests.mjs` boots server, probes health, initializes MCP and checks tools/list; `scripts/test-mcp-session.mjs` exercises session flow and recovery. Extend actual GET/DELETE failures, long SSE, shutdown/inflight lease, HOST/health exposure and logs; no fresh runtime tests were run in this review.

**Provisional decision:** KEEP the existing single entrypoint and routing; consider narrow error/shutdown/health hardening only if cross-file runtime evidence demonstrates a need.

#### Review 10 — `src/server-factory.ts`

**Status: SOURCE REVIEW COMPLETE; end-to-end per-tool lease/authority negative tests pending. No code changes.** Current blob `8353e84581f4f3e0f16bbfeb139da186f59c21f9`; accessible upstream blob `6c09ec16fd0f38f0b5541c0fda4cbfcc881a730d`. GPTWorker's implementation is substantially transformed into scoped Job/admission/work-gateway architecture, replacing upstream's direct eager filesystem/shell/Git/repl registration.

**API and caller map:** `createMcpServer(shellTimeout,serverInstructions)` is called by `src/lib/mcp-session-manager.ts` when building each MCP transport. Internal `configureToolRegistration` wraps `server.registerTool`, injects required `execution_id` / `authority_token` and the shared `TOOL_RESULT_OUTPUT_SCHEMA` where applicable, resolves delegated effective tool for `work_tool`, calls existing `acquireToolLease`, strips public credentials before forwarding, invokes callback via `runWithWorkspaceScope(lease.workspace,supportRoots,...)` and releases Tool Lease in success and error paths. Registers `gptworker_control`, session-scoped `AdmissionRuntime`, `registerAdmissionTool`, `JobRuntime`, lazy `registerWorkGateway`, pre-confirmation `registerWorkspaceDiscoveryTool` and Job tooling including preload hooks. Direct dependencies: `tool-work-policy.ts`, `work-registration.ts`, `worker-home.ts`, `path-security.ts`, all active control/job/gateway callers.

**KEEP core architecture:** work handle and Tool Lease are the single authority source; do not duplicate IDs or registries in MCP/session/shell. Lazy loading remains essential while idle. Session-scoped AdmissionRuntime is intentionally recreated on transport rebuild; never describe stale-session transport recovery as Job/work-handle restoration. Preserve existing public `createMcpServer` export and registration names.

**Test-first concerns:** validate delegated `work_tool` name is recognized before/at lease acquisition, verify no subtool bypass of Work Handle or Workspace scope, assert lease release on thrown exceptions, rejected async callbacks, invalid input and Job stop/switch; examine whether a successful `toolResult` envelope with `ok:false` should be reflected in lease outcome logging without changing lease authority. Check read-only Job support root selection for default and custom jobs and ensure the caller's active job identity cannot be replaced mid-call. Do not automatically stop running child processes on lease release: lease identifies one call, not an independent process lifecycle.

**Tests:** `scripts/test-work-registration.mjs` verifies work handles, generation, lease counts and idle behavior; `scripts/test-post-review-round2-mapping.mjs` verifies operation routing, `scripts/test-work-gateway.mjs` verifies lazy gateway; full MCP coverage is in `run-all-tests.mjs`. None of these inspected scripts proves all cross-session and negative paths. Add direct wrapper tests for missing/wrong handle, concurrent sessions, Job switch/stop while a tool executes, workspace/support-root boundaries, delegated work_tool and lease count zero after failures.

**Provisional decision:** KEEP the GPTWorker-specific server factory and Tool Lease boundary. Only narrowly scoped bug fixes justified by tests; full greenfield rewrite would risk disrupting the core admission/authority model without a demonstrated benefit.

**User-approved final decisions after Reviews 08–10 (2026-09-23):**
- **`src/lib/path-security.ts`: KEEP architecture; approve targeted security hardening only.** Strengthen canonical path containment, symlink/junction and nonexistent descendant handling, correct Windows path-edge behavior and mutation-boundary verification, with real tests. Keep current exports, signatures, absolute path requirement, AsyncLocalStorage per-work scope, confirmed Workspace write authority and separate read-only active Job support roots. Do not claim this is an OS sandbox. Coordinate only directly necessary calls in the already approved patch/filesystem security group; do not rewrite unrelated modules.
- **`src/index.ts`: KEEP unchanged.** Error-handling, /health exposure and shutdown ideas from the review remain observations for tests only, not an authorization to refactor or change this file. If a severe defect is discovered, document it separately before proposing any change.
- **`src/server-factory.ts`: KEEP unchanged.** Retain existing Tool Lease and Work Handle gate, registration contracts, lazy gateway and session-scoped Job/admission boundaries. Tests may exercise this module, but no changes are approved here; any necessary serious defect fix requires a separately documented decision.

#### Review 11 — `src/lib/instruction-context.ts`

**Status: SOURCE REVIEW COMPLETE; runtime smoke tests pending. No code changes.** GPTWorker current blob `35386a596c852f155317cb70b4b6a41f811f29fc`. Compared current accessible upstream `hoangcoderr/chatgpt-local-coder/src/lib/instruction-context.ts` (do not assume exact original fork point). Current module is 62 lines and GPTWorker-specific slim control-plane startup context, not upstream's eagerly built project memory.

**Actual caller and responsibilities:** `src/index.ts` imports `buildInstructionContext`, `summarizeInstructionContext` and type `InstructionContext`. `buildInstructionContext(opts)` consumes startup Workspace root(s), PID and Node/platform environment, then calls `buildServerInstructions` in `src/lib/quickstart.ts`. The generated `instructionsText` is passed to MCP Session Manager and then Server Factory. `summarizeInstructionContext` populates HTTP `/health` telemetry.

**KEEP:** startup roots are configuration context, *not* admission or work authority. Module does not eagerly read project files, project-local instruction documents, skills or Git state while idle. Its current `contextText` and `instructionBytes` provide bounded startup description. Keep its exports and text contract. Updating help/content belongs in `quickstart.ts` if a separate product requirement emerges, not in an unnecessary new context builder.

**Provisional decision:** KEEP unchanged; no evidence of duplicate functionality worth removing or meaningful functionality warranting rewrite. Acceptance: startup instruction mode stays control-plane, no eager project reads and health summary remains compatible with `index.ts` and `scripts/run-all-tests.mjs`.

#### Review 12 — `start.ps1`

**Status: SOURCE REVIEW COMPLETE; Windows/PowerShell and Tray invocation acceptance pending. No code changes.** Current blob `3c62d904f0845750fb03d6e3b2d9c6713b33c561`. Compared accessible upstream script; GPTWorker has simplified prior interactive server/admin UI setup in favor of local Worker and Tray-driven detached launch.

**Confirmed callers and dependencies:** GPTWorker Tray (`gptworker-tray.ps1`) calls `start.ps1 -Port $WorkerPort -Detach` via its hidden PowerShell launch function. The script itself invokes Node `dist/index.js`, optionally `npm run build` when dist is missing or older than source/config inputs, reads `.env`, creates idle `worker-state.json` when absent and can create `.env` from `.env.example`. Manual operators use normal foreground startup and optional `-Force`; `openai-tunnel.ps1` instructs operators to run `start.ps1` when backend health fails. `scripts/test-idle-runtime.mjs` checks exact presence of the Detach/Node launch flow and Tray's invocation string.

**KEEP valuable behavior:** correct script-root anchoring, configurable port, rebuild-on-change, initial env and worker-state creation, foreground mode, detached Node startup, stderr/stdout files under local AppData, early exit diagnostics and collision handling. No redundant public script or substantial abandoned launcher branch is established from source/callers.

**Narrow security candidate for approval if user wants:** `-Force` currently kills whichever listener PID is found on the selected port without verifying it is a GPTWorker Node process started from the expected source directory. The non-Force branch also treats any listener as likely GPTWorker and exits 0. A process identity/executable/path or authenticated local health check before termination and proper foreign-port error would mitigate accidental termination, but owner verification must be robust on Windows; do not infer that a bare `/health` status 200 is strong PID identity. Preserve `-Detach`, build behavior and existing Tray interfaces if this focused fix is approved.

**Tests:** Windows PowerShell 5.1 launch, empty .env startup, fresh/stale build, foreign process occupying port with and without `-Force`, foreground run, detached run/early exit, Unicode/spaced source directories, Tray shutdown/restart compatibility. Current source inspection does not constitute executing those tests.

**Provisional decision:** KEEP script; do not rewrite, merge or remove branches. Treat optional `-Force` process ownership check as a separate tiny safety change requiring explicit approval.

#### Review 13 — `openai-tunnel.ps1`

**Status: SOURCE REVIEW COMPLETE; real Windows tunnel client/download/Doctor tests pending. No code changes.** Current blob `047d594c13cc55e6b7f7fbc68d98145bf982bfc3`. Accessible upstream version has older installer/setup flows and `codex-local` profile. GPTWorker actively uses a dedicated `gptworker` profile, v0.0.14 version pin, a two-stage setup wizard and detached runtime integration. Accessible upstream HEAD is not the known historical fork baseline.

**Confirmed callers and live features:** `gptworker-tray.ps1` launches `openai-tunnel.ps1 -Port $WorkerPort -Detach`; `setup-test.bat` uses `-Init -WizardPreview`; `scripts/test-idle-runtime.mjs` asserts ASCII-safe PowerShell 5.1 source, `-Detach`, stable GPTWorker profile, profile-file argument quoting, Tray call strings and setup guidance. Operator options include `-Init`, `-Doctor`, `-Force`, port/health port overrides, `-NoBrowser`, wizard parameters and foreground run. The script manages `.env` credentials, dedicated YAML profile, download/versioning of tunnel-client.exe, checks `/health` and tunnel `/readyz`, detects foreign PID on health port before stopping, exports credentials through environment for tunnel-client and supports detached logging.

**KEEP:** split setup/normal run/Doctor/preview modes are actual runtime or test surfaces; deletion solely to shorten the 637-line script risks breaking Tray and first-time onboarding. Pin tunnel client/profile identity and preserve ASCII-safe syntax for legacy Windows PowerShell. Do not merge this script with `start.ps1`; backend and tunnel have distinct lifecycles.

**Review/testing concerns:** verify downloaded ZIP/exe integrity and safe extraction when installing/upgrading, failure rollback if previously installed exe is removed before a failed download, source trust of binary, .env access permissions and secret-bearing errors/logs. Verify `-Force` never stops a non-tunnel process, health probe matches expected identity to the extent supported, and detach quoting works for source/profile paths containing spaces. These are test or optional narrowly scoped security-hardening ideas, not proven production failures. Support wizard and all options remain in scope; current tests largely assert required source strings rather than run a real tunnel.

**Provisional decision:** KEEP the existing tunnel script and all live modes. Only consider targeted security/reliability changes after Windows/live-client tests show a material issue; no full rewrite or low-value code pruning.

### Working sequence and completion rule — review all, plan once, implement by dependency group

**Do not finish or implement one file before reviewing the next.** Conduct the technical audit of **all 13 registered files first**, then consolidate a single implementation plan and task list before any rewrite/refactor/removal. The `patch.ts` assessment and proposed greenfield design are preliminary inputs to that shared plan, not an instruction to start coding immediately.

**Phase 1 — repository-wide review:** for every registered file, identify real callers and targets, dynamic Job/harness usage, required public interfaces, necessary vs unused functionality, inherited vs GPTWorker-specific logic, correctness/safety risks and alternative implementation options. Complete the audit register with evidence. Keep source-level review and actual runtime validation status distinct.

**Phase 2 — one integrated plan:** resolve overlap and dependencies across files; choose KEEP/SIMPLIFY/REFACTOR/GREENFIELD REWRITE/REMOVE for each with reasons. Partition changes into coherent dependency groups; identify affected files, ordering, stable filenames/exports/caller-visible contracts, expected intentional behavior changes, regression tests, Workspace-boundary tests and rollback/recovery steps. Write task list and acceptance gates **before coding**.

**Phase 3 — grouped implementation and verification:** implement one or more closely related files **together** in the same change batch when they share responsibility/callers or would otherwise require repeated edits. Rewrite in place by default: keep existing file paths and externally called function names/signatures/results, replace internals, do not add adapters unless technically necessary. Run relevant targeted tests for each batch, then full applicable build, `validate:jobs`, regression tests and CI. Perform real-file acceptance only in a disposable confirmed absolute Workspace, including rejection of outside/symlink/junction mutation. Fix failures inside the same batch before advancing.

**Suggested groups, provisional until all 13 reviews finish:** (A) patch + filesystem + path-security interactions; (B) tool-result + tool-annotations + activity-log and their callers; (C) MCP session + server-factory + index transport wiring; (D) instruction-context and associated callers; (E) shell and launcher/tunnel scripts. These are dependency *review clusters*, not automatic requirements to rewrite every file in a cluster. Revisit clustering after the caller maps are complete; avoid a broad concurrent rewrite of unrelated runtime subsystems.

**Completion:** a file may be closed as KEEP based on documented technical evidence and adequate existing tests; changes under SIMPLIFY/REFACTOR/GREENFIELD REWRITE/REMOVE close only after implementation, dependent caller migration and verified tests. Mark the complete audit closed only when every registered file has a recorded decision and every approved change batch meets its acceptance gates. Reconcile `LICENSE`/third-party notices against actual retained/distributed code during Packaging; historical credit and legally required notices remain distinct from implementation choices.

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

