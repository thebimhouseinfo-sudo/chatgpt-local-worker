# Skill — Testing Strategy

Use when behavior changes, bugs are fixed, interfaces change, or regression risk is non-trivial.

## Choose the smallest test that proves behavior

Prefer:

1. existing targeted test closest to the behavior;
2. focused regression/unit test;
3. affected module/package suite;
4. integration/e2e when behavior crosses real boundaries;
5. repository-wide suite when appropriate.

Do not use an expensive integration test for behavior provable locally, and do not mock away the boundary that is actually under test.

## Bug fixes

When practical: reproduce → add/identify a test that fails for the old behavior → make the causal fix → prove the regression test passes → run adjacent checks.

A test that never failed against the buggy state is weaker evidence and should not be described as regression proof.

## Test quality

Tests should assert meaningful behavior/invariants, cover important edge/error paths, remain deterministic, avoid arbitrary sleeps when deterministic synchronization exists, and reuse repository fixtures/helpers.

Never weaken assertions, skip tests, broaden mocks, or update snapshots merely to make CI green without verifying the behavior intentionally changed.

## When tests are unavailable

Use the strongest available evidence: compiler/typecheck, parser, build, focused command, deterministic reproduction, or documented manual check. Report the gap explicitly.
