# AI-Native Browser — MVP Draft Implementation

Status: **Draft v0.1**

Scope: Chromium-based browser runtime + Browser MCP + Gptworker bridge.

## 1. Purpose

Build a minimal Chromium-based browser designed to be controlled by AI through a stable UI-oriented interface.

The browser itself contains no intelligence. ChatGPT Web, local AI, or another agent controls it through **Browser MCP**, which is registered as a reusable Gptworker capability and exposed to ChatGPT Web through the existing Gptworker tunnel.

The implementation should reuse an existing agent-browser codebase as the foundation, strip unnecessary features, replace only weak modules, and add as little new code as possible.

## 2. Core design principles

1. **Reuse before rewrite.** Choose one repo as the base and modify it minimally.
2. **AI interacts with the browser UI/control surface, not with Chromium internals.**
3. Chromium backend implementation is invisible to ChatGPT and other AI clients.
4. Semantic page state is the primary interaction channel; screenshots are complementary.
5. Normal web interaction must not require OS-level fake mouse movement.
6. The browser contains no LLM, agent loop, scheduler, or reasoning layer.
7. Authenticated website sessions may persist, but credentials and payment secrets are never exposed to AI.
8. Browser runtime, Gptworker job, and website login profile have independent lifecycles.
9. Keep the Chromium web engine intact; cut the surrounding product surface, not the engine.

> **Implementation rule:** Do not rewrite when strip, adapt, or replace a module is sufficient.

## 3. Proposed foundation

Use **AgentBrowser** as the initial base because it is closest to the MVP:

- Chromium / Playwright runtime
- tabs and navigation
- browser actions
- screenshot
- session/profile handling
- simplified DOM / accessibility-oriented observation
- REST / WebSocket plumbing

Other repositories are secondary sources:

| Source | Role | Expected use |
|---|---|---|
| AgentBrowser | Primary base | Keep runtime, tabs, actions, screenshot, session; strip non-MVP layers |
| Browser Use | Observation upgrade | Port/adapt mature DOM, iframe, shadow DOM, viewport and element handling if needed |
| Stagehand | Context optimization | Adapt semantic/a11y trimming and resilient targeting concepts |
| OpenBrowser | Visual/evaluation reference | Learn screenshot fallback and regression/evaluation patterns |
| open-browser-use | Protocol/session reference | Learn AI-neutral commands and resumable browser-session semantics |

The goal is **not** to merge multiple frameworks. Start from one base repo and only copy/replace individual modules when real tests show that the base is insufficient.

## 4. Target architecture

```text
ChatGPT Web / Local AI
        |
        | tool call
        v
+----------------------+
|      Gptworker       |
| MCP registry/router  |
+----------+-----------+
           |
           | existing tunnel / local routing
           v
+----------------------+
|     Browser MCP      |
|----------------------|
| tool schema          |
| session routing      |
| security sanitizer   |
| lifecycle control    |
+----------+-----------+
           |
           v
+----------------------+
| Browser Runtime      |
| AgentBrowser-derived |
|----------------------|
| Chromium/Playwright  |
| tabs/navigation      |
| actions              |
| semantic observe     |
| screenshots          |
| profiles/session     |
+----------+-----------+
           |
           v
        Chromium
```

Gptworker must not depend on AgentBrowser-specific APIs.

**Browser MCP is the stable boundary.** If the runtime is replaced later, the MCP tool contract should remain unchanged.

## 5. MVP scope

### 5.1 Browser capabilities

The MVP browser must support:

- open / navigate / reload URL
- create, list, switch and close tabs
- observe the current tab semantically
- capture screenshot of the current tab
- click an interactive element by stable element ID
- type/fill text
- press keys when required by web UI
- scroll
- hover
- select dropdown options
- check/uncheck controls
- basic upload/download
- persistent browser profile/session across browser restarts

### 5.2 Explicit non-goals

The MVP does **not** include:

- built-in LLM
- built-in reasoning or agent loop
- scheduler / 24x7 automation engine
- extension ecosystem
- Firefox/WebKit support
- cloud browser infrastructure
- website-specific APIs such as `facebook.post()`
- raw cookie/localStorage/auth-token APIs exposed to AI
- arbitrary JavaScript execution exposed to AI
- OS-level fake mouse for normal web interactions
- deep Chromium fork unless later proven necessary

## 6. Browser MCP contract

Browser MCP is the public control surface visible to Gptworker and AI clients.

Keep the toolset small, generic, and UI-oriented.

```text
browser.start(profile?)
browser.stop()

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

The exact tool names may still change during Phase 0, but the public surface should remain minimal.

## 7. Observation model

AI should **not** receive an entire raw HTML document by default.

`browser.observe()` returns a reduced semantic representation of the currently rendered tab.

Internally the runtime may use:

- DOM
- accessibility tree
- visible text
- element roles
- selected / checked / disabled state
- focus state
- bounding boxes
- viewport information
- rendering metadata

But these are implementation details.

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

Element IDs should remain stable for the current page state.

If a major DOM update invalidates an element, return a structured error such as:

```text
ELEMENT_NOT_AVAILABLE
```

The AI then performs `browser.observe()` again.

## 8. Semantic + visual interaction

The AI has two observation channels.

```text
Current Tab
   |
   +--> Semantic snapshot --> buttons / textboxes / tabs / text / state
   |
   +--> Screenshot ---------> chart / canvas / images / layout / visual bugs
                              |
                              v
                             AI
                              |
                              v
                         browser action
```

### Semantic channel

Use for precise interaction:

- identify buttons
- identify text fields
- identify tabs
- identify menus
- inspect text/state
- execute actions by element ID

### Visual channel

Use when the semantic representation is insufficient:

- charts
- canvas/WebGL
- images
- layout validation
- popup overlap
- visual bugs
- markers/lines on TradingView
- any UI whose meaning depends on rendered pixels

A screenshot should **not** be mandatory before every action.

## 9. No fake mouse as the primary mechanism

Traditional external computer-use flow:

```text
screenshot
-> infer x,y
-> move OS mouse
-> click
-> screenshot again
```

Target browser-native flow:

```text
observe
-> identify e42 "Strategy Tester"
-> click(e42)
-> observe/verify
```

Coordinate interaction may remain as an **internal fallback** for canvas-only or unusual interfaces, but it must not be the primary AI-facing contract.

## 10. Security boundary

AI may control normal browser interactions broadly, while authentication and payment secrets remain protected.

The user performs login/authentication.

The browser preserves the resulting authenticated session.

```text
Human authenticates
        |
        v
Browser profile keeps session
        |
        v
AI uses the authenticated website
        |
        +--> credentials remain hidden
```

Required protections:

- password values are never returned by `observe()`
- PIN is protected
- CVV is protected
- OTP/payment authentication values are protected
- recovery secrets are protected
- raw cookies are not exposed as MCP tools
- auth tokens are not exposed as MCP tools
- raw profile/session databases are not exposed
- sensitive fields are returned as `[PROTECTED]`
- sanitization happens before data leaves the browser/MCP boundary
- AI does not need explicit login/logout capability in MVP

The firewall must be enforced by code, not by model behavior.

## 11. Lifecycle model

Keep three lifecycles independent.

| Lifecycle | Owner | Behavior |
|---|---|---|
| Gptworker job | Gptworker | Starts/ends with user work or job semantics |
| Browser runtime | Browser MCP/runtime | Starts on demand, may idle or stop independently |
| Website profile/session | Browser profile | Persists cookies/session state across runtime restarts |

A job may end without destroying the browser profile.

A browser process may stop and later reopen the same authenticated profile.

## 12. Base repo modification plan

| Area | Action | Notes |
|---|---|---|
| Chromium/Playwright runtime | KEEP | Do not rewrite |
| Tabs/navigation | KEEP | Simplify public surface only |
| Click/type/scroll/select | KEEP | Expose through MCP element IDs |
| Screenshot | KEEP | Return image result through MCP/tunnel |
| Session/profile | KEEP + HARDEN | Persistent profiles; no raw session-store access |
| Simplified DOM/a11y | KEEP initially | Upgrade only if real tests show weakness |
| DOM/iframe/shadow handling | UPGRADE if needed | Prefer Browser Use implementation patterns/code |
| Semantic trimming | ADD/ADAPT | Stagehand-inspired context reduction |
| Built-in AI/agent loop | REMOVE | Reasoning belongs to ChatGPT/local AI |
| Dashboard | REMOVE | Not needed for MVP |
| DB/cloud/proxy extras | REMOVE unless required | Avoid unnecessary infrastructure |
| Firefox/WebKit | REMOVE | Chromium only |
| Raw evaluate/cookie/storage tools | REMOVE from public surface | May remain internal if runtime requires |
| Browser MCP | ADD | Primary new integration layer |
| Credential firewall | ADD | Primary new security layer |
| Gptworker capability registration | ADD | Expose Browser MCP through existing tunnel |

## 13. Gptworker integration

Browser should be a **reusable Gptworker capability**, not a dedicated job.

Possible callers:

- coding jobs
- Layla
- social-page management jobs
- custom jobs
- future local agents

Flow:

```text
ChatGPT Web
   |
   | existing Gptworker tunnel
   v
Gptworker MCP router
   |
   v
Browser MCP
   |
   v
Browser runtime / Chromium
```

The tunnel transports MCP calls and results.

It should **not** transport raw CDP traffic.

Chromium/runtime implementation remains local.

## 14. Suggested repository structure

The browser may initially live inside the Gptworker repo during MVP development, but the runtime boundary should remain clean enough to split into its own repo later if needed.

```text
browser/
  runtime/
    src/
      runtime/
      actions/
      observe/
      profiles/
      security/
    vendor-or-derived/
  mcp/
    src/
      tools/
      schemas/
      session-router/
      sanitizer/
      lifecycle/
  tests/
    mocked-sites/
    integration/
    security/
    visual/

docs/
  ai-native-browser-mvp.md
```

Exact placement should follow the existing Gptworker repository layout after implementation planning.

## 15. Implementation phases

### Phase 0 — Foundation lock

1. Freeze the exact AgentBrowser version/commit used as base.
2. Verify license compatibility before copying code from secondary repos.
3. Map base modules to KEEP / REMOVE / REPLACE / ADD.
4. Run the base project unchanged and record working behavior.
5. Freeze Browser MCP tool names and top-level schemas for MVP.

**Exit condition:** foundation and public control contract are agreed before major code changes.

### Phase 1 — Strip to minimal Chromium runtime

1. Remove non-Chromium engines.
2. Remove built-in LLM/agent logic.
3. Remove dashboard/cloud/database/proxy features not required.
4. Keep headed Chromium.
5. Keep tabs/navigation.
6. Keep actions.
7. Keep screenshots.
8. Keep persistent profiles.
9. Confirm ordinary browsing performance remains close to base Chromium.

**Exit condition:** minimal headed Chromium runtime works without AI-specific logic.

### Phase 2 — Browser MCP facade

1. Implement MCP tools for start/stop.
2. Implement open/reload.
3. Implement tabs.
4. Implement UI actions.
5. Implement observe.
6. Implement screenshot.
7. Map MCP tools to existing runtime operations.
8. Return stable structured errors.
9. Keep backend implementation details out of responses.
10. Support browser session/profile routing.

**Exit condition:** a local MCP client can fully control the runtime through the public contract.

### Phase 3 — Semantic observation

1. Start with the base repo's simplified DOM/a11y observation.
2. Filter invisible and irrelevant nodes.
3. Assign stable element IDs.
4. Return visible text, semantic role and relevant state.
5. Test real sites with complex DOM.
6. Add Browser Use iframe/shadow/viewport improvements only where tests show gaps.
7. Add Stagehand-style trimming if context becomes excessive.

**Exit condition:** AI can reliably identify and act on normal interactive controls without raw HTML.

### Phase 4 — Screenshot and visual verification

1. Expose current-tab screenshot through MCP.
2. Allow semantic observation and screenshot to be requested independently.
3. Test chart/canvas-heavy pages.
4. Test UI layout verification.
5. Keep coordinate interaction only as an internal fallback.

**Exit condition:** semantic + visual observation can cover both normal web UI and chart/canvas cases.

### Phase 5 — Security firewall

1. Detect and redact password fields.
2. Detect other sensitive authentication inputs.
3. Add payment-secret protection rules.
4. Remove/block raw cookie/token/storage APIs from public MCP.
5. Verify profile/session persistence across restart.
6. Verify secrets remain inaccessible.
7. Add security regression tests.

**Exit condition:** AI can use an authenticated session without obtaining protected credentials/secrets.

### Phase 6 — Gptworker integration

1. Register Browser MCP as a Gptworker capability.
2. Route Browser MCP through the existing Gptworker tunnel.
3. Wake/start browser runtime when a browser tool is actually called.
4. Keep tunnel/driver lightweight when browser capability is idle.
5. Release job ownership cleanly without destroying persistent profiles.
6. Verify ChatGPT Web can complete a full `observe -> act -> verify` loop.

**Exit condition:** ChatGPT Web controls the local browser end-to-end through Gptworker.

## 16. MVP acceptance tests

### Test A — Local web app

Pass when ChatGPT can:

1. open localhost
2. receive meaningful controls from `observe()`
3. click/type without OS fake mouse
4. request screenshot when visual inspection is needed
5. verify whether the requested UI goal was achieved

Primary use case:

```text
code
-> run dev server
-> open localhost
-> observe
-> interact
-> screenshot if required
-> verify
-> fix
-> repeat
```

### Test B — TradingView-like workflow

Pass when ChatGPT can:

1. open a chart-heavy website
2. use semantic controls for tabs, menus, search and text inputs
3. use screenshot for chart/canvas analysis
4. complete `observe -> act -> observe -> verify`
5. do so without knowing the website backend or raw Chromium/CDP implementation

Example:

```text
observe
-> identify "Symbol Search"
-> click
-> type symbol
-> select timeframe
-> open "Pine Editor"
-> open "Strategy Tester"
-> screenshot chart when visual inspection is required
```

### Test C — Authenticated website

Pass when:

1. user logs in manually
2. browser runtime is closed
3. browser runtime restarts
4. profile remains authenticated
5. AI can navigate and operate the website
6. password/payment/authentication secrets remain inaccessible

## 17. MVP completion criteria

MVP is complete when all of the following are true:

- ChatGPT Web can control the browser through Gptworker and Browser MCP.
- AI can read semantic state of the current tab.
- AI can request screenshots for visual understanding.
- AI can perform common UI actions without OS-level fake mouse movement.
- Multiple tabs work.
- Browser profiles persist authenticated sessions.
- Credential/payment secrets do not leave the protected browser boundary.
- No built-in LLM or scheduler exists inside the browser.
- Implementation is primarily derived from the selected base repo rather than rewritten from scratch.
- Browser backend can later be replaced without changing the public MCP contract.

## 18. Open decisions

These should be resolved during Phase 0 or early implementation:

1. Exact AgentBrowser commit/version to freeze as base.
2. Whether to keep the base repo's internal REST/WebSocket layer or call runtime modules directly from Browser MCP.
3. How much Browser Use DOM code is actually required after real-world tests.
4. Exact sensitive-field detection policy beyond obvious password/payment inputs.
5. Whether a custom minimal browser shell is needed after the headed-Chromium prototype passes.
6. How browser capability permissions should be declared per Gptworker job.

## 19. Final implementation rule

> **Do not rewrite when strip, adapt, or replace a module is sufficient.**

The purpose of this project is not to invent a new browser framework.

The target is the **smallest reliable Chromium browser runtime that exposes a clean AI-native UI control surface through MCP and Gptworker**.
