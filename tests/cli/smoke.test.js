const { test } = require("node:test");
const assert = require("node:assert");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const pkg = require("../../package.json");

const CLI = path.resolve(__dirname, "..", "..", "cli", "index.js");

test("--version prints package version", () => {
  const out = execFileSync("node", ["cli/index.js", "--version"], { encoding: "utf8" });
  assert.strictEqual(out.trim(), pkg.version);
});

test("the binary exits non-zero when an async command fails", () => {
  // `process.exit(promise)` coerces to NaN and exits 0, so main awaits a
  // thenable result. No test drove that branch through the real binary — and an
  // entry point no test completes is exactly what hid a blocker in the cron
  // runner. A dead endpoint is the cheapest way to reach it.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nd-exit-"));
  execFileSync(process.execPath, [CLI, "init"], { cwd: root });
  execFileSync(process.execPath, [CLI, "propose", "c", "--lane", "express"], { cwd: root });
  fs.writeFileSync(path.join(root, "e.md"), "proof");
  execFileSync(process.execPath, [CLI, "gate", "G2", "--pass", "--evidence", "e.md"], { cwd: root });

  const r = spawnSync(process.execPath, [CLI, "telemetry", "export", "--backend", "agentobs"], {
    cwd: root, encoding: "utf8",
    env: { ...process.env, NAVI_AGENTOBS_ENDPOINT: "http://127.0.0.1:1/x", NAVI_AGENTOBS_INGEST_KEY: "k" },
  });
  assert.strictEqual(r.status, 1, `expected exit 1, got ${r.status}: ${r.stdout}${r.stderr}`);
  assert.match(r.stdout, /NOT sent/);
  assert.ok(fs.existsSync(path.join(root, "delivery", ".adlc", "telemetry.json")));
});
