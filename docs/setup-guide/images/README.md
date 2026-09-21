# Setup guide images

The visual setup guide uses these screenshots:

- `1.png` — open ChatGPT Settings → Plugins
- `2.png` — enable Developer mode
- `3.png` — open Plugins and click `+` to create a new plugin
- `4.png` — configure the GPTWorker plugin:
  - Name: `gptworker`
  - Connection: `Tunnel`
  - choose the GPTWorker Tunnel from `Available tunnels`
  - Authentication: `No Auth`
  - do not use Server URL or `Use tunnel ID instead`
- `5.png` — after restarting Windows, open ChatGPT, invoke `@gptworker`, then type `gr/help` (or `gptworker/help`) and read the usage guide before the first Job.

Restarting Windows after setup is part of the onboarding flow because GPTWorker is registered to auto-start with the current Windows user.

Keep these filenames stable when replacing screenshots so `docs/setup-guide/index.html` does not need code changes.
