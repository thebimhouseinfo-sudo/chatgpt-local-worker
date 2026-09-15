# Skill — Performance & Resource Use

Use when the task is performance-related or changes hot loops, large data paths, network/database round trips, caching, rendering, startup, or memory-sensitive code.

## Measure before optimizing

Establish a baseline or reproducible symptom when practical. Identify the constrained resource: latency, throughput, CPU, memory, I/O, allocations, network calls, queries, bundle size, or startup.

Do not optimize speculative micro-costs while ignoring dominant work.

## Change discipline

Preserve correctness first. Prefer algorithm/query/I/O reductions over clever micro-optimizations. Avoid unbounded caches/queues/buffers. Consider worst-case input size and concurrency. Preserve cancellation/timeouts/backpressure. Watch for N+1 calls and repeated parsing/serialization in hot paths.

## Evidence

Use repository benchmark/profiler tooling when available. Compare before/after under equivalent conditions and report the measured dimension. If not measured, label the expected improvement as a hypothesis, not a proven gain.
