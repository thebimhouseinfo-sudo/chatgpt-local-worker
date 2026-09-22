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
- [x] Run local TypeScript build.
- [x] Run Job Pack validation.
- [x] Run runtime acceptance for filesystem, shell/process, context, node_repl, and workspace-boundary behavior; Git CLI is optional and exercised through shell when installed.
- [x] Remove quarantine after active runtime validation passed.

## Compatibility that remains active

`src/lib/mcp-discover-compat.ts` is not dead legacy. It handles the real MCP `server/discover` probe/fallback needed by modern clients with the current stateful SDK/session implementation. Do not remove it unless the MCP/session transport is replaced and verified without it.

## Remaining provenance rewrite candidates

After dead compatibility cleanup, review only implementation that is still active. High-priority inherited areas include `src/tools/filesystem.ts`, `src/lib/patch.ts`, `src/lib/mcp-session-manager.ts`, `src/lib/checkpoint.ts`, and `src/tools/shell.ts` / `src/lib/persistent-shell.ts`. The dedicated Git wrapper family has been retired because it only delegated to the machine's external `git` executable; Git remains available through shell when installed.

Smaller active utilities such as audit/search/tool-result/tool-annotations should be reviewed only if they remain part of the final runtime.

Rewrite required behavior; do not rewrite dead code merely to make it look original.

## Packaging task

Before producing the final distributable, define an explicit artifact manifest. The shipped artifact should not include `scripts/test-*.mjs`, other test-only runners, `legacy/**` quarantine, `setup-test.bat`, or completed planning/cleanup artifacts that are not runtime/operator documentation.

Finalize the exact manifest when the distribution format (source package, npm package, or executable bundle) is frozen.


## Cleanup closure

Validation completed successfully, including build, Job Pack validation, the default test suite, the full runtime acceptance sequence, and public command routing. The previously failing `gr/job stop` route was fixed and confirmed working.

The temporary quarantine has been removed. The quarantine-only regression checks are no longer part of the default test runner because the quarantine they guarded no longer exists.

Dead compatibility cleanup is closed. Any next step is provenance rewrite of still-active implementation, not dead-code cleanup.

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

