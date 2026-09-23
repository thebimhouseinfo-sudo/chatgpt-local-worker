import { applyUnifiedPatchToText, isMultiFilePatch } from "../dist/lib/patch.js";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`OK  ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL ${name}: ${err.message}`);
    failed++;
  }
}

test("codex-style patch without line numbers", () => {
  const original = "def fib(n):\n    if n <= 1:\n        return n\n    return fib(n-1) + fib(n-2)\n";
  const patch = "@@\n-def fib(n):\n+def fibonacci(n):\n     if n <= 1:\n";
  const result = applyUnifiedPatchToText(original, patch);
  if (!result.includes("def fibonacci(n):")) throw new Error("rename not applied");
  if (result.includes("def fib(n):")) throw new Error("old name still present");
});

test("unified diff with line numbers", () => {
  const original = "line1\nline2\nline3\nline4\n";
  const patch = "@@ -2,2 +2,3 @@\n line2\n-line3\n+new\n+extra\n";
  const result = applyUnifiedPatchToText(original, patch);
  if (!result.includes("new")) throw new Error("replacement missing");
  if (result.includes("old")) throw new Error("old line still present");
});

test("single-file unified diff headers stay single-file", () => {
  const original = "line1\nline2\n";
  const patch = [
    "--- a/sample.txt",
    "+++ b/sample.txt",
    "@@ -1,2 +1,2 @@",
    " line1",
    "-line2",
    "+lineX",
  ].join("\n");

  if (isMultiFilePatch(patch)) {
    throw new Error("standard unified headers must not force multi-file routing");
  }

  const result = applyUnifiedPatchToText(original, patch);
  if (!result.includes("lineX")) throw new Error("unified header patch failed");
});

test("explicit GPT multi-file patch is detected", () => {
  const patch = [
    "*** Begin Patch",
    "*** Update File: sample.txt",
    "@@",
    "-old",
    "+new",
    "*** End Patch",
  ].join("\n");

  if (!isMultiFilePatch(patch)) {
    throw new Error("explicit multi-file patch was not detected");
  }
});

test("crlf preserved", () => {
  const original = "a\r\nb\r\nc\r\n";
  const patch = "@@\n-b\r\n+c2\r\n";
  const result = applyUnifiedPatchToText(original, patch);
  if (!result.includes("c2\r\n")) throw new Error("crlf patch failed");
});

test("numbered hunk rejects mismatched old lines", () => {
  const original = "line1\nline2\nline3\n";
  const patch = "@@ -2,2 +2,2 @@\n line2\n-wrong\n+replacement";
  if (!assertRejectsPatch(original, patch)) {
    throw new Error("numbered hunk silently overwrote unexpected content");
  }
});

test("unified insertion before first line", () => {
  const original = "second\\n";
  const patch = "@@ -0,0 +1,1 @@\\n+first";
  const actual = applyUnifiedPatchToText(original, patch);
  if (actual !== "first\\nsecond\\n") throw new Error("start-of-file insertion failed");
});

test("empty or malformed patch is rejected", () => {
  if (!assertRejectsPatch("a\n", "not a patch")) {
    throw new Error("malformed patch unexpectedly accepted");
  }
});

function assertRejectsPatch(original, patch) {
  try { applyUnifiedPatchToText(original, patch); return false; }
  catch { return true; }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);