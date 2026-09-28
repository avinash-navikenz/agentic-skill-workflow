"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const init = require("../../cli/commands/init");
const propose = require("../../cli/commands/propose");
const { readState } = require("../../cli/lib/state");

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nd-prop-"));
  init.run([], root, () => {});
  return root;
}

// See tests/cli/init.test.js for the full reasoning: mutating the
// repository's own shipped templates/ tree is unsafe under node:test's
// default per-file parallelism, so tests that need to provoke a
// missing/bad-template failure operate on a disposable copy instead, via
// the NAVI_DELIVERY_TEMPLATES override — restored afterwards so no test
// leaks the override to another test in this file.
function withTemplatesOverride(fn) {
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), "nd-templates-"));
  fs.cpSync(path.join(__dirname, "..", "..", "templates"), copy, { recursive: true });
  const prev = process.env.NAVI_DELIVERY_TEMPLATES;
  process.env.NAVI_DELIVERY_TEMPLATES = copy;
  try {
    fn(copy);
  } finally {
    if (prev === undefined) delete process.env.NAVI_DELIVERY_TEMPLATES;
    else process.env.NAVI_DELIVERY_TEMPLATES = prev;
  }
}

test("propose creates the change folder and records lane", () => {
  const root = repo();
  assert.strictEqual(propose.run(["add-dark-mode", "--lane", "standard"], root, () => {}), 0);
  const dir = path.join(root, "delivery", "changes", "add-dark-mode");
  for (const f of ["proposal.md", "tasks.md", "handoffs.md"]) {
    assert.ok(fs.existsSync(path.join(dir, f)), `missing ${f}`);
  }
  const s = readState(root);
  assert.strictEqual(s.change, "add-dark-mode");
  assert.strictEqual(s.lane, "standard");
  assert.strictEqual(s.phase, 1);
});

test("proposal.md records the lane and its gate set", () => {
  const root = repo();
  propose.run(["x", "--lane", "express"], root, () => {});
  const text = fs.readFileSync(path.join(root, "delivery", "changes", "x", "proposal.md"), "utf8");
  assert.match(text, /lane: express/);
  assert.match(text, /G2 · G6 · G7/);
});

test("an unknown lane is rejected and lists the valid ones", () => {
  const root = repo();
  const lines = [];
  assert.strictEqual(propose.run(["x", "--lane", "standrd"], root, (s) => lines.push(s)), 1);
  assert.match(lines.join("\n"), /unknown lane 'standrd'/);
  assert.match(lines.join("\n"), /express, standard, full, hotfix/);
  assert.ok(!fs.existsSync(path.join(root, "delivery", "changes", "x")));
});

test("a duplicate change name is refused", () => {
  const root = repo();
  propose.run(["dup", "--lane", "full"], root, () => {});
  assert.strictEqual(propose.run(["dup", "--lane", "full"], root, () => {}), 1);
});

// --- Controller ruling 1: change name must be a safe slug ---

test("a name with .. path traversal is rejected and creates nothing", () => {
  const root = repo();
  const lines = [];
  assert.strictEqual(propose.run(["../../evil", "--lane", "full"], root, (s) => lines.push(s)), 1);
  assert.match(lines.join("\n"), /invalid change name/i);
  assert.ok(!fs.existsSync(path.join(root, "delivery", "changes", "evil")));
  assert.ok(!fs.existsSync(path.join(path.dirname(path.dirname(root)), "evil")));
});

test("a name with a slash is rejected and creates nothing anywhere", () => {
  const root = repo();
  const lines = [];
  assert.strictEqual(propose.run(["foo/bar", "--lane", "full"], root, (s) => lines.push(s)), 1);
  assert.match(lines.join("\n"), /invalid change name/i);
  assert.ok(!fs.existsSync(path.join(root, "delivery", "changes", "foo")));
  assert.ok(!fs.existsSync(path.join(root, "foo")));
});

test("a bare '..' name is rejected and creates nothing", () => {
  const root = repo();
  const lines = [];
  assert.strictEqual(propose.run(["..", "--lane", "full"], root, (s) => lines.push(s)), 1);
  assert.match(lines.join("\n"), /invalid change name/i);
  // ".." would resolve to the parent of delivery/changes — assert that
  // nothing new was created under delivery/changes (init already creates
  // the "archive" subdirectory).
  const changesDir = path.join(root, "delivery", "changes");
  assert.deepStrictEqual(fs.readdirSync(changesDir), ["archive"]);
});

// --- Controller ruling 2: missing lane value vs invalid lane value ---

test("--lane with no value after it is a distinct, readable error", () => {
  const root = repo();
  const lines = [];
  assert.strictEqual(propose.run(["x", "--lane"], root, (s) => lines.push(s)), 1);
  assert.doesNotMatch(lines.join("\n"), /unknown lane 'undefined'/);
  assert.match(lines.join("\n"), /--lane/);
  assert.ok(!fs.existsSync(path.join(root, "delivery", "changes", "x")));
});

// --- Additional tests the brief omits ---

test("propose with no arguments at all prints usage and fails", () => {
  const root = repo();
  const lines = [];
  assert.strictEqual(propose.run([], root, (s) => lines.push(s)), 1);
  assert.match(lines.join("\n"), /usage/i);
});

test("propose <name> with no --lane flag prints usage and fails", () => {
  const root = repo();
  const lines = [];
  assert.strictEqual(propose.run(["x"], root, (s) => lines.push(s)), 1);
  assert.match(lines.join("\n"), /usage/i);
  assert.ok(!fs.existsSync(path.join(root, "delivery", "changes", "x")));
});

// --- Fix round 1: template preflight, mirroring init's ---

test("propose with a template path that is a directory (not a file) creates nothing and fails clearly", () => {
  const root = repo();
  withTemplatesOverride((templatesCopy) => {
    const proposalTemplate = path.join(templatesCopy, "change", "proposal.md");
    fs.rmSync(proposalTemplate);
    fs.mkdirSync(proposalTemplate); // stand-in: a directory where a file is expected
    const lines = [];
    const code = propose.run(["x", "--lane", "full"], root, (s) => lines.push(s));
    assert.strictEqual(code, 1);
    assert.ok(lines.join("\n").includes("proposal.md"), "error should name the offending template");
    assert.ok(!fs.existsSync(path.join(root, "delivery", "changes", "x")), "changes/x must not exist after a failed propose");
  });
});
