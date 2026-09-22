# AI-Native Browser — Draft Implementation Plan

Status: **Draft v0.3**

Related: [AI-Native Browser MVP](./ai-native-browser-mvp.md)

## 1. Implementation strategy

The base repo already provides most of the hard browser-agent machinery.

Primary base:

> **vercel-labs/agent-browser**

Therefore implementation should remain short and additive:

> **Keep the base repo intact. Add only the product features we need. Replace an existing subsystem only after a reproducible failing test proves it is necessary.**

Do not rebuild MCP, semantic snapshot, stable refs, screenshot, tab control, session handling, iframe support, context-reduction logic, or remove unrelated base features simply because the MVP does not currently use them.

## 2. Target product

Ship one independent browser application:

```text
AI-Browser.exe
  ├─ existing agent-browser runtime
  ├─ existing MCP control surface
  ├─ minimal human browser shell
  ├─ persistent user profile/session
  ├─ sensitive-data firewall
  └─ optional AI sidebar
```

Gptworker remains separate and connects to the browser through MCP.

## 3. Base repo policy

### KEEP by default

Keep the existing implementation when acceptance tests pass:

- MCP server
- accessibility/semantic snapshot
- stable element refs
- semantic actions
- screenshot
- annotated screenshot
- multi-tab
- session/profile support
- iframe handling
- snapshot filtering/compaction
- delta/context reduction
- existing browser-control primitives

### DO NOT strip by default

The MVP should not spend effort deleting working base-repo capabilities that are not currently needed.

Keep them unless they:

- directly conflict with the standalone browser product;
- create a security/privacy problem;
- break packaging or runtime behavior;
- materially increase maintenance or release risk;
- fail an acceptance test in a way that requires replacement.

Unused but harmless functionality may remain in the codebase.

The goal is to minimize modification surface, not to minimize line count.

### ADD

Only the missing product layers:

- standalone browser packaging/window shell
- minimal human UI
- sensitive-data firewall
- profile/session UX
- sidebar connection UI
- Gptworker integration
- local-AI connector path
- health/version metadata
- focused regression tests

## 4. Phase 0 — Baseline before modification

Before changing the base:

1. freeze an exact upstream commit;
2. run it unchanged;
3. record its existing MCP tools;
4. test semantic snapshot and stable refs;
5. test screenshots and annotated screenshots;
6. test tabs;
7. test profile/session persistence;
8. test iframe-heavy pages;
9. test a TradingView-like workflow;
10. record every failure before deciding to replace any subsystem.

Output:

```text
BASELINE.md
- upstream commit
- passed capabilities
- failed capabilities
- known limitations
```

A module that passes its required tests stays unchanged.

## 5. Phase 1 — Add standalone browser shell

Package the existing base runtime as an independent browser application without removing unrelated working capabilities.

Minimum human UI:

- address bar
- back/forward/reload
- tabs
- web viewport
- profile selection if needed
- optional sidebar toggle

Do not build Chrome-class convenience features.

Acceptance:

- executable launches independently;
- normal browsing works;
- multi-tab works;
- a human can log into a website;
- closing/reopening the browser preserves the intended profile/session.

## 6. Phase 2 — Native MCP validation

Prefer the MCP already exposed by the base.

Do not build a new Browser MCP unless the existing MCP fundamentally cannot satisfy the product.

Validate that an external MCP client can:

- observe current tab;
- click by stable ref;
- type/fill;
- scroll;
- select;
- switch tabs;
- open URL;
- request screenshot;
- complete observe -> act -> verify.

If a naming/schema compatibility layer is needed, make it thin.

## 7. Phase 3 — Sensitive-data firewall

This is the main product-specific security work and should be treated as a release gate.

### 7.1 Security goal

AI may control normal website UI, but must not receive user secrets.

Protected categories include at minimum:

- passwords
- PINs
- CVV/CVC/security codes
- OTP/payment authentication codes
- recovery codes
- secret answers where identifiable
- raw cookies
- auth/session tokens
- stored browser credentials
- raw browser profile databases

The user performs sensitive authentication/payment entry manually.

The browser may preserve the resulting authenticated session, but the secret used to create that session must remain unavailable to the AI.

### 7.2 Firewall position

Sanitization must occur **inside the browser boundary before MCP output is produced**.

```text
Web page / Chromium state
        |
        v
Observation engine
        |
        v
Sensitive-data firewall
        |
        v
MCP response
        |
        v
AI
```

Never rely on the AI to ignore a secret after receiving it.

### 7.3 Deterministic sensitive-field detection

Start with deterministic browser/HTML signals, not LLM classification.

High-confidence protected signals:

- `input[type="password"]`
- autocomplete values such as:
  - `current-password`
  - `new-password`
  - `one-time-code`
  - payment/card security-code hints where available
- form labels/names/ARIA labels matching high-confidence patterns such as:
  - password
  - passcode
  - PIN
  - CVV
  - CVC
  - security code
  - verification code
  - recovery code
- payment-provider secure iframes/known protected input roles where detectable

The classifier should prefer false positives over exposing a secret.

### 7.4 Semantic-output redaction

For protected elements, never return the current value.

Example:

```text
@e19 textbox "Password" [PROTECTED]
@e20 textbox "CVV" [PROTECTED]
```

Do not return:

- value
- DOM property containing the value
- form-state serialization containing the value
- accessibility value if it contains the secret
- event-log payload containing the secret

### 7.5 AI action restrictions on protected fields

MVP default:

- AI may identify that a protected field exists;
- AI may not read its value;
- AI should not fill/type secrets into protected fields;
- AI should not invoke password-manager/autofill operations;
- AI should not clear or replace protected credentials unless a future explicit policy adds this.

If a workflow reaches a protected entry step, return a structured state such as:

```text
USER_ACTION_REQUIRED: sensitive_input
```

The human completes the sensitive step manually, then the AI resumes after the authenticated/payment state changes.

### 7.6 Screenshot protection

Semantic redaction alone is insufficient because a page may visually render sensitive information.

Before returning a screenshot through MCP:

1. detect known protected input bounds;
2. mask those regions in the returned AI screenshot;
3. also mask browser-owned password/autofill popups if visible;
4. mask known payment security-code fields;
5. never expose browser credential-manager UI through screenshots.

The human-facing browser window remains unmodified. Only the screenshot returned to the AI is sanitized.

If the browser cannot confidently sanitize a sensitive page, prefer:

```text
SCREENSHOT_BLOCKED: sensitive_content
```

over returning an unsafe image.

### 7.7 Raw backend access restrictions

Do not expose public MCP tools for:

- raw cookies
- auth headers
- bearer tokens
- localStorage/sessionStorage dumps
- IndexedDB dumps
- browser password store
- credential manager
- raw profile directory
- arbitrary JavaScript evaluate
- unrestricted CDP
- network request/response bodies containing auth data

Internal runtime code may use these facilities when required, but they are not part of the agent-facing MCP surface.

### 7.8 Clipboard protection

Do not expose unrestricted clipboard-read tools to AI in MVP.

If browser interaction requires paste, prefer writing known AI-provided text into a target element rather than giving AI general clipboard access.

### 7.9 Logging and diagnostics

Logs must pass through the same secret policy.

Never write protected values into:

- MCP request/response logs
- debug logs
- action traces
- crash reports
- screenshots
- test fixtures

Where a value must be referenced, use:

```text
[REDACTED]
```

### 7.10 Session persistence

The browser may persist:

- cookies
- authenticated session state
- site storage needed to remain logged in

But MCP must never expose raw persisted session material.

Expected flow:

```text
Human enters password/CVV/OTP
        |
        v
Website/browser creates authenticated state
        |
        v
Browser stores permitted session state
        |
        v
AI resumes normal UI operation
```

### 7.11 Security regression tests

Security tests are mandatory before authenticated-site acceptance.

Required tests:

1. password value never appears in `observe`;
2. CVV/CVC never appears in `observe`;
3. OTP field value never appears in `observe`;
4. protected input is masked in MCP screenshot;
5. browser credential/autofill UI is not exposed;
6. raw cookie/token tools are absent;
7. arbitrary JS/CDP cannot be used through MCP to bypass redaction;
8. logs contain no entered secret;
9. profile restart preserves authenticated session;
10. after restart, AI can operate the authenticated site without learning the credential;
11. stale/hidden protected fields remain redacted;
12. iframe-hosted payment/auth fields remain protected.

Security failure blocks MVP release.

## 8. Phase 4 — Docked AI sidebar

The browser should provide a **docked sidebar inside the main browser window**, similar in UX to the Copilot/ChatGPT sidebar in Edge.

This is not a separate dashboard tab and not a second application.

Primary UX goal:

> **One browser window should be enough for browsing, AI conversation, and agent control.**

Expected layout:

```text
+--------------------------------------+------------------+
| Tabs / address bar                   |                  |
+--------------------------------------+   AI Sidebar     |
|                                      |                  |
|                                      |  connector       |
|          Browser viewport            |  conversation    |
|                                      |  task/activity   |
|                                      |  input           |
|                                      |                  |
+--------------------------------------+------------------+
```

Required behavior:

- sidebar is docked to the browser chrome, normally on the right;
- opening the sidebar shrinks the web viewport rather than covering it;
- sidebar can be opened/closed from browser UI;
- sidebar width should be resizable;
- switching web tabs does not destroy the sidebar conversation/session;
- the sidebar stays available while the agent operates the active tab;
- sidebar has its own header/status area and message/input area;
- current connector/provider status is visible.

### 8.1 ChatGPT UX

With ChatGPT, the sidebar avoids forcing the user to switch between a work tab and a separate ChatGPT tab/app.

Expected flow:

```text
Current website remains open
        |
        +-- right sidebar: ChatGPT conversation
        |
        v
User gives task
        |
        v
Gptworker bridges tool calls
        |
        v
Browser MCP operates current tab
        |
        v
Result returns to the same sidebar conversation
```

The official ChatGPT connector is Gptworker.

### 8.2 Local AI UX

With a local model, the sidebar should remove the need to install or operate a separate chat Web UI or control the model through a CLI for normal use.

Expected flow:

```text
Browser sidebar
   |
   v
Local AI connector
   |
   v
Local model/agent runtime
   |
   | Browser MCP
   v
Current browser tab
```

The user may still use external local-model software for model hosting, but the browser should provide the normal conversation/control UI.

### 8.3 Sidebar scope

Keep the sidebar intentionally simple.

For both ChatGPT and local AI, the sidebar is primarily a **conversation surface**:

- render chat/messages;
- show current task/activity;
- show tool/action log or concise execution history;
- show connection status;
- allow basic reconnect/disconnect controls;
- preserve conversation history while switching browser tabs.

Do not turn the sidebar into a full configuration console.

For web-login providers such as ChatGPT, this can remain especially lightweight because provider authentication and account UX are handled by the provider/Gptworker path.

### 8.4 Local AI admin/config page

Local AI needs more configuration than the sidebar should carry.

Provide a separate browser-owned **Admin / Settings page** for local-AI setup.

Suggested internal route:

```text
browser://settings/ai
```

or equivalent.

The admin page may contain:

- local connector enable/disable;
- provider/runtime type;
- local endpoint/port;
- model selection;
- connection test;
- timeout/retry settings;
- optional context/tool limits;
- startup/autoconnect preference;
- connector logs/diagnostics;
- reset/reconnect controls.

The sidebar should read the resulting connector state but should not duplicate these advanced settings.

Expected split:

```text
Sidebar
  = chat + task/activity + history + status

Admin page
  = connector/model/runtime configuration
```

This keeps the primary browser experience clean while still supporting more complex local setups.

### 8.5 Connector states

At minimum the sidebar should support these states:

```text
ChatGPT
Connected via Gptworker

Local AI
Connected via local connector

No AI connected
Choose connector
```

Third-party providers may add their own connectors later.

### 8.6 Reuse strategy for sidebar UI

The base repository's existing dashboard/chat UI may be reused for components, styles, activity display, connection indicators, or conversation UI where useful.

However, the final product UX is a **native docked browser sidebar**, not a separate dashboard page.

Do not rewrite existing dashboard components if they can be embedded or adapted cleanly.

### 8.7 Control-path rule

The sidebar is a human-facing UI only.

It must not create a second privileged path into browser internals.

All agent browser control follows:

```text
Sidebar / AI session
        |
        v
Connector
        |
        v
Browser MCP
        |
        v
Browser control surface
```

Never:

```text
Sidebar
   |
   +--> private browser internal API
```

This ensures the same MCP behavior, security firewall, auditability, and tool semantics apply whether the browser is controlled from the sidebar, Gptworker, local AI, or another future connector.

## 9. Phase 5 — Gptworker integration

Gptworker is the official ChatGPT connector.

Gptworker work should stay small:

- discover/configure AI-Browser MCP;
- connect through the existing tunnel;
- expose retained browser tools to ChatGPT Web;
- health/version check;
- optional launch of AI-Browser using an absolute configured path.

Do not copy browser runtime code into Gptworker.

Do not make browser releases depend on Gptworker releases.

## 10. Phase 6 — Local AI connection

Provide or document a thin connector that allows a local agent runtime to use the same MCP tools.

Only one local runtime needs to pass MVP acceptance.

Provider-specific logic remains outside browser core.

## 11. Acceptance workflows

### A. Local UI development

```text
AI edits code
-> runs local app
-> browser opens localhost
-> snapshot
-> interact
-> screenshot if needed
-> verify
```

### B. TradingView-like workflow

```text
snapshot
-> select symbol
-> select timeframe
-> open Pine Editor
-> open Strategy Tester
-> read semantic UI
-> screenshot chart
-> verify visual result
```

If the existing base handles this reliably, do not replace its observation/action engine.

### C. Authenticated website

```text
Human logs in manually
-> protected fields never reach MCP
-> browser retains session
-> restart browser
-> AI resumes authenticated operation
```

### D. Payment-sensitive page

```text
AI reaches payment/auth step
-> protected fields detected
-> USER_ACTION_REQUIRED
-> human enters sensitive values
-> AI screenshot is masked/blocked as necessary
-> AI resumes after payment/auth state changes
```

## 12. Scope-control rules

1. Do not delete working base-repo functionality merely because the MVP does not use it yet.
2. Do not rewrite an existing subsystem because another repo appears better.
3. Replace only after a reproducible failing acceptance test.
4. Prefer additive integration over invasive refactoring.
5. Prefer upstream fixes before local forks when practical.
6. Security redaction is an exception: it is product-specific and must be enforced even if the base does not provide it.
7. Keep Gptworker outside browser core.
8. Keep provider-specific logic outside browser core.
9. Do not add IDE/file-explorer/terminal features.
10. Do not add new consumer-browser features without an actual browser requirement.

## 13. MVP exit criteria

MVP is ready when:

- standalone browser executable works;
- retained base MCP works end-to-end;
- semantic refs and screenshot meet real workflows;
- multi-tab/session persistence work;
- TradingView-like workflow passes;
- ChatGPT via Gptworker can control it;
- one local-AI path can control it;
- sensitive-data firewall passes every security regression test;
- no major browser-control subsystem was rewritten without evidence that the base failed.

## 14. Final implementation rule

> **Keep the base repo as intact as practical. Add the missing browser shell, sidebar/admin UX, connectors, and hard security boundary. Avoid cleanup/refactoring that does not directly serve the MVP.**
