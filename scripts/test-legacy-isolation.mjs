/**
 * Hard guard: legacy/** is quarantine only and must never participate in
 * GPTWorker build/runtime, startup scripts, package scripts, or Job Packs.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const legacyRoot = path.join(root, "legacy");

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir, predicate = () => true) {
  const out = [];
  if (!(await exists(dir))) return out;
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...await walk(full, predicate));
    } else if (predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function pointsIntoLegacy(specifier) {
  const normalized = specifier.replace(/\\/g, "/");
  return (
    normalized === "legacy" ||
    normalized.startsWith("legacy/") ||
    /(^|\/)\.\.\/legacy(?:\/|$)/.test(normalized) ||
    /(^|\/)legacy(?:\/|$)/.test(normalized)
  );
}

function moduleSpecifiers(source) {
  const found = [];
  const patterns = [
    /\b(?:import|export)\s+(?:[^"'()]*?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.push(match[1]);
  }
  return found;
}

const failures = [];

const tsconfig = JSON.parse(await fs.readFile(path.join(root, "tsconfig.json"), "utf8"));
if (tsconfig.compilerOptions?.rootDir !== "./src") {
  failures.push("tsconfig compilerOptions.rootDir must remain ./src");
}
if (!Array.isArray(tsconfig.include) || !tsconfig.include.includes("src/**/*")) {
  failures.push("tsconfig must explicitly include src/**/*");
}
if (!Array.isArray(tsconfig.exclude) || !tsconfig.exclude.includes("legacy")) {
  failures.push("tsconfig must explicitly exclude legacy");
}

const sourceFiles = await walk(
  path.join(root, "src"),
  (file) => /\.(?:ts|tsx|js|mjs|cjs)$/.test(file)
);
for (const file of sourceFiles) {
  const source = await fs.readFile(file, "utf8");
  for (const specifier of moduleSpecifiers(source)) {
    if (pointsIntoLegacy(specifier)) {
      failures.push(`${rel(file)} imports quarantined legacy module: ${specifier}`);
    }
  }
}

const distLegacy = path.join(root, "dist", "legacy");
if (await exists(distLegacy)) {
  failures.push("dist/legacy exists; quarantined files must never be emitted into build output");
}

const distFiles = await walk(
  path.join(root, "dist"),
  (file) => /\.(?:js|mjs|cjs)$/.test(file)
);
for (const file of distFiles) {
  const source = await fs.readFile(file, "utf8");
  for (const specifier of moduleSpecifiers(source)) {
    if (pointsIntoLegacy(specifier)) {
      failures.push(`${rel(file)} references quarantined legacy module: ${specifier}`);
    }
  }
}

const packageJson = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
for (const [name, command] of Object.entries(packageJson.scripts ?? {})) {
  if (/legacy[\\/]/i.test(String(command))) {
    failures.push(`package script '${name}' references legacy/: ${command}`);
  }
}
for (const field of ["main"]) {
  if (/legacy[\\/]/i.test(String(packageJson[field] ?? ""))) {
    failures.push(`package.json ${field} points into legacy/`);
  }
}
for (const [name, target] of Object.entries(packageJson.bin ?? {})) {
  if (/legacy[\\/]/i.test(String(target))) {
    failures.push(`package bin '${name}' points into legacy/`);
  }
}

const startupFiles = (await fs.readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /\.(?:ps1|bat|vbs)$/i.test(entry.name))
  .map((entry) => path.join(root, entry.name));
for (const file of startupFiles) {
  const source = await fs.readFile(file, "utf8");
  if (/legacy[\\/]/i.test(source)) {
    failures.push(`${rel(file)} references legacy/; startup/runtime scripts may not use quarantine files`);
  }
}

const jobFiles = await walk(path.join(root, "jobs"), (file) => !/\.(?:png|jpg|jpeg|gif|webp|pdf|zip)$/i.test(file));
for (const file of jobFiles) {
  let source = "";
  try {
    source = await fs.readFile(file, "utf8");
  } catch {
    continue;
  }
  if (/legacy[\\/]/i.test(source)) {
    failures.push(`${rel(file)} references legacy/; Job Packs may not use quarantine files`);
  }
}

if (failures.length) {
  console.error("Legacy quarantine isolation FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("test-legacy-isolation: ok — legacy/** is excluded from build/runtime");
