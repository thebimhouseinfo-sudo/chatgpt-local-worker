# Skill — Debugging

## Debugging loop

1. **Reproduce** — obtain the error, failing test, log, stack trace, incorrect output, or deterministic user scenario.
2. **Bound** — narrow the failure to a subsystem, boundary, recent change, or data shape.
3. **Hypothesize** — write down the most likely causal explanation before changing code.
4. **Inspect** — read the code/data that would prove or disprove that explanation.
5. **Change one cause** — apply the smallest correction that addresses the evidence.
6. **Regress** — rerun the original failure first.
7. **Protect** — add/update a regression test when practical.
8. **Broaden** — run adjacent and repository-level checks appropriate to the blast radius.

## Avoid

- speculative multi-file edits before reproduction;
- swallowing exceptions without understanding them;
- increasing retries/timeouts as a first fix for deterministic bugs;
- changing tests to match broken behavior;
- assuming a dependency or environment problem without evidence.

If reproduction is impossible, clearly separate observed facts from hypotheses and reduce confidence in the final claim.
