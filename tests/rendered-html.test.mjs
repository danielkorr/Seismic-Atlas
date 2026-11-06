import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const { unstable_dev } = await import("wrangler");
  const { fileURLToPath } = await import("node:url");
  const worker = await unstable_dev(fileURLToPath(new URL("../dist/server/index.js", import.meta.url)), {
      local: true,
    compatibilityDate: "2026-11-06",
    compatibilityFlags: ["nodejs_compat"],
    experimental: { disableExperimentalWarning: true },
  });
  try {
  const response = await worker.fetch("http://localhost/", { headers: { accept: "text/html" } });
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
  } finally {
    await worker.stop();
  }
});
