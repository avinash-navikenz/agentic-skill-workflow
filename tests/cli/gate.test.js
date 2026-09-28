"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const init = require("../../cli/commands/init");
const propose = require("../../cli/commands/propose");
const gate = require("../../cli/commands/gate");
const { readState } = require("../../cli/lib/state");
const { readEvents } = require("../../cli/lib/events");

function repo(lane = "standard") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nd-gate-"));
  init.run([], root, () => {});
  propose.run(["c", "--lane", lane], root, () => {});
  fs.writeFileSync(path.join(root, "evidence.md"), "proof");
  return root;
}

test("a passing gate is recorded in state and events", () => {
  const root = repo();
  assert.strictEqual(gate.run(["G2", "--pass", "--evidence", "evidence.md"], root, () => {}), 0);
  assert.strictEqual(readState(root).gates.G2, "pass");
  const evts = readEvents(root);
  assert.strictEqual(evts.at(-1).gate, "G2");
  assert.strictEqual(evts.at(-1).verdict, "pass");
});

test("a gate outside the lane's set is refused", () => {
  const root = repo("express");
  const lines = [];
  assert.strictEqual(gate.run(["G4", "--pass", "--evidence", "evidence.md"], root, (s) => lines.push(s)), 1);
  assert.match(lines.join("\n"), /G4 is not in lane 'express'/);
  assert.match(lines.join("\n"), /G2, G6, G7/);
  assert.strictEqual(readState(root).gates.G4, undefined);
});

test("a pass without evidence is refused", () => {
  const root = repo();
  const lines = [];
  assert.strictEqual(gate.run(["G2", "--pass"], root, (s) => lines.push(s)), 1);
  assert.match(lines.join("\n"), /--evidence is required/);
});

test("a pass citing a missing evidence file is refused", () => {
  const root = repo();
  const lines = [];
  assert.strictEqual(gate.run(["G2", "--pass", "--evidence", "nope.md"], root, (s) => lines.push(s)), 1);
  assert.match(lines.join("\n"), /evidence file not found/);
});

test("a failing gate marks downstream artifacts stale", () => {
  const root = repo();
  gate.run(["G2", "--pass", "--evidence", "evidence.md"], root, () => {});
  gate.run(["G6", "--fail", "--evidence", "evidence.md"], root, () => {});
  const s = readState(root);
  assert.strictEqual(s.gates.G6, "fail");
  assert.ok(s.stale.length > 0, "a failed gate must mark downstream work stale");
});

test("a waiver requires a reason and an expiry and is written to waivers.md", () => {
  const root = repo();
  assert.strictEqual(gate.run(["G3", "--waive", "no arch impact"], root, () => {}), 1);
  assert.strictEqual(
    gate.run(["G3", "--waive", "no arch impact", "--expires", "2026-12-31"], root, () => {}), 0);
  const text = fs.readFileSync(path.join(root, "delivery", ".adlc", "waivers.md"), "utf8");
  assert.match(text, /no arch impact/);
  assert.match(text, /2026-12-31/);
  assert.strictEqual(readEvents(root).at(-1).verdict, "waived");
});

// --- Controller ruling: --expires must be a real, strictly-future calendar date. ---

test("a waiver with an unparseable expiry is refused and records nothing", () => {
  const root = repo();
  const waiversFile = path.join(root, "delivery", ".adlc", "waivers.md");
  const before = fs.readFileSync(waiversFile, "utf8");
  const lines = [];
  assert.strictEqual(gate.run(["G3", "--waive", "no arch impact", "--expires", "soon"], root, (s) => lines.push(s)), 1);
  assert.match(lines.join("\n"), /--expires/);
  assert.strictEqual(readState(root).gates.G3, undefined);
  assert.strictEqual(readEvents(root).length, 0);
  assert.strictEqual(fs.readFileSync(waiversFile, "utf8"), before, "waivers.md must be unchanged when the expiry is rejected");
});

test("a waiver with a calendar-invalid expiry (2026-02-30) is refused", () => {
  const root = repo();
  const lines = [];
  assert.strictEqual(gate.run(["G3", "--waive", "reason", "--expires", "2026-02-30"], root, (s) => lines.push(s)), 1);
  assert.match(lines.join("\n"), /not a real calendar date/);
});

test("a waiver with an out-of-range month (2026-13-01) is refused", () => {
  const root = repo();
  const lines = [];
  assert.strictEqual(gate.run(["G3", "--waive", "reason", "--expires", "2026-13-01"], root, (s) => lines.push(s)), 1);
  assert.match(lines.join("\n"), /not a real calendar date/);
});

test("a waiver with an expiry that is today is refused (not strictly future)", () => {
  const root = repo();
  const today = new Date().toISOString().slice(0, 10);
  const lines = [];
  assert.strictEqual(gate.run(["G3", "--waive", "reason", "--expires", today], root, (s) => lines.push(s)), 1);
  assert.match(lines.join("\n"), /strictly in the future/);
});

test("a waiver with a past expiry is refused", () => {
  const root = repo();
  const lines = [];
  assert.strictEqual(gate.run(["G3", "--waive", "reason", "--expires", "2020-01-01"], root, (s) => lines.push(s)), 1);
  assert.match(lines.join("\n"), /strictly in the future/);
});

// --- Four paths the brief's tests do not cover ---

test("gate run with no active change is refused, not crashed", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nd-gate-"));
  init.run([], root, () => {});
  const lines = [];
  assert.strictEqual(gate.run(["G2", "--pass", "--evidence", "evidence.md"], root, (s) => lines.push(s)), 1);
  assert.match(lines.join("\n"), /no active change/);
});

test("--pass and --fail together are refused", () => {
  const root = repo();
  const lines = [];
  assert.strictEqual(
    gate.run(["G2", "--pass", "--fail", "--evidence", "evidence.md"], root, (s) => lines.push(s)), 1);
  assert.match(lines.join("\n"), /exactly one of --pass or --fail/);
  assert.strictEqual(readState(root).gates.G2, undefined);
});

test("re-recording a gate that already has a verdict logs the transition rather than silently overwriting it", () => {
  const root = repo();
  assert.strictEqual(gate.run(["G2", "--fail", "--evidence", "evidence.md"], root, () => {}), 0);
  const lines = [];
  assert.strictEqual(gate.run(["G2", "--pass", "--evidence", "evidence.md"], root, (s) => lines.push(s)), 0);
  assert.strictEqual(readState(root).gates.G2, "pass");
  const evts = readEvents(root);
  assert.strictEqual(evts.length, 2);
  assert.strictEqual(evts[0].verdict, "fail");
  assert.strictEqual(evts[0].previous, undefined);
  assert.strictEqual(evts[1].verdict, "pass");
  assert.strictEqual(evts[1].previous, "fail");
  assert.match(lines.join("\n"), /re-recorded/);
  assert.match(lines.join("\n"), /fail.*pass/);
});

test("a waiver on a gate outside the lane's set is refused", () => {
  const root = repo("express");
  const lines = [];
  assert.strictEqual(
    gate.run(["G4", "--waive", "reason", "--expires", "2026-12-31"], root, (s) => lines.push(s)), 1);
  assert.match(lines.join("\n"), /G4 is not in lane 'express'/);
  assert.strictEqual(readState(root).gates.G4, undefined);
  assert.strictEqual(readEvents(root).length, 0);
});
