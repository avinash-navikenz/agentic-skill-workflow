"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { CAPABILITIES, detectHarness } = require("../../cli/lib/capabilities");
const doctor = require("../../cli/commands/doctor");

test("every capability declares a fallback", () => {
  assert.ok(CAPABILITIES.length >= 6);
  for (const c of CAPABILITIES) {
    assert.ok(c.fallback && c.fallback.length > 0, `${c.name} has no fallback`);
  }
});

test("harness detection falls back to generic", () => {
  assert.strictEqual(detectHarness({ CLAUDECODE: "1" }), "claude-code");
  assert.strictEqual(detectHarness({}), "generic");
});

test("doctor exits 0 and names the harness", () => {
  const lines = [];
  const code = doctor.run([], process.cwd(), (s) => lines.push(s));
  assert.strictEqual(code, 0);
  assert.ok(lines.join("\n").includes("harness:"));
});

test("registry/capabilities.json: every entry has a non-empty fallback string", () => {
  // Read the source-of-truth JSON directly, independent of the module that
  // wraps it, so drift between the file and the loader is caught either way.
  const registryPath = path.join(__dirname, "../../registry/capabilities.json");
  const raw = JSON.parse(require("node:fs").readFileSync(registryPath, "utf8"));
  assert.ok(Array.isArray(raw) && raw.length >= 6);
  for (const c of raw) {
    assert.ok(
      typeof c.fallback === "string" && c.fallback.length > 0,
      `${c.name} has no fallback`
    );
  }
});
