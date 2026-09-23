import fs from "node:fs/promises";
import path from "node:path";
import { readCheckpoint, hashManifest } from "./checkpoint.mjs";

const SECRET_NAME = /(^|\/)(?:\.env(?:\..+)?|[^/]+\.(?:pem|key|p12))$/i;
const SECRET_CONTENT = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
const CONFLICT = /^(?:<<<<<<<|=======|>>>>>>>) ?/m;
const SOURCE_EXT = /\.(?:[cm]?[jt]sx?|py|go|rs|java|cs|vue|svelte)$/i;
const TEST_HINT = /(?:^|\/)(?:__tests__\/|tests?\/|[^/]+\.(?:test|spec)\.)/i;
const MAX_TEXT = 1024 * 1024;
const MAX_DIFF_ENTRIES = 4000;

export async function inspectTaskDiff(workspace, taskId) {
  const root = await fs.realpath(workspace);
  const state = await readCheckpoint(root, taskId);
  const manifest = await hashManifest(root, state.scope_paths);
  const baseline = new Map(state.baseline_manifest.files.map(item => [item.path, item]));
  const now = new Map(manifest.files.map(item => [item.path, item]));
  const findings = [], changed = [], checklist = [];
  const fail = (rule, file, detail) => findings.push({ rule, file, detail, severity: "error" });
  const observe = (rule, ok, detail) => checklist.push({ rule, ok, detail });
  const paths = [...new Set([...baseline.keys(), ...now.keys()])].sort();
  if (paths.length > MAX_DIFF_ENTRIES) throw new Error("SCOPE_DENIED: diff scope too large");
  for (const rel of paths) {
    const original = baseline.get(rel);
    const current = now.get(rel);
    const different = original?.exists !== current?.exists || original?.sha256 !== current?.sha256;
    if (!different) continue;
    const record = state.snapshots?.[rel];
    const absolute = path.join(root, ...rel.split("/"));
    changed.push({ path: rel, before: original?.sha256 ?? null, after: current?.sha256 ?? null,
      operation: !original?.exists ? "add" : !current?.exists ? "delete" : "modify" });
    if (!state.scope_paths.includes(absolute)) fail("scope", rel, "File is not in approved scope");
    if (!record || record.existed !== Boolean(original?.exists) ||
        record.before_hash !== (original?.sha256 ?? null)) {
      fail("snapshot-integrity", rel, "No matching pre-edit snapshot; diff cannot be verified");
    }
    if (SECRET_NAME.test(rel)) fail("sensitive-file", rel, "Sensitive-looking file modified");
    if (TEST_HINT.test(rel) && !current?.exists) fail("deleted-test", rel, "Existing test deleted");
    if (!current?.exists || current.size > MAX_TEXT) {
      if (current?.size > MAX_TEXT) findings.push({ rule: "manual-review", file: rel, detail: "Large file; content audit unavailable", severity: "warning" });
      continue;
    }
    const bytes = await fs.readFile(absolute);
    if (bytes.includes(0)) {
      findings.push({ rule: "manual-review", file: rel, detail: "Binary file; behavior review required", severity: "warning" });
      continue;
    }
    const text = bytes.toString("utf8");
    if (CONFLICT.test(text)) fail("conflict-marker", rel, "Unresolved merge conflict");
    if (SECRET_CONTENT.test(text)) fail("private-key", rel, "Potential private key detected");
    if (/\bdebugger\s*;/.test(text)) fail("debugger", rel, "Debugger statement remains");
    if (text.split(/\r?\n/).some(line => /[\t ]+$/.test(line))) fail("whitespace", rel, "Trailing whitespace");
    if (SOURCE_EXT.test(rel) && /\/\/\s*(?:TODO|FIXME).*disable.{0,30}(?:test|security|lint)/i.test(text))
      fail("commented-out-check", rel, "Potentially disabled validation");
    if (TEST_HINT.test(rel) && original?.exists && original.sha256 !== current.sha256) {
      findings.push({ rule: "test-integrity", file: rel,
        detail: "Changed test requires preserved previous test hash and renewed red-green/negative-control evidence",
        severity: "warning" });
    }
  }
  observe("scope", !findings.some(f => f.rule === "scope"), "Every change must remain in approved scope");
  observe("snapshots", !findings.some(f => f.rule === "snapshot-integrity"), "All changed files must have original snapshots");
  observe("static-safety", !findings.some(f => f.severity === "error"), "No statically detectable unsafe change");
  observe("manual-behavioral-review", false, "Caller impact, test strength and acceptance alignment require explicit evidence");
  const errors = findings.filter(f => f.severity === "error");
  return { ok: errors.length === 0, complete: false, task_id: taskId,
    baseline_fingerprint: state.baseline_manifest.fingerprint,
    current_fingerprint: manifest.fingerprint,
    scope_paths: state.scope_paths, changed, findings, checklist,
    note: "Static snapshot review only. Never label DIFF_REVIEW PASS until manual behavioral checklist evidence is also bound to this fingerprint." };
}
