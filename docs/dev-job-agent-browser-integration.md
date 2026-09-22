# Dev Job — Vercel Agent Browser Integration Plan

Status: **Draft**

## 1. Goal

Integrate **vercel-labs/agent-browser** into GPTWorker so Dev Job can preview and interact with web applications directly during implementation.

Primary use case:

```text
AI edits code
-> runs local app
-> opens localhost with agent-browser
-> reads snapshot / screenshot
-> clicks/types/scrolls if needed
-> verifies the UI/result
-> fixes code
-> repeats
```

The purpose is to reduce the current loop where AI modifies code but a human must open an external browser, inspect the result, and report problems back.

This is **not** a plan to build a new browser UI or fork agent-browser into a standalone end-user browser.

## 2. Integration principle

Use **vercel-labs/agent-browser as an upstream dependency/tool**, not as code to rewrite.

Keep its existing browser automation, snapshot, screenshot, interaction, session, and MCP capabilities intact unless a concrete integration issue requires a local compatibility fix.

GPTWorker should integrate its MCP tools into the backend and expose them conditionally.

## 3. Setup flow

Update the existing Windows setup flow in `setup.bat`.

During first-time setup, ask the user whether they want browser automation support for Dev Job.

Example:

```text
Install optional agent-browser support for Dev Job? [Y/N]
```

### If YES

Run the **official upstream installation commands for vercel-labs/agent-browser**.

Do not invent a separate installer when the upstream installer already exists.

After install:

1. verify the executable/package is available;
2. run the upstream verification/doctor command if provided;
3. persist a GPTWorker configuration flag indicating browser support is enabled;
4. record the resolved executable/command path when needed.

### If NO

1. skip all agent-browser installation commands;
2. persist browser support as disabled;
3. continue GPTWorker setup normally.

The user can enable/install it later through setup/update flow.

## 4. Runtime capability gate

The agent-browser MCP integration may exist in GPTWorker code at all times, but the tools must only be registered/exposed when browser support is enabled and available.

Runtime rule:

```text
configured enabled?
      |
      +-- no --> browser tools OFF
      |
      +-- yes
            |
            v
agent-browser available/healthy?
      |
      +-- no --> tools OFF + clear diagnostic
      |
      +-- yes --> register browser MCP tools
```

If the user chose **NO** during setup:

- browser MCP tools are not registered;
- ChatGPT does not see them;
- Dev Job cannot call them;
- runtime must not silently install agent-browser.

If the user chose **YES** and validation succeeds:

- browser MCP tools are registered;
- Dev Job may use them when appropriate.

## 5. GPTWorker backend integration

Integrate the **Vercel agent-browser MCP tools** into the GPTWorker backend.

GPTWorker owns:

- capability detection;
- enable/disable gate;
- MCP registration/exposure;
- lifecycle/health checks as needed;
- routing tool calls from ChatGPT to agent-browser;
- concise failure reporting.

GPTWorker does **not** own:

- browser automation implementation;
- page snapshot implementation;
- screenshot implementation;
- click/type/scroll logic;
- agent-browser internal session logic.

Those remain upstream responsibilities.

## 6. Dev Job behavior

Dev Job should treat browser automation as an optional capability.

When available, use it for tasks where visual/browser validation materially improves correctness, especially:

- frontend/UI changes;
- responsive layout work;
- web app flows;
- localhost preview;
- forms and navigation;
- browser-visible regressions;
- visual verification after implementation.

Typical workflow:

```text
implement
-> start dev server
-> browser open localhost
-> snapshot
-> interact
-> screenshot when visual inspection is needed
-> verify acceptance result
-> fix if required
-> rerun validation
```

Do not require agent-browser for backend-only or non-web tasks.

## 7. Dev Job fallback behavior

If browser automation is unavailable:

- continue using the normal Dev Job workflow;
- do not fail unrelated coding work;
- report that browser/UI self-verification was unavailable when relevant;
- do not pretend visual validation was performed;
- do not auto-install the dependency during the job.

## 8. Tool visibility rule

Tool exposure must reflect actual runtime capability.

Do not expose browser tools to the model when they cannot execute.

This avoids:

- dead tool calls;
- confusing retries;
- accidental dependency installation attempts;
- false assumptions that UI validation is available.

## 9. Security and scope

Agent-browser is introduced for development preview and browser interaction.

Initial integration should:

- prefer localhost/project preview use;
- avoid exposing credentials/secrets through logs or tool responses;
- preserve existing GPTWorker path/workspace safety rules;
- avoid unrelated browser-product features;
- avoid adding a browser GUI, sidebar, or consumer browser functionality.

Authenticated external-site automation can be evaluated separately if it becomes a real Dev Job requirement.

## 10. Implementation tasks

### Task A — Confirm upstream install contract

- identify the official install command(s);
- identify the official verification/doctor command;
- identify how its MCP server/tools are launched/exposed;
- record minimum supported upstream version.

### Task B — Update `setup.bat`

- add Y/N optional install prompt;
- on YES, execute official upstream install commands;
- verify install;
- save enabled state;
- on NO, save disabled state and skip install.

### Task C — Add backend capability gate

- read enabled/disabled config;
- detect agent-browser availability;
- perform lightweight health/version validation;
- expose tools only when both config and runtime availability pass.

### Task D — Register existing agent-browser MCP tools

- connect existing upstream MCP tools to GPTWorker backend;
- avoid reimplementing their behavior;
- normalize only what GPTWorker routing requires.

### Task E — Dev Job integration

- document browser capability in Dev Job;
- teach the job to use it for web/UI validation when available;
- keep browser use optional;
- ensure no browser capability is assumed when tools are absent.

### Task F — Acceptance tests

Validate both setup branches.

#### Install = NO

- GPTWorker installs normally;
- no agent-browser install occurs;
- browser tools are not registered;
- Dev Job still works normally.

#### Install = YES

- official install succeeds;
- verification succeeds;
- browser tools register;
- Dev Job can:
  - start/open a localhost app;
  - obtain a snapshot;
  - click/type/scroll;
  - request screenshot;
  - verify a visible UI result.

#### Broken/missing dependency after enabled config

- GPTWorker starts;
- browser tools remain disabled;
- diagnostic is clear;
- unrelated jobs continue to work.

## 11. Acceptance goal

The integration is complete when Dev Job can autonomously perform this loop when agent-browser support is installed:

```text
code
-> run
-> preview
-> inspect
-> interact
-> visually verify
-> fix
```

while users who decline the optional dependency see no browser tools and no impact on normal GPTWorker operation.

## 12. Final rule

> **Integrate upstream agent-browser; do not rebuild it. Setup decides whether the optional dependency is installed. Runtime decides whether the tools are exposed. Dev Job only consumes the capability when it exists.**
