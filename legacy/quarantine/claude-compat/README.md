# Quarantined Claude compatibility modules

These files are temporarily quarantined from the active GPTWorker runtime before hard deletion.

Quarantined modules:
- `skills-loader.ts` — legacy workspace `.claude/skills/**/SKILL.md` loader.
- `path-rules.ts` — legacy workspace `.claude/rules/*.md` loader.

The active GPTWorker Job Pack system under `jobs/**` does not depend on these modules.

While quarantined:
- the active runtime no longer imports these modules;
- `list_skills`, `load_skill`, and `load_path_rules` are removed from the context/work-tool registry;
- `project_context` and `agent_status` remain active.

Hard-delete only after build, Job validation, automated tests, and runtime acceptance confirm no dependency.
