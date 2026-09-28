const { test } = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const pkg = require("../../package.json");

test("--version prints package version", () => {
  const out = execFileSync("node", ["cli/index.js", "--version"], { encoding: "utf8" });
  assert.strictEqual(out.trim(), pkg.version);
});
