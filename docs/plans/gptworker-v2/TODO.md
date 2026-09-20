# GPTWorker v2 — Backlog

## Active Backlog

- [ ] Repo-local Job lifecycle is the current authority: `job list / create / update / remove`. Do not migrate to AppData or package EXE before this live test passes.
- [ ] Complete P1A live lease pilot in [WORK_TOOL_LEASE_PILOT.md](WORK_TOOL_LEASE_PILOT.md): 2 chats, 2 workspaces, interleaved filesystem calls, no handle swap, no token leak.
- [ ] Implement deterministic WorkspaceKey: readable slug + stable hash of canonical absolute path.
- [ ] Implement WorkRegistrationStore, persistent monotonic DriverEpoch, readable ExecutionId and opaque authorityToken.
- [ ] Prove live ChatGPT handle continuity: one chat >=5 calls; two chats interleaved without handle swap.
- [ ] Ensure stop/re-register and Driver restart never reuse the same execution identity.
- [ ] Implement WorkspaceOwnershipRegistry with WORKSPACE_BUSY.
- [ ] Implement explicit confirmed re-register/replace for orphaned/lost-handle workspace ownership; never auto-attach.
- [ ] Return NO_ACTIVE_WORK for missing/stale registration; never fallback to previous/global context.
- [ ] Bind confirmation to Job + Workspace + driver epoch + generation + pack revision.
- [ ] Remove global cwd/project-context authority from execution paths.
- [ ] Define core Tool Families and map current tools into them.
- [ ] Implement on-demand ephemeral tool instances; no fixed pool/inventory.
- [ ] Implement immutable ToolContext and ActiveToolLeaseRegistry; include driver epoch in tool identity.
- [ ] Define lifecycle for stateful resources: shell process, REPL, upstream/external session.
- [ ] Add multi-execution stress tests using same Tool Family across different workspaces.
- [ ] OPTIONAL: split Driver protocol gateway from Worker executor only if monolithic/manual launch proves insufficient.
- [ ] Implement quiescence-based Worker sleep; do not use inactivity timeout to end active registration.
- [ ] AFTER V2 FINALIZE: trial moving mutable Job Packs to %LOCALAPPDATA%\GPTWorker\jobs.
- [ ] Replace repo-relative harness imports with portable runner/API.
- [ ] Implement immutable pack snapshots and publish transaction.
- [ ] Live-test repo-local Job authoring: create → list → update → remove through ChatGPT.
- [ ] AFTER AppData trial: decide whether Windows logon supervision is useful; manual launch is acceptable.
- [ ] Define retention for history/cache/checkpoints/transaction journals; this must not expire ACTIVE WorkRegistration.

## Explicitly Rejected / Removed

- [x] MCP transport session as chat/work identity.
- [x] Auto-attach to most recent Job/workspace.
- [x] Machine-global active Job/cwd as execution authority.
- [x] Inactivity timeout as normal Job lifecycle.
- [x] Fixed Tool Pool with N pre-created/free instances.
- [x] Per-Job duplicate read/write/shell/git implementations.
- [x] Family-level queue merely because two Jobs call the same capability.
- [x] General file-level lock for independent Jobs in different workspaces.
- [x] Duplicate on-disk Job registry in addition to job.yaml.

## Deferred

- [ ] Resume active WorkRegistration after Driver restart/reboot.
- [ ] Concurrent independent executions against the same canonical workspace.
- [ ] Driver/Windows Service unless manual launch becomes insufficient.
- [ ] Full YAML parser; initial v2 keeps JSON-compatible YAML.
- [ ] Public rollback/enable/disable commands. `job remove` is now part of the core public lifecycle.
- [ ] Job marketplace/dependency auto-download.
- [ ] OS-enforced sandbox for untrusted packs.
- [ ] Multi-machine work session.

## Optional / Future

- [ ] Global CPU/RAM/process pressure controller if real workloads need throttling. It must not become a per-family arbitrary instance count.
- [ ] Detach long-running managed processes into a dedicated lifecycle owner if needed for deeper Worker sleep.
- [ ] Signed releases and distribution hardening if project scope expands beyond trusted personal/local use.

## Out of Scope

- Changing HVAC/MTO business rules.
- Reading ChatGPT internal databases to infer conversation identity.
- Sharing one active workspace among unrelated executions in v2 release.
- Treating human-readable execution IDs as credentials; authority is the separate opaque token.
