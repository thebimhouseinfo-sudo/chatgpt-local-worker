export const RUNTIME_FAMILIES = [
  "filesystem",
  "shell",
  "git",
  "context",
  "repl",
] as const;

export type RuntimeFamily = (typeof RUNTIME_FAMILIES)[number];

export const LEGACY_PRELOAD_FAMILY_NAMES = [
  "mcp",
  "ponytail",
  "rewind",
] as const;

export type LegacyPreloadFamily =
  (typeof LEGACY_PRELOAD_FAMILY_NAMES)[number];

export const JOB_PRELOAD_FAMILIES = [
  ...RUNTIME_FAMILIES,
  ...LEGACY_PRELOAD_FAMILY_NAMES,
] as const;

export type JobPreloadFamily = (typeof JOB_PRELOAD_FAMILIES)[number];
