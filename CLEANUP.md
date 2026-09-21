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
- [x] Quarantine unused root `.gptworker-driver-epoch`.
- [x] Retire standalone `stop.ps1`; tray/reset-runtime remains the supported stop/reset path.
- [x] Remove inert preload tokens `mcp`, `ponytail`, and `rewind` from runtime-family policy, Job runtime schema, and default Job configs.
- [ ] Run local TypeScript build.
- [ ] Run Job Pack validation.
- [ ] Run runtime acceptance for filesystem, shell/process, git, context, node_repl, and workspace-boundary behavior.
- [ ] Hard-delete quarantine only after active runtime validation passes.

## Compatibility that remains active

`src/lib/mcp-discover-compat.ts` is not dead legacy. It handles the real MCP `server/discover` probe/fallback needed by modern clients with the current stateful SDK/session implementation. Do not remove it unless the MCP/session transport is replaced and verified without it.

## Remaining provenance rewrite candidates

After dead compatibility cleanup, review only implementation that is still active. High-priority inherited areas include `src/tools/filesystem.ts`, `src/lib/patch.ts`, `src/tools/git.ts`, `src/lib/mcp-session-manager.ts`, `src/lib/checkpoint.ts`, and `src/tools/shell.ts` / `src/lib/persistent-shell.ts`.

Smaller active utilities such as audit/search/tool-result/tool-annotations should be reviewed only if they remain part of the final runtime.

Rewrite required behavior; do not rewrite dead code merely to make it look original.

## Packaging task

Before producing the final distributable, define an explicit artifact manifest. The shipped artifact should not include `scripts/test-*.mjs`, other test-only runners, `legacy/**` quarantine, `setup-test.bat`, or completed planning/cleanup artifacts that are not runtime/operator documentation.

Finalize the exact manifest when the distribution format (source package, npm package, or executable bundle) is frozen.
