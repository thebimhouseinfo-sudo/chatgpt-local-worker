# GPTWorker v2 — Backlog

## Active Backlog

- [ ] Live-test Job routing: repo defaults + AppData custom Jobs; create/update/remove custom without mutating defaults; clone a default into a new custom id.
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
- [ ] Complete 10-minute WorkRegistration auto-stop: no timeout during active foreground lease; stop releases workspace ownership and all owned stateful resources.
- [ ] Verify custom Job Packs persist in %LOCALAPPDATA%\GPTWorker\jobs across restart and repo updates.
- [ ] Replace repo-relative harness imports with portable runner/API.
- [ ] Implement immutable pack snapshots and publish transaction.
- [ ] Live-test AppData custom Job authoring: create → list → update → remove through ChatGPT.
- [ ] Implement per-user Windows logon auto-start for a single-instance GPTWorker resident host; normal daily use must not require run.bat.
- [ ] Add system-tray icon with minimal menu: status, Open setup guide, Restart GPTWorker, Exit GPTWorker.
- [ ] Make normal resident startup hidden: no launcher/console window in everyday use.
- [ ] Enforce thin idle contract: event-driven resident host+tunnel only; no shell/REPL/tool pool/managed execution process or active Job kept solely for readiness.
- [ ] Wake execution resources on real MCP work and return to quiescent state after calls/resources drain.
- [ ] Verify tray Exit stops GPTWorker-owned host+tunnel/execution children only; never unrelated user apps.
- [ ] Keep run.bat as source-build fallback/manual recovery until packaging.
- [ ] Run final live Windows source acceptance for auto-start/tray/idle/wake/restart/Exit and multi-workspace isolation.
- [ ] BLOCK packaging until the final live source acceptance passes and the user explicitly approves packaging.
- [ ] Define retention for history/cache/checkpoints/transaction journals; this must not expire ACTIVE WorkRegistration.

## Explicitly Rejected / Removed

- [x] MCP transport session as chat/work identity.
- [x] Auto-attach to most recent Job/workspace.
- [x] Machine-global active Job/cwd as execution authority.
- [x] Fixed Tool Pool with N pre-created/free instances.
- [x] Per-Job duplicate read/write/shell/git implementations.
- [x] Family-level queue merely because two Jobs call the same capability.
- [x] General file-level lock for independent Jobs in different workspaces.
- [x] Duplicate on-disk Job registry in addition to job.yaml.

## Deferred

- [ ] Resume active WorkRegistration after Driver restart/reboot.
- [ ] Concurrent independent executions against the same canonical workspace.
- [ ] Windows Service; not required for the target desktop UX because per-user logon auto-start + tray is authoritative.
- [ ] Physical Driver/Executor process split unless thin-idle measurements prove it necessary.
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
