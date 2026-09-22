# AI-Native Browser — MVP

Status: **Draft v0.2**

## 1. Product thesis

> **Not a browser with AI added to it, but a browser built to be operated by AI.**

AI-Native Browser is a lightweight Chromium-based browser designed primarily for AI agents.

Humans can still use it for normal browsing, login, tab switching, inspection, and intervention, but human convenience features are secondary. The primary product requirement is that an AI agent can understand and operate the current browser UI directly through a native MCP control surface.

The browser exists because mainstream browsers are designed for humans first. AI typically has to control them through extensions, Playwright/CDP wrappers, remote computer-use layers, or fake mouse/keyboard automation. This project makes agent control a first-class browser capability instead of an external attachment.

## 2. Product boundary

AI-Native Browser is an **independent application and executable**, not a feature embedded inside Gptworker.

Long-term deployment model:

```text
AI-Browser.exe
  ├─ Chromium runtime
  ├─ minimal human browser UI
  ├─ semantic observation engine
  ├─ screenshot/visual observation
  ├─ browser action controller
  ├─ security firewall
  ├─ persistent profiles/sessions
  ├─ native MCP server
  └─ optional AI sidebar
```

The browser owns its MCP interface natively.

There is no separate MCP executable and no separate MCP mode. MCP is simply the browser's agent-control interface.

## 3. Core invariants

1. **Browser is agent-first, not human-first.**
2. **Browser is an independent repo, build, executable, and process.**
3. **MCP is native to the browser and ships with it.**
4. **AI interacts with browser UI/control surface, not Chromium internals.**
5. **Semantic observation is primary; screenshot is complementary.**
6. **Normal UI interaction does not require OS-level fake mouse movement.**
7. **Browser contains no required built-in LLM or reasoning engine.**
8. **Authenticated sessions may persist; credentials/payment secrets are never exposed to AI.**
9. **Chromium engine is reused, not rewritten.**
10. **Reuse/strip/replace before rewriting.**

## 4. Human usage

Humans can use the browser for:

- entering URLs
- opening and switching tabs
- normal browsing
- logging into websites
- reviewing what the agent is doing
- manually intervening when needed
- choosing/connecting an AI through the sidebar

The MVP does not aim to match Chrome/Edge human convenience.

Human-oriented features such as advanced bookmarks, sync, extension stores, themes, browser account systems, shopping features, and rich consumer settings are out of scope unless required later.

## 5. Native MCP control surface

The browser exposes MCP directly.

```text
AI Agent / Connector
        |
        | MCP
        v
+-------------------------+
|     AI-Browser.exe      |
|-------------------------|
| Native MCP server       |
| Browser control surface |
| Semantic observation    |
| Screenshot              |
| Security firewall       |
| Chromium runtime        |
+-------------------------+
```

The public MCP surface should remain small and UI-oriented.

Initial tool family:

```text
browser.open(url)
browser.reload()
browser.wait(...)

browser.observe()
browser.screenshot()

browser.click(element_id)
browser.type(element_id, text)
browser.press(key)
browser.scroll(...)
browser.hover(element_id)
browser.select(element_id, value)

browser.tabs()
browser.tab_new(url?)
browser.tab_switch(tab_id)
browser.tab_close(tab_id)

browser.upload(...)
browser.download(...)
```

The agent should never need to know whether the implementation uses Playwright, CDP, DOM snapshots, accessibility APIs, IPC, or other browser internals.

## 6. Observation model

The browser provides two complementary observation channels.

### 6.1 Semantic observation

`browser.observe()` returns a reduced representation of the current rendered tab.

Example:

```text
tab_id: tab_2
url: https://www.tradingview.com/...
title: TradingView

elements:
  e12  button    "Symbol Search"
  e18  button    "1D"
  e31  tab       "Pine Editor"
  e42  tab       "Strategy Tester"
  e55  textbox   "Search"
  e78  canvas    "Main chart" [visual-region]
```

Internally the browser may derive this from:

- DOM
- accessibility tree
- visible text
- role/state
- focus state
- bounding boxes
- viewport
- rendering metadata

These remain implementation details.

### 6.2 Visual observation

`browser.screenshot()` captures the current tab for visual reasoning.

Use it for:

- chart/canvas/WebGL
- images
- visual layout
- UI overlap
- rendering bugs
- markers/lines/signals
- cases where semantic structure is insufficient

A screenshot is **not required before every click**.

## 7. Interaction model

Primary interaction:

```text
observe
-> identify e42 "Strategy Tester"
-> click(e42)
-> observe/verify
```

Not:

```text
screenshot
-> infer x,y
-> move OS mouse
-> click
-> screenshot
```

Coordinate actions may exist internally as a fallback for canvas-only interfaces, but are not the default public control model.

## 8. Security model

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

Protected data must never be exposed through MCP:

- passwords
- PIN
- CVV
- OTP/payment authentication values
- recovery secrets
- raw cookies
- auth tokens
- raw browser profile databases

Sensitive UI fields should be represented as:

```text
textbox "Password" [PROTECTED]
```

The firewall is enforced by browser code, not by model behavior.

AI does not need login/logout control in MVP.

## 9. Optional AI sidebar

The browser may include a sidebar implemented as an internal web UI.

The sidebar is a **human-facing connection hub**, not the browser's reasoning core.

```text
AI Browser
  ├─ Browser viewport
  └─ Sidebar
      ├─ ChatGPT
      ├─ Local AI
      └─ third-party provider connector slots
```

The sidebar allows the user to choose how the browser is connected to an AI.

### 9.1 ChatGPT

Officially supported through **Gptworker**.

```text
ChatGPT Web
   |
   v
Gptworker
   |
   | MCP
   v
AI Browser
```

Gptworker acts as the official ChatGPT connector/bridge.

The browser itself does not need to understand ChatGPT internals.

### 9.2 Local AI

The project may provide an official local-AI connector/adapter.

The local connector can connect a local model/agent runtime to Browser MCP.

The exact local provider/model interface is implementation-dependent and should not affect Browser MCP.

### 9.3 Claude and other providers

No official Claude connector is required.

The browser exposes a provider-neutral MCP contract. Users/developers who want Claude or another AI provider can build their own plugin/connector.

This keeps browser core independent from provider ecosystems.

## 10. Provider connection principle

Logging into an AI provider UI is not enough to grant browser control.

Each AI provider requires a connector capable of exposing/attaching Browser MCP tools to that provider session.

```text
Provider UI/session
      |
      v
Provider connector/plugin
      |
      | MCP
      v
AI Browser
```

For ChatGPT, the connector is Gptworker.

For local AI, an official local connector may be provided.

Other providers are third-party integrations.

## 11. Foundation and reuse strategy

Use one existing project as the primary base and modify it minimally.

Current preferred base: **AgentBrowser** because it is closest to the target runtime.

Keep where possible:

- Chromium/Playwright runtime
- tabs/navigation
- actions
- screenshots
- persistent sessions/profiles
- basic semantic observation
- existing local control plumbing useful to the runtime

Use other repos only for targeted improvements:

| Source | Use |
|---|---|
| Browser Use | Better DOM/iframe/shadow/viewport observation when needed |
| Stagehand | Semantic/a11y context trimming and resilient targeting concepts |
| OpenBrowser | Visual fallback and evaluation/testing ideas |
| open-browser-use | Provider-neutral protocol/session design ideas |

Do not merge frameworks wholesale.

> **Do not rewrite when strip, adapt, or replace is enough.**

## 12. MVP scope

MVP must provide:

- independent browser executable
- Chromium rendering engine
- minimal human UI
- multi-tab browsing
- persistent website profile/session
- native MCP server
- semantic `observe()`
- screenshot
- direct element actions
- upload/download basics
- security firewall
- ChatGPT integration path through Gptworker
- local-AI integration path
- optional sidebar shell sufficient to choose/configure supported connectors

## 13. Explicit non-goals

Not required for MVP:

- built-in proprietary AI model
- built-in general reasoning engine
- 24x7 scheduler
- Claude connector
- broad provider marketplace
- Chrome extension ecosystem
- browser sync
- advanced bookmarks
- browser themes
- Firefox/WebKit support
- cloud browser service
- website-specific automation APIs
- raw CDP exposed to AI
- raw cookie/session APIs exposed to AI
- OS-level fake mouse as normal interaction
- deep Chromium fork

## 14. Example: TradingView

The AI does not need TradingView backend access.

It uses UI only.

```text
observe
-> click "Symbol Search"
-> type "AAPL"
-> choose 1D
-> click "Pine Editor"
-> click "Strategy Tester"
-> read semantic results
-> screenshot chart when visual analysis is required
```

This demonstrates the key design goal:

> AI uses the rendered browser UI like a human, but with a native semantic control channel instead of external mouse emulation.

## 15. MVP acceptance criteria

MVP is complete when:

- AI-Browser runs as its own executable/process.
- Browser exposes MCP natively.
- Human can browse/login normally.
- AI can observe current-tab semantic UI.
- AI can request current-tab screenshots.
- AI can click/type/scroll/select using semantic element references.
- Common actions do not require OS mouse emulation.
- Multiple tabs work.
- Website sessions survive browser restart.
- Protected credentials/payment data are not exposed through MCP.
- ChatGPT can control the browser through Gptworker.
- A local AI connector can control the same MCP surface.
- Browser core does not depend on Gptworker or any specific AI provider.

## 16. Product positioning

AI-Native Browser is **not a replacement for Chrome for normal users**.

It is:

> **A lightweight Chromium browser built primarily as an execution environment for AI agents, with a native MCP control surface and just enough human UI for login, inspection, and intervention.**
