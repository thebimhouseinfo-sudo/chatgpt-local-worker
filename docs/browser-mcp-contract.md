# Browser MCP compatibility contract

**Pinned upstream:** Vercel `vercel-labs/agent-browser` **v0.38.1** (published 2026-09-16).  
**Upstream source:** https://github.com/vercel-labs/agent-browser/blob/v0.38.1/cli/src/mcp.rs  
**Upstream release:** https://github.com/vercel-labs/agent-browser/releases/tag/v0.38.1  
**Contract status:** Source-level verified for command, tool names and core profile; actual Windows installed-binary `tools/list`/schemas and Chrome launch must be verified before enabling B1/B2. Do not mark runtime verified based solely on reading code.

## Installation and execution

The official documented global installation flow is:

```powershell
npm install -g agent-browser@0.38.1
agent-browser install
agent-browser doctor
```

Production `setup.bat` must invoke the **exact pinned version**, not an unreviewed `latest`. User YES/NO consent must remain independent of installed health; NO must not install even if the binary is in PATH. `agent-browser mcp` starts the official outbound stdio server; the v1 adapter must reuse GPTWorker's `@modelcontextprotocol/sdk` `Client` and `StdioClientTransport`, not launch a replacement MCP server. Official upstream README identifies `npm install -g agent-browser` / `agent-browser install` and the `doctor` command; Node 24+ is required **to build from source**, not claimed as a requirement for the global native binary. Test compatibility with GPTWorker's Node 22 Windows CI before completing B0.

## Source-verified v1 allowlist

At tag v0.38.1, `cli/src/mcp.rs` defines the following constants and includes all of them in `CORE_PROFILE_TOOLS`:

| GPTWorker operation | MCP tool |
| --- | --- |
| browser_open | agent_browser_open |
| browser_snapshot | agent_browser_snapshot |
| browser_click | agent_browser_click |
| browser_fill | agent_browser_fill |
| browser_press | agent_browser_press |
| browser_wait | agent_browser_wait_for_selector |
| browser_screenshot | agent_browser_screenshot |
| browser_get_url | agent_browser_get_url |
| browser_close | agent_browser_close |

The upstream `core` profile **also includes JavaScript `agent_browser_eval`**. Restrict discoverable operations and allowed calls at BOTH work gateway and adapter. Never expose `--tools all`, generic passthrough or user-supplied `extraArgs`.

Freeze the exact runtime-returned input schemas after running v0.38.1's `agent-browser mcp` and `tools/list` in the target Windows environment. The adapter must reject mismatches rather than forward unknown fields. Screenshot text/image output modes, max size, upstream session isolation and `allowedDomains` options must likewise be confirmed in a live fixture before marking B0 fully DONE.

## Non-negotiable integration gates

- **Browser disabled/unhealthy:** no browser operation in the **actual advertised `work_tool` enum in MCP `tools/list`**; no browser child process; stale calls denied. A static global operation enum is insufficient.
- **Browser READY/ACTIVE:** first authorized browser call only launches the upstream stdio process. Only an active confirmed `dev-coding` Job may invoke it. Every call rechecks work handle/lease, capability, session ownership, strict tool arguments and allowed origin.
- On `job_stop`, Job switch, expiry or shutdown, cancel calls, close execution-scoped browser session and release adapter-owned children. No personal Chrome profile or default session reuse.
- Browser screenshots/evidence: absolute, validated Workspace-local paths; preserve typed MCP image blocks outside ordinary logs and bind evidence to SHA-256 input-manifest fingerprint.

## Version maintenance

Owner: the implementer maintaining the GPTWorker browser adapter and its compatibility tests. Re-audit on intentional upstream version bump, any tool/schema/doctor mismatch, and once each calendar quarter. Do not run unattended `agent-browser upgrade`; incompatible releases set capability `UNAVAILABLE` and remove browser tools from fresh discovery until revalidated. Keep the last tested pin available for safe manual rollback of the optional installation. Deterministic mock MCP schema tests are mandatory on CI; live Chromium smoke is opt-in.

## B0 open verification gates

- [x] Record exact release tag/date and authoritative source.
- [x] Confirm upstream `agent-browser mcp` entrypoint and v1 tool names/core inclusion by reviewing pinned Rust MCP source.
- [x] Confirm core includes eval; adapter must maintain explicit allowlist.
- [ ] Run actual pinned `tools/list` on Windows; capture exact schema of all nine v1 operations.
- [ ] Confirm screenshot typed output, `allowedDomains` and isolated session behavior with running upstream.
- [ ] Confirm Node 22 global installation, `doctor` diagnostics and Chrome launch on Windows.
- [ ] Add deterministic pinned-protocol fixture and fail-closed mismatch test.

B1/B2 must not be marked complete until the unchecked B0 contract tests pass. Browser remains disabled by default.
