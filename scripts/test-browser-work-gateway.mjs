import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "gptworker-browser-work-"));
const oldRoot = process.env.GPTWORKER_DATA_ROOT;
process.env.GPTWORKER_DATA_ROOT = path.join(root, "worker-data");
const registration = await import("../dist/lib/work-registration.js");
const adapter = await import("../dist/lib/browser-mcp-adapter.js");

try {
  const otherJob = await registration.createWorkRegistration("layla", root);
  const otherLease = registration.acquireToolLease("browser_open", "browser",
    otherJob.executionId, otherJob.authorityToken);
  await assert.rejects(
    adapter.runWithBrowserLease(otherLease, () => adapter.callBrowserTool("browser_open",
      { url: "http://127.0.0.1:5173/" })),
    /BROWSER_DENIED/
  );
  registration.releaseToolLease(otherLease);
  registration.releaseWorkRegistration(otherJob.executionId, otherJob.authorityToken);

  const coding = await registration.createWorkRegistration("dev-coding", root);
  const validLease = registration.acquireToolLease("browser_open", "browser",
    coding.executionId, coding.authorityToken);
  await assert.rejects(
    adapter.runWithBrowserLease(validLease, () => adapter.callBrowserTool("browser_open",
      { url: "http://127.0.0.1:5173/" })),
    /BROWSER_UNAVAILABLE/
  );
  registration.releaseToolLease(validLease);
  registration.releaseWorkRegistration(coding.executionId, coding.authorityToken);
  await assert.rejects(
    adapter.runWithBrowserLease(validLease, () => adapter.callBrowserTool("browser_open",
      { url: "http://127.0.0.1:5173/" })),
    /BROWSER_DENIED/
  );

  const injected = [
    { url: "https://example.org/" },
    { url: "http://127.0.0.1:8080/", extraArgs: ["--connect", "9222"] },
  ];
  assert.throws(() => adapter.assertApprovedBrowserUrl(injected[0].url), /BROWSER_ORIGIN_DENIED/);
  assert.equal(adapter.assertApprovedBrowserUrl(injected[1].url), "http://127.0.0.1:8080/");
  assert.equal(registration.getActiveToolLeaseCount(), 0);
  console.log("test-browser-work-gateway: ok");
} finally {
  if (oldRoot === undefined) delete process.env.GPTWORKER_DATA_ROOT;
  else process.env.GPTWORKER_DATA_ROOT = oldRoot;
  await fs.rm(root, { recursive: true, force: true });
}
