# Skill — Implementation Sequencing

Turn repository evidence into an execution order for the future `coding` job.

Sequence by dependency, not by file-tree order. Typical order when applicable:
1. contract/type/schema/invariant;
2. core implementation;
3. integration/callers;
4. migrations/compatibility adapters;
5. tests;
6. docs/config/delivery updates;
7. broad validation.

Each step should identify the expected files/components/symbols, the behavior being changed, prerequisites, and the validation evidence for that step.

Keep the plan implementation-ready but not code-generating: do not embed speculative patches or large replacement code blocks. Prefer precise change instructions and existing repository references.
