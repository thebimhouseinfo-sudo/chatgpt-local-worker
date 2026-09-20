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

The first-use commands `@gptworker` and `gptworker/` are text-only steps after screenshot 4.

Keep these filenames stable when replacing screenshots so `docs/setup-guide/index.html` does not need code changes.
