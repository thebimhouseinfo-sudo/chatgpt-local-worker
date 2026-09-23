# Vercel agent-browser MCP — reviewed integration contract

**State:** B0 source audit complete for *candidate* upstream tag `v0.38.1`; **runtime/Windows smoke verification still pending**. Do not enable browser integration merely because this document exists. The actual installed release must match this contract, and the live `tools/list` schema must pass compatibility checks.

**Upstream evidence:** [v0.38.1 package.json](https://github.com/vercel-labs/agent-browser/blob/v0.38.1/package.json), [v0.38.1 README](https://github.com/vercel-labs/agent-browser/blob/v0.38.1/README.md), [v0.38.1 MCP implementation](https://github.com/vercel-labs/agent-browser/blob/v0.38.1/cli/src/mcp.rs). Source inspection only; no local browser binary or Windows smoke was executed in this audit.

## Candidate version and runtime compatibility

- Candidate package: `agent-browser@0.38.1` (official Vercel Labs).
- Package `engines.node`: **`>=24.0.0`**. GPTWorker's current repository CI uses **Node 22**, so **do not silently raise GPTWorker's minimum Node version**, ignore `engines`, or assume this upstream package works in the existing Node 22 runtime.
- Official upstream global-install flow: `npm install -g agent-browser`, then `agent-browser install` (Chrome for Testing), followed by `agent-browser doctor` for diagnostics. In GPTWorker's optional YES path, pin the audited candidate: `npm install -g agent-browser@0.38.1` only when the host Node version satisfies upstream's declared minimum. If not, set `UNAVAILABLE` and explain that Node 24+ is needed for this chosen release; the rest of GPTWorker must remain functional. Do not claim compatibility solely based on the README's distinction between from-source and native-binary requirements: the npm package metadata itself declares Node >=24.
- MCP entrypoint: `agent-browser mcp`; official default `core` tool profile. Use the official SDK outbound `Client` + `StdioClientTransport`; do not manually parse CLI output or repurpose GPTWorker's inbound HTTP `mcp-session-manager.ts`.
- **No floating upgrades:** Re-audit upstream exact version and schemas before a bump, when compatibility fails, and quarterly. A changed or unhealthy binary is `UNAVAILABLE`; browser tools become undiscoverable in a fresh MCP session and stale calls are blocked.

## Verified tool names in upstream Rust MCP core

| GPTWorker operation | Upstream MCP tool | Required v1 input |
| --- | --- | --- |
| browser_open | `agent_browser_open` | optional URL; GPTWorker imposes approved-origin policy |
| browser_snapshot | `agent_browser_snapshot` | validated optional snapshot params |
| browser_click | `agent_browser_click` | selector |
| browser_fill | `agent_browser_fill` | selector, text |
| browser_press | `agent_browser_press` | key |
| browser_wait | `agent_browser_wait_for_selector` | selector |
| browser_screenshot | `agent_browser_screenshot` | adapter-owned absolute Workspace path; optional safe selector/fullPage/format |
| browser_get_url | `agent_browser_get_url` | none |
| browser_close | `agent_browser_close` | only current execution-owned session |

The upstream schema adds shared fields including `session`, `allowedDomains`, `extraArgs` and other profile-specific options. **Never forward arbitrary upstream arguments.** Map only strict validated v1 fields, set execution-derived `session` and approved `allowedDomains` within the adapter, and reject model-supplied `extraArgs`, `eval`, external browser/profile attachment and `--tools all`. The core profile includes `agent_browser_eval`, so selecting `core` alone is **not a security boundary**.

Upstream MCP discovery is paginated. The adapter must use the SDK's supported pagination flow to check the verified v1 tool names/schemas at startup and fail closed if any required tool changes or disappears. Screenshot is unusual: Rust implementation returns saved path and may also return small PNG/JPEG **image MCP content**. Preserve typed text/image blocks and `isError`; cap bytes, redact activity logs and constrain paths before upstream calls.

## Confirmed GPTWorker integration points

| File | Current role / change |
| --- | --- |
| `src/lib/runtime-families.ts` | Today `filesystem`, `shell`, `context`; browser must remain outside unconditional Job preloads. |
| `src/tools/work-gateway.ts` | `work_tool` registers static `z.enum(WORK_TOOL_OPERATIONS)`; convert **per-MCP-server registration** to capability-aware enum. Off/unhealthy browser names must not appear inside the advertised enum. |
| `src/lib/tool-work-policy.ts` | Add browser family routing and dev-coding-only operation policy; check every call, not only discovery. |
| `src/server-factory.ts` | Reuse confirmed work handle, lease and Workspace binding; integrate current capability check and schema refresh strategy; avoid touching non-browser behavior. |
| `src/lib/work-registration.ts` | Existing execution IDs, leases and work stop/expiry; browser sessions must be owned by execution and canceled on revocation. |
| `src/lib/mcp-session-manager.ts` | Handles inbound ChatGPT→GPTWorker HTTP MCP; **do not modify/repurpose** for outbound Vercel MCP stdio. |
| `setup.bat` | Optional explicit YES/NO, pinned upstream official installation/doctor and separate choice/health states; defaults NO; installation failures must not break unrelated Worker setup. |
| `jobs/dev-coding` | Browser QA only when task's acceptance needs it; missing required check = `UNAVAILABLE`, never fake PASS. |

**Registration must remain lazy:** no subprocess on Worker startup, Job discovery, or Job activation. Only first authorized work-tool browser call creates an upstream MCP child; `job_stop`, expiration and Worker shutdown must revoke sessions and clean up only owned children. On explicit NO, even if `agent-browser` happens to be installed globally, **zero browser operation names** may appear in fresh MCP `tools/list`. Recheck policy to reject stale cached tool calls.

**B0 blocking checks before declaring implementation DONE:** verify pinned npm install and `doctor` on an actual Windows host with Node >=24; run a genuine MCP stdio initialize and paginated list for v1; confirm image/text behavior, session isolation and process cleanup. If any result differs, revise the contract *before* B2/B3 implementation, or leave feature OFF/UNAVAILABLE.

**Internal compatibility testing:** mock MCP handshake, schema drift, pagination, denied eval/extraArgs, typed screenshot, child timeout/crash; real Chromium test is explicitly opt-in. Do not mark B0/B5 full PASS based solely on reading source.
