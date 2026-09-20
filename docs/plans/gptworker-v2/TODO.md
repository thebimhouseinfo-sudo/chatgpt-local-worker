# GPTWorker v2 — Backlog

## Active Backlog

- [ ] Implement deterministic WorkspaceKey: readable slug + stable hash of canonical absolute path.
- [ ] Implement WorkRegistrationStore and readable ExecutionId.
- [ ] Implement WorkspaceOwnershipRegistry with WORKSPACE_BUSY.
- [ ] Return NO_ACTIVE_WORK for missing/stale registration; never fallback to previous/global context.
- [ ] Bind confirmation to Job + Workspace + generation + pack revision.
- [ ] Remove global cwd/project-context authority from execution paths.
- [ ] Define core Tool Families and map current tools into them.
- [ ] Implement on-demand ephemeral tool instances; no fixed pool/inventory.
- [ ] Implement immutable ToolContext and ActiveToolLeaseRegistry.
- [ ] Define lifecycle for stateful resources: shell process, REPL, upstream/external session.
- [ ] Add multi-execution stress tests using same Tool Family across different workspaces.
- [ ] Split Driver protocol gateway from Worker executor.
- [ ] Implement quiescence-based Worker sleep; do not use inactivity timeout to end active registration.
- [ ] Move mutable Job Packs to %LOCALAPPDATA%\GPTWorker\jobs.
- [ ] Replace repo-relative harness imports with portable runner/API.
- [ ] Implement immutable pack snapshots and publish transaction.
- [ ] Implement Job Authoring workflow.
- [ ] Add Windows logon supervision and clean-machine release acceptance.
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
- [ ] Windows Service; release-first host is user-logon background process.
- [ ] Full YAML parser; initial v2 keeps JSON-compatible YAML.
- [ ] Public rollback/remove/enable/disable commands.
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
- Treating human-readable execution IDs as credentials.
