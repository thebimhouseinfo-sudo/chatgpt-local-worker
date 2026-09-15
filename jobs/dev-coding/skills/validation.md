# Skill — Validation

Validation should match the risk and surface area of the change.

## Preferred ladder

1. syntax/parse check for edited language/config;
2. targeted typecheck/lint for affected package or files;
3. targeted unit/regression test;
4. affected package/module test suite;
5. repository-wide type/lint/test when practical;
6. build/package/startup smoke check when the change can affect integration or delivery.

Repository-owned scripts and documentation are authoritative. The coding harness may discover likely commands, but it must not override explicit project guidance.

## Failure handling

For each failed check, determine whether it is:

- introduced by the current diff;
- pre-existing in the working tree/base;
- environment/toolchain unavailable;
- flaky/non-deterministic;
- unrelated but still important to report.

Do not claim success for a check that was skipped, timed out, or never installed.

## Expensive checks

Start with targeted checks to shorten feedback loops. Run broader checks before final completion when cost is reasonable relative to change risk. If a full check is too expensive or unavailable, say exactly what narrower evidence was obtained instead.
