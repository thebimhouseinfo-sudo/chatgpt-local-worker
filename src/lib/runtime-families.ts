export const RUNTIME_FAMILIES = [
  "filesystem",
  "shell",
  "git",
  "context",
  "repl",
] as const;

export type RuntimeFamily = (typeof RUNTIME_FAMILIES)[number];

export const JOB_PRELOAD_FAMILIES = [...RUNTIME_FAMILIES] as const;

export type JobPreloadFamily = (typeof JOB_PRELOAD_FAMILIES)[number];
