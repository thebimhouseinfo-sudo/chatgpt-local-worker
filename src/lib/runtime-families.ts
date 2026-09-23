export const RUNTIME_FAMILIES = [
  "filesystem",
  "shell",
  "context",
  "browser",
] as const;

export type RuntimeFamily = (typeof RUNTIME_FAMILIES)[number];

// Browser must NEVER be preloaded by Job nomination or activation.
export const JOB_PRELOAD_FAMILIES = ["filesystem", "shell", "context"] as const;

export type JobPreloadFamily = (typeof JOB_PRELOAD_FAMILIES)[number];
