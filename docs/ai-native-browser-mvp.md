# AI-Native Browser — MVP

Status: **Draft v0.3**

## 1. Product thesis

> **Not a browser with AI added to it, but a browser built to be operated by AI.**

AI-Native Browser is a lightweight Chromium-based browser designed primarily for AI agents.

Humans can still browse, log in, switch tabs, inspect results, and intervene manually, but human convenience is secondary. The primary requirement is that an AI agent can understand and operate the current browser UI directly through an MCP-native control surface.

This project exists because mainstream browsers are designed for humans first. AI usually needs extensions, external automation layers, CDP/Playwright wrappers, or computer-use with screenshot + mouse emulation. AI-Native Browser instead makes agent control a first-class capability of the browser itself.

## 2. Key implementation discovery

The MVP should **not rebuild the agent-control layer from scratch**.

The current preferred foundation is:

> **vercel-labs/agent-browser**

It already provides most of the control capabilities required by this MVP, including:

- MCP server
- accessibility/semantic snapshots
- stable element references
- semantic interaction
- screenshot support
- annotated screenshots
- multi-tab support
- session/profile support
- iframe handling
- compact/filtered snapshots
- delta-style snapshot/context reduction

Therefore the implementation rule is now:

> **Keep first. Replace only after a concrete failing test.**

Do not copy code from Browser Use, Stagehand, OpenBrowser, or other projects merely because a component appears more advanced.

External code should only be considered when:

1. the current base fails a defined MVP acceptance test;
2. the failure is reproducible;
3. the affected module can be improved or replaced locally;
4. the change reduces risk more than it increases maintenance.

## 3. Product boundary

AI-Native Browser is an **independent repository, executable, and process**.

It is not embedded inside Gptworker.

Shipping model:

```text
AI-Browser.exe
  ├─ Chromium/browser runtime
  ├─ minimal human browser UI
  ├─ agent-browser control layer
  ├─ native MCP server
  ├─ semantic observation
  ├─ screenshot/visual observation
  ├─ security firewall
  ├─ persistent profiles/sessions
  └─ optional AI sidebar
```

MCP ships as part of the browser.

There is no separate MCP executable and no separate MCP mode.

## 4. Core invariants

1. **Browser is agent-first, not human-first.**
2. **Browser is an independent repo/build/executable/process.**
3. **MCP is native to the browser.**
4. **AI interacts with browser UI/control surface, not Chromium internals.**
5. **Semantic observation is primary; screenshot is complementary.**
6. **Normal web interaction does not require OS-level fake mouse movement.**
7. **Browser contains no required built-in LLM or reasoning engine.**
8. **Authenticated sessions may persist; credentials/payment secrets are never exposed to AI.**
9. **Chromium/browser machinery is reused rather than rewritten.**
10. **Existing agent-browser capabilities are kept unless a real MVP test proves they are insufficient.**

## 5. Human usage

Humans can use the browser for:

- entering URLs
- opening/switching/closing tabs
- browsing normally
- logging into websites
- reviewing agent activity
- manual intervention
- selecting/configuring an AI connection in the sidebar

The MVP does not aim to match Chrome or Edge as a consumer browser.

Out of scope unless later required:

- extension marketplace
- browser sync
- advanced bookmarks
- themes
- shopping features
- rich consumer settings
- broad browser account ecosystem

## 6. Agent control surface

The browser exposes MCP directly.

```text
AI Agent / Connector
        |
        | MCP
        v
+-------------------------+
|     AI-Browser.exe      |
|-------------------------|
| MCP server              |
| semantic snapshot       |
| screenshots             |
| stable element refs     |
| browser actions         |
| tabs/session/profile    |
| security firewall       |
| Chromium/browser core   |
+-------------------------+
```

The AI should not need to know whether the underlying implementation uses Playwright, CDP, accessibility APIs, DOM snapshots, IPC, or another mechanism.

## 7. Observation model

### 7.1 Semantic observation

The preferred base already provides semantic/accessibility-oriented snapshots and stable refs.

The browser should expose a compact representation such as:

```text
@e12 button "Symbol Search"
@e18 button "1D"
@e31 tab "Pine Editor"
@e42 tab "Strategy Tester"
@e55 textbox "Search"
```

The AI interacts by ref:

```text
click @e42
```

The browser should preserve the base implementation's snapshot/ref mechanism unless it fails acceptance testing.

### 7.2 Visual observation

Screenshot is a separate first-class observation channel.

Use it for:

- chart/canvas/WebGL
- images
- layout validation
- visual bugs
- markers/signals
- cases where semantic structure is insufficient

Annotated screenshots are especially useful when visual labels map to the same element refs used by semantic actions.

A screenshot is not required before every click.

## 8. Interaction model

Preferred flow:

```text
snapshot
-> identify @e42 "Strategy Tester"
-> click @e42
-> snapshot/verify
```

Not:

```text
screenshot
-> infer x,y
-> move OS mouse
-> click
-> screenshot again
```

Coordinate interaction may remain internally as a fallback for unusual or canvas-only UI, but it is not the normal public control model.

## 9. Security model

The user performs website login/authentication.

The browser persists the resulting session.

```text
Human login
   |
   v
Browser profile/session
   |
   v
AI operates authenticated site
```

Protected data must never be exposed to the AI through MCP:

- passwords
- PIN
- CVV
- OTP/payment-authentication values
- recovery secrets
- raw cookies
- auth tokens
- raw browser profile/session databases

Sensitive fields should be represented as protected values, for example:

```text
textbox "Password" [PROTECTED]
```

The firewall must be enforced by browser code, not by model behavior.

AI does not need explicit login/logout capability in MVP.

## 10. Optional AI sidebar

The browser may include a sidebar implemented as an internal web UI.

The sidebar is a human-facing connection hub, not the reasoning core.

```text
AI Browser
  ├─ Browser viewport
  └─ Sidebar
      ├─ ChatGPT / Gptworker
      ├─ Local AI
      └─ Third-party connector slot
```

The sidebar may show:

- connection state
- active provider/connector
- local AI settings
- Gptworker status
- current task/conversation UI where practical

The sidebar must not bypass MCP.

## 11. Provider connections

### 11.1 ChatGPT

Officially supported through **Gptworker**.

```text
ChatGPT Web
   |
   v
Gptworker
   |
   | MCP
   v
AI-Browser.exe
```

Gptworker is the official ChatGPT connector.

The browser itself does not depend on Gptworker.

### 11.2 Local AI

An official local connector/adapter may be provided.

The connector attaches the local agent runtime to the same Browser MCP surface.

Browser core remains provider-neutral.

### 11.3 Claude and other providers

No official Claude connector is required.

Other providers can be supported by third-party plugins/connectors that speak the browser's MCP interface.

## 12. Provider connection rule

Logging into ChatGPT, Claude, or another provider UI does not automatically grant browser control.

A connector/plugin is required between the provider session and Browser MCP.

```text
Provider session/UI
      |
      v
Provider connector/plugin
      |
      | MCP
      v
AI Browser
```

For ChatGPT, that connector is Gptworker.

## 13. Foundation strategy

Primary base:

> **vercel-labs/agent-browser**

Initial rule:

### KEEP unless proven insufficient

- MCP server
- semantic/accessibility snapshot
- stable element refs
- semantic actions
- screenshot
- annotated screenshot
- multi-tab
- session/profile behavior
- iframe support
- snapshot filtering/compaction
- delta/context-reduction behavior
- other browser-control primitives already meeting the MVP

### CHANGE only for product-specific needs

- package as an independent browser app/executable
- minimal human browser shell
- persistent user-facing profile behavior
- security firewall for protected data
- sidebar
- Gptworker integration
- local AI connector
- release/health/version handling

### DO NOT replace by default

Do not automatically replace the existing observation engine with Browser Use.

Do not automatically add Stagehand trimming.

Do not automatically copy OpenBrowser visual logic.

Do not automatically merge features from other repos.

Those repos remain references/fallback sources only.

## 14. MVP scope

The MVP must provide:

- independent AI-Browser executable
- Chromium-based browsing
- minimal human UI
- multi-tab browsing
- persistent website profile/session
- existing MCP control layer from the base
- semantic snapshots/stable refs
- screenshot
- direct element actions
- upload/download basics if already supported or easily exposed
- security firewall
- ChatGPT integration through Gptworker
- local AI integration path
- optional sidebar shell sufficient to choose/configure supported connectors

## 15. Explicit non-goals

Not required for MVP:

- building a new MCP server if the base MCP already satisfies requirements
- rebuilding semantic observation
- replacing stable refs
- replacing screenshot system
- copying another repo's DOM engine without a failing test
- built-in proprietary AI model
- built-in general reasoning engine
- 24x7 scheduler
- Claude connector
- broad provider marketplace
- Chrome extension ecosystem
- browser sync
- advanced bookmarks
- themes
- Firefox/WebKit support
- cloud browser service
- website-specific automation APIs
- raw CDP exposed to AI
- raw cookie/session APIs exposed to AI
- OS-level fake mouse as normal interaction
- deep Chromium fork

## 16. Example: TradingView

The AI needs no TradingView backend integration.

```text
snapshot
-> find "Symbol Search"
-> click
-> type "AAPL"
-> choose 1D
-> click "Pine Editor"
-> click "Strategy Tester"
-> read semantic results
-> screenshot chart when visual analysis is required
```

If the base repo can complete this workflow reliably, its observation and action layers should remain unchanged.

## 17. MVP validation philosophy

The project should be developed by **acceptance-test-driven reuse**.

Sequence:

```text
run base unchanged
-> test exact MVP workflow
-> PASS: keep implementation
-> FAIL: isolate concrete failure
-> fix smallest possible module
-> retest
```

The standard is not "is another repo better?"

The standard is:

> **Does the current implementation already meet our requirement reliably enough?**

If yes, keep it.

## 18. MVP acceptance criteria

MVP is complete when:

- AI-Browser runs as its own executable/process.
- Human can browse/login normally.
- Browser exposes MCP natively using the retained base implementation.
- AI can read semantic state of the current tab.
- AI can use stable refs to click/type/select/scroll.
- AI can request screenshots for visual understanding.
- Annotated/visual interaction works where needed.
- Common actions do not require OS mouse emulation.
- Multiple tabs work.
- Website sessions survive browser restart.
- Protected credentials/payment data are not exposed through MCP.
- ChatGPT can control the browser through Gptworker.
- A local AI connector can control the same MCP surface.
- Browser core does not depend on Gptworker or any specific provider.
- No major subsystem has been rewritten without a failing acceptance test justifying it.

## 19. Product positioning

AI-Native Browser is not intended to replace Chrome for ordinary users.

It is:

> **A lightweight Chromium browser built primarily as an execution environment for AI agents, reusing a proven agent-browser control layer and adding only the product shell, security, persistence, and connector experience needed to make it a standalone browser.**

## 20. Final implementation principle

> **Keep first. Strip only what is unnecessary. Add only what is missing. Replace only what fails a real requirement.**
