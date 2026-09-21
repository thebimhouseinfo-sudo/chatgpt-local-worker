# Runtime cleanup quarantine

Temporary holding area before hard deletion.

- `permissions.ts` — obsolete no-op permission abstraction.
- `stop.ps1` — old standalone port killer; current lifecycle uses tray/reset-runtime.
- `chatgpt-connector-description.txt` — unused connector-description draft.
- `.gptworker-driver-epoch` — unreferenced repository marker.

Do not restore these paths unless a concrete active caller/workflow is identified. Hard-delete after active runtime validation.
