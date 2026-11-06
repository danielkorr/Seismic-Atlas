#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

worker="${SITES_PROJECT_ROOT}/dist/server/index.js"
hosting="${SITES_PROJECT_ROOT}/dist/.openai/hosting.json"

[[ -f "${worker}" ]] || {
  echo "Missing Sites Worker entry: dist/server/index.js" >&2
  exit 66
}
[[ -f "${hosting}" ]] || {
  echo "Missing packaged Sites manifest: dist/.openai/hosting.json" >&2
  exit 66
}

node --input-type=module - "${worker}" "${hosting}" <<'NODE'
import { readFile } from "node:fs/promises";


const [workerPath, hostingPath] = process.argv.slice(2);
JSON.parse(await readFile(hostingPath, "utf8"));

const { unstable_dev } = await import("wrangler");
const worker = await unstable_dev(workerPath, {
  config: "dist/server/wrangler.json",
  local: true,
  compatibilityDate: "2026-11-06",
  compatibilityFlags: ["nodejs_compat"],
  experimental: { disableExperimentalWarning: true },
});
try {
  const response = await worker.fetch("http://localhost/", { headers: { accept: "text/html" } });
  if (response.status !== 200) throw new Error(`Worker returned ${response.status}`);
  if (!(response.headers.get("content-type") ?? "").startsWith("text/html")) throw new Error("Worker did not return HTML");
} finally {
  await worker.stop();
}
NODE

echo "Validated Sites artifact: ESM Worker default.fetch and hosting manifest are present."
