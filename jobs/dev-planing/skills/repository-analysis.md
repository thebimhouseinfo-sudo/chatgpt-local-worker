# Skill — Repository Analysis

Use this skill to build an evidence-backed model of the current implementation before proposing changes.

1. Identify repository root, package/module boundaries, instructions, generated areas, and test layout.
2. Find the entrypoint for the requested behavior and trace materially relevant callers/callees.
3. Inspect data contracts, public interfaces, schemas, configuration, persistence, and external integrations touched by the objective.
4. Read existing tests and nearby implementations to learn local conventions and hidden invariants.
5. Inspect git history only when it materially explains intent or compatibility constraints.
6. Record concrete evidence as file paths + symbols/sections where practical.

Do not plan around imagined architecture. If the repository does not establish a fact, label it as inference or an open question.
