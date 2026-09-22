# AI-Native Browser — Draft Implementation Plan

Status: **Draft v0.2**

Related: [AI-Native Browser MVP](./ai-native-browser-mvp.md)

## 1. Implementation objective

Build an independent Chromium-based browser executable with a native MCP control surface.

The browser should be produced mostly by **stripping and adapting an existing agent-browser codebase**, not by rewriting Chromium integration from scratch.

Primary base candidate: **AgentBrowser**.

Secondary sources are used only to replace weak modules after tests demonstrate a need.

## 2. Repository boundary

AI-Native Browser should live in its **own repository**.

Gptworker remains a separate project and acts only as the official ChatGPT connector.

Recommended development layout:

```text
<workspace>/
  chatgpt-local-worker/
  ai-native-browser/
```

Recommended shipping model:

```text
Gptworker.exe        # independent
AI-Browser.exe       # independent
```

No Git submodule is required for the initial design.

Integration should use MCP and explicit version compatibility rather than source-level coupling.

## 3. Browser internal architecture

```text
AI-Browser.exe
|
+-- Minimal Browser UI
|   +-- address bar
|   +-- tabs
|   +-- viewport
|   +-- optional sidebar
|
+-- Native MCP Server
|   +-- tool schemas
|   +-- request validation
|   +-- response encoding
|
+-- Browser Control Surface
|   +-- navigation
|   +-- tab management
|   +-- click/type/scroll/select
|   +-- upload/download
|
+-- Observation Engine
|   +-- semantic snapshot
|   +-- element IDs
|   +-- screenshot
|   +-- visual regions
|
+-- Security Firewall
|   +-- sensitive-field redaction
|   +-- session-secret isolation
|   +-- tool allow/block rules
|
+-- Profile/Session Manager
|
+-- Chromium / Playwright Runtime
```

MCP is part of the browser process. There is no separate MCP executable and no alternate MCP mode.

## 4. External connection architecture

### 4.1 ChatGPT

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

Gptworker:

- exposes/bridges browser MCP tools to ChatGPT Web
- does not contain browser runtime code
- does not know Chromium internals
- does not own browser profiles
- may launch/discover the browser process when needed

### 4.2 Local AI

```text
Local AI Agent
    |
    v
Local Connector
    |
    | MCP
    v
AI-Browser.exe
```

The local connector may be shipped by this project or as a companion package.

### 4.3 Third-party providers

```text
Claude / Other Provider
        |
        v
Third-party connector/plugin
        |
        | MCP
        v
AI-Browser.exe
```

No official Claude implementation is in scope.

## 5. Base repo strategy

### 5.1 AgentBrowser — primary base

Keep initially:

- Chromium/Playwright startup
- browser/page lifecycle
- tabs/navigation
- click/type/scroll/select actions
- screenshot
- profile/session support
- useful local transport/runtime plumbing
- simplified DOM/a11y observation as a starting point

Remove or isolate:

- built-in AI/model logic
- agent loop
- dashboard not required by minimal browser
- cloud/proxy features not needed
- database layers not needed
- Firefox/WebKit
- raw `evaluate` exposed publicly
- raw cookie/storage/token controls exposed publicly

### 5.2 Browser Use — targeted observation upgrade

Only port/adapt if tests prove needed:

- robust DOM extraction
- iframe traversal
- shadow DOM handling
- viewport filtering
- clickable/interactable detection
- element metadata
- page-state handling

### 5.3 Stagehand — targeted context optimization

Adapt concepts/code only where useful:

- accessibility/semantic trimming
- token-efficient observation
- resilient target resolution

### 5.4 OpenBrowser / open-browser-use

Use as references for:

- visual fallback
- event/evaluation design
- record/replay regression tests
- provider-neutral session/tool boundaries

## 6. Public MCP contract

Initial contract:

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

Do not expose:

- raw CDP
- arbitrary JS evaluate
- raw cookies
- raw localStorage/sessionStorage
- raw auth tokens
- profile database access
- password values

## 7. Semantic observation implementation

First implementation should reuse the base repo's existing DOM/a11y extraction.

Normalize output into browser-owned objects:

```text
ElementRef {
  id
  role
  name
  value_state
  interactive
  selected
  checked
  disabled
  visible
  visual_region?
}
```

Avoid returning complete HTML by default.

Filter:

- invisible nodes
- scripts/styles
- duplicate wrappers
- irrelevant layout containers
- hidden controls
- excessive off-screen content unless requested

Element IDs should be stable within the current UI state.

If action target is stale:

```text
ELEMENT_NOT_AVAILABLE
```

Caller must observe again.

## 8. Screenshot implementation

Screenshot is a first-class MCP tool but independent of semantic observation.

Use screenshot for:

- canvas/WebGL
- TradingView charts
- image interpretation
- visual layout checks
- UI regressions
- cases where semantic view is ambiguous

Do not automatically screenshot before every action.

Potential later optimization:

- viewport screenshot
- element screenshot
- changed-region screenshot

These are not required for first MVP.

## 9. Action implementation

Preferred resolution order:

1. stable internal element reference
2. semantic role/name locator
3. DOM/locator fallback
4. coordinate fallback only if required

The AI-facing API remains semantic regardless of internal fallback.

Never require OS cursor movement for ordinary actions.

## 10. Security firewall implementation

Firewall sits before any observation/result is returned through MCP.

### Block/redact

- password values
- PIN
- CVV
- OTP/payment auth fields
- recovery secrets
- raw cookies
- raw auth headers/tokens
- profile database content

### Allow

- normal visible text
- regular form values unless classified sensitive
- buttons/tabs/menu states
- page content
- screenshots, subject to future privacy policy if needed

The sensitive-field classifier should begin conservatively with deterministic browser/HTML signals:

- `input[type=password]`
- autocomplete hints
- payment-field semantics
- known security roles/names

Do not depend on LLM judgment for core secret filtering.

## 11. Profile/session design

Browser profile belongs to AI-Browser, not Gptworker.

Example:

```text
profiles/
  default/
  development/
  social/
  shop/
```

Profiles preserve:

- cookies
- login session state
- local site preferences
- browser storage needed by the site

MCP does not expose the raw profile contents.

## 12. Minimal human UI

Required:

- address bar
- tabs
- browser viewport
- basic browser navigation
- optional sidebar toggle

Human UI is intentionally minimal.

Do not build advanced Chrome-like convenience features in MVP.

## 13. Sidebar implementation

Sidebar should be an internal web UI bundled with the browser.

Possible internal route:

```text
browser://assistant
```

or equivalent internal page implementation.

Sidebar responsibilities:

- display connection state
- choose supported AI connection
- show ChatGPT/Gptworker setup/status
- configure local AI connector
- expose third-party connector slot/documentation
- optionally host conversation UI where the connector architecture allows it

Sidebar must not bypass MCP.

All agent control still flows through Browser MCP.

## 14. ChatGPT/Gptworker integration

Gptworker is the official ChatGPT connector.

Browser-side requirements:

- expose stable MCP endpoint
- expose version/health metadata
- support local discovery or configured endpoint
- remain independent if Gptworker is absent

Gptworker-side work is integration only:

- register/discover Browser MCP
- bridge tools through existing tunnel
- start/connect to AI-Browser if configured
- enforce absolute executable/config paths
- do not embed browser runtime code

Browser release/version should not be tied to Gptworker release/version.

## 15. Local AI connector

Provide a thin adapter capable of:

- selecting/configuring a local model runtime
- attaching Browser MCP tools
- passing tool results back to the local agent loop

The browser itself should not care whether the local runtime is Ollama, LM Studio, llama.cpp, or another system.

Provider-specific details belong in the connector.

## 16. Suggested AI-Browser repo structure

```text
ai-native-browser/
  src/
    app/
      window/
      tabs/
      sidebar/
    runtime/
      chromium/
      pages/
      actions/
    observe/
      semantic/
      screenshot/
      element_refs/
    mcp/
      server/
      tools/
      schemas/
      errors/
    security/
      sanitizer/
      sensitive_fields/
      policies/
    profiles/
    health/
  connectors/
    local/
  tests/
    unit/
    integration/
    security/
    visual/
    mocked-sites/
  docs/
    MVP.md
    IMPLEMENTATION.md
    MCP_PROTOCOL.md
    SECURITY.md
    CONNECTORS.md
  licenses/
```

Gptworker code remains in its own repo.

## 17. Implementation phases

### Phase 0 — Foundation audit and freeze

1. Select exact AgentBrowser source version/commit.
2. Verify license and transitive dependency constraints.
3. Run untouched base.
4. Map files/modules to KEEP / REMOVE / REPLACE / ADD.
5. Record baseline capabilities.
6. Freeze first MCP schema.
7. Create separate AI-Browser repo.

Exit: foundation frozen before major editing.

### Phase 1 — Strip the base runtime

1. Keep Chromium only.
2. Keep headed browser.
3. Keep tab/navigation/action/screenshot/session primitives.
4. Remove built-in model/agent layer.
5. Remove cloud/dashboard/database/proxy features not required.
6. Remove Firefox/WebKit.
7. Remove public raw backend APIs not intended for AI.
8. Confirm normal browsing still works.

Exit: lightweight agent-browser runtime works standalone.

### Phase 2 — Native MCP server

1. Embed MCP server into browser process.
2. Implement health/version metadata.
3. Implement navigation/tab tools.
4. Implement action tools.
5. Implement observe/screenshot.
6. Add structured errors.
7. Add MCP protocol tests.

Exit: generic MCP client can control browser end-to-end.

### Phase 3 — Semantic observation quality

1. Normalize semantic snapshot.
2. Add stable element refs.
3. Filter irrelevant nodes.
4. Test common websites.
5. Test complex iframe/shadow DOM websites.
6. Port Browser Use pieces only where failures justify it.
7. Add trimming if observation context is too large.

Exit: semantic UI works reliably on representative sites.

### Phase 4 — Visual channel

1. Finalize screenshot tool.
2. Test chart/canvas pages.
3. Test TradingView-like workflow.
4. Add coordinate fallback internally only where semantic actions cannot operate.

Exit: semantic + visual coverage handles normal UI plus chart/canvas cases.

### Phase 5 — Security firewall

1. Add deterministic sensitive-field classifier.
2. Redact protected values.
3. block raw session/cookie/token tools.
4. Verify profile persistence.
5. Add credential-leak regression tests.
6. Test authenticated sites.

Exit: authenticated operation works without secret exposure.

### Phase 6 — Minimal browser UI and sidebar

1. Keep/create minimal address bar and tab UI.
2. Add sidebar container.
3. Add connector selection/status UI.
4. Add ChatGPT/Gptworker connection status.
5. Add local-AI connector settings.
6. Add third-party connector documentation/slot.

Exit: user can browse, login, and choose supported AI connection from one application.

### Phase 7 — Gptworker connector integration

1. Add Browser MCP discovery/registration to Gptworker.
2. Route browser MCP tools through existing tunnel.
3. Use absolute executable/config paths.
4. Start/connect/health-check AI-Browser as needed.
5. Keep browser and Gptworker lifecycles independent.
6. Run ChatGPT Web end-to-end acceptance test.

Exit: ChatGPT Web can operate AI-Browser through Gptworker.

### Phase 8 — Local AI connector

1. Implement thin provider-neutral local connector boundary.
2. Support at least one local runtime for acceptance testing.
3. Verify same Browser MCP tools work unchanged.
4. Keep local provider details out of browser core.

Exit: local AI can operate the browser using the same MCP contract.

## 18. Acceptance test suite

### A. Core browser

- executable launches independently
- normal URL navigation works
- multi-tab works
- page reload works
- persistent profile works

### B. Semantic agent control

- observe returns useful UI elements
- click/type/select work via element refs
- stale refs return structured error
- no OS mouse required for normal actions

### C. Visual agent control

- screenshot returns current viewport
- chart/canvas page can be visually inspected
- semantic and visual observations can be used independently

### D. Security

- password never appears in semantic output
- sensitive payment/auth fields are redacted
- raw cookie/token/profile data cannot be requested through MCP
- authenticated session survives restart

### E. ChatGPT

- Gptworker connects to Browser MCP
- ChatGPT Web receives browser tools
- ChatGPT can complete observe -> act -> verify
- browser remains independently runnable without Gptworker

### F. Local AI

- local connector attaches Browser MCP
- local agent uses the same tool schema
- browser core requires no provider-specific changes

## 19. First real workflows

### Workflow 1 — Local UI development

```text
AI edits code
-> runs local app
-> opens localhost
-> observes UI
-> interacts
-> screenshots when needed
-> verifies goal
-> repeats
```

### Workflow 2 — TradingView strategy validation

```text
AI opens TradingView
-> selects symbol/timeframe
-> opens Pine Editor
-> uses Strategy Tester
-> reads semantic results
-> screenshots chart
-> evaluates visual result
```

### Workflow 3 — Authenticated social/business site

```text
Human logs in
-> browser preserves session
-> AI opens site
-> reads UI
-> navigates/clicks/types
-> protected credentials remain unavailable
```

## 20. Rules to prevent scope drift

1. Browser is a browser runtime, not an agent framework.
2. MCP is the public agent interface.
3. Sidebar is optional human convenience, not core reasoning.
4. Gptworker is a connector, not browser backend.
5. Local AI details belong in connector code.
6. Other provider support is third-party unless explicitly adopted later.
7. Do not add a feature just because Chrome has it.
8. Do not replace proven base code without a demonstrated MVP need.
9. Do not expose backend internals merely because they are easy to expose.
10. Optimize for reliable AI operation and minimal maintenance.

## 21. Current open decisions

- exact AgentBrowser commit/version
- exact UI framework for minimal browser shell/sidebar
- MCP transport choice inside local process/network boundary
- whether base REST/WebSocket plumbing remains internally
- first supported local AI runtime for acceptance testing
- exact version negotiation between connectors and browser MCP
- packaging/update strategy for Chromium and AI-Browser releases

## 22. Final implementation principle

> **Build the smallest standalone browser that AI can understand and operate natively. Reuse the browser machinery; write only the agent-native boundary, security, minimal UI, and connector surfaces that are actually missing.**
