# Quarantined post-edit hook compatibility chain

This directory preserves the retired Local Coder post-edit hook implementation temporarily before hard deletion.

Quarantined files:
- `post-edit-hooks.ts`
- `edit-enrichment.ts`
- `post-edit-hooks.json`

GPTWorker currently does not use post-edit command hooks. The active filesystem mutation flow remains:

`workspace validation -> checkpoint -> mutation -> audit -> tool result`

No checkpoint, audit, workspace-boundary, Job, or work-tool behavior is provided by these quarantined files.

Hard-delete only after the default test suite and runtime acceptance pass without this compatibility chain.
