import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const { unstable_dev } = await import("wrangler");
  const { fileURLToPath } = await import("node:url");
  const worker = await unstable_dev(fileURLToPath(new URL("../dist/server/index.js", import.meta.url)), {
      config: "dist/server/wrangler.json",
  local: true,
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
  const html = await response.text();
  assert.match(html, developmentPreviewMeta);
  assert.match(html, /<title>Cascadia — schematic location<\/title>/);
  assert.match(html, /<title>M6\.2 · Aleutian Islands, Alaska<\/title>/);
  assert.match(html, /Global M5\.0\+ earthquakes/);
  assert.match(html, /events plotted at M5\.0\+/);
  assert.match(html, /22:58:20/);
  } finally {
    await worker.stop();
  }
});
