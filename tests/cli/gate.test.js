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

// --- Fix round 1 ---

// Finding A: an omitted --waive reason must not silently borrow the next
// flag's name as the reason.
test("a waiver with the reason omitted (next token is a flag) is refused, not accepted with garbage", () => {
  const root = repo();
  const waiversFile = path.join(root, "delivery", ".adlc", "waivers.md");
  const before = fs.readFileSync(waiversFile, "utf8");
  const lines = [];
  assert.strictEqual(gate.run(["G3", "--waive", "--expires", "2026-12-31"], root, (s) => lines.push(s)), 1);
  assert.match(lines.join("\n"), /--waive requires a reason/);
  assert.strictEqual(readState(root).gates.G3, undefined);
  assert.strictEqual(readEvents(root).length, 0);
  assert.strictEqual(fs.readFileSync(waiversFile, "utf8"), before, "waivers.md must be unchanged");
});

// Finding B (+D interaction): failing then re-passing the same gate clears
// that gate's own stale entry, but leaves other stale entries alone.
test("re-passing a previously failed gate clears its own stale entry only", () => {
  const root = repo(); // standard: G1, G2, G3, G5, G6, G7, G8
  gate.run(["G2", "--pass", "--evidence", "evidence.md"], root, () => {});
  gate.run(["G6", "--fail", "--evidence", "evidence.md"], root, () => {});
  let s = readState(root);
  assert.deepStrictEqual(s.stale.slice().sort(), ["gate:G6", "gate:G7", "gate:G8"]);

  assert.strictEqual(gate.run(["G6", "--pass", "--evidence", "evidence.md"], root, () => {}), 0);
  s = readState(root);
  assert.strictEqual(s.gates.G6, "pass");
  assert.deepStrictEqual(s.stale.slice().sort(), ["gate:G7", "gate:G8"],
    "gate:G6 must clear once G6 is re-recorded as pass; G7/G8 remain until they are recorded themselves");
});

// Finding B also applies to waivers: waiving a previously failed gate
// clears its own stale entry.
test("waiving a previously failed gate clears its own stale entry", () => {
  const root = repo();
  gate.run(["G6", "--fail", "--evidence", "evidence.md"], root, () => {});
  assert.ok(readState(root).stale.includes("gate:G6"));
  assert.strictEqual(
    gate.run(["G6", "--waive", "temporary exception", "--expires", "2026-12-31"], root, () => {}), 0);
  assert.ok(!readState(root).stale.includes("gate:G6"));
});

// Finding C: a reason containing a pipe must not corrupt the Markdown table.
test("a waiver reason containing a pipe is escaped, producing a well-formed table row", () => {
  const root = repo();
  assert.strictEqual(
    gate.run(["G3", "--waive", "no risk | acceptable", "--expires", "2026-12-31"], root, () => {}), 0);
  const text = fs.readFileSync(path.join(root, "delivery", ".adlc", "waivers.md"), "utf8");
  const row = text.split("\n").find((l) => l.includes("G3"));
  assert.ok(row, "expected a waivers.md row for G3");
  assert.match(row, /^\| \d{4}-\d{2}-\d{2} \| c \| G3 \| no risk \\\| acceptable \| 2026-12-31 \| \|$/);
});

// Finding C: a reason containing a newline cannot be escaped into one row.
test("a waiver reason containing a newline is refused", () => {
  const root = repo();
  const lines = [];
  assert.strictEqual(
    gate.run(["G3", "--waive", "line one\nline two", "--expires", "2026-12-31"], root, (s) => lines.push(s)), 1);
  assert.match(lines.join("\n"), /newline/);
  assert.strictEqual(readState(root).gates.G3, undefined);
});

// Finding D: stale marking must respect the lane's own gate set, not
// ALL_GATES — express enforces only G2, G6, G7, so failing G6 there must
// never mark G8/G9 stale (they could never be recorded to clear again).
test("failing a gate on 'express' marks stale only within that lane's gate set", () => {
  const root = repo("express"); // gates: G2, G6, G7
  assert.strictEqual(gate.run(["G6", "--fail", "--evidence", "evidence.md"], root, () => {}), 0);
  const s = readState(root);
  assert.deepStrictEqual(s.stale.slice().sort(), ["gate:G6", "gate:G7"]);
});
