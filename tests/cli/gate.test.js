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
    gate.run(["G3", "--waive", "no risk | acceptable", "--expires", "2026-12-31",
              "--actor", "Dana Okonkwo"], root, () => {}), 0);
  const text = fs.readFileSync(path.join(root, "delivery", ".adlc", "waivers.md"), "utf8");
  const row = text.split("\n").find((l) => l.includes("G3"));
  assert.ok(row, "expected a waivers.md row for G3");
  // The final column was `| |` until 2c; it now carries the approver, which is
  // what the template header has always promised.
  assert.match(row, /^\| \d{4}-\d{2}-\d{2} \| c \| G3 \| no risk \\\| acceptable \| 2026-12-31 \| Dana Okonkwo \|$/);
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

// ---------------------------------------------------------------------------
// 2a — --evidence accepted anything that existed. `--evidence .`,
// `--evidence /dev/null` and an empty directory all recorded a pass, so a
// fully-archived change could be evidenced by nothing at all. Evidence must
// be a regular, non-empty file, and each way of failing gets its own message.
// ---------------------------------------------------------------------------
function refusal(root, args) {
  const lines = [];
  const code = gate.run(args, root, (s) => lines.push(s));
  return { code, out: lines.join("\n") };
}

test("evidence naming a directory is refused, and says so", () => {
  const root = repo();
  const { code, out } = refusal(root, ["G2", "--pass", "--evidence", "."]);
  assert.strictEqual(code, 1);
  assert.match(out, /not a directory/);
  assert.strictEqual(readState(root).gates.G2, undefined);
  assert.deepStrictEqual(readEvents(root).filter((e) => e.gate === "G2"), []);
});

test("evidence naming an empty directory is refused as a directory", () => {
  const root = repo();
  fs.mkdirSync(path.join(root, "empty-dir"));
  const { code, out } = refusal(root, ["G2", "--pass", "--evidence", "empty-dir"]);
  assert.strictEqual(code, 1);
  assert.match(out, /not a directory/);
});

test("evidence naming a device is refused with its own message", () => {
  const root = repo();
  const { code, out } = refusal(root, ["G2", "--pass", "--evidence", "/dev/null"]);
  assert.strictEqual(code, 1);
  assert.match(out, /must be a regular file/);
  assert.match(out, /character device/);
  assert.strictEqual(readState(root).gates.G2, undefined);
});

test("a zero-byte evidence file is refused with its own message", () => {
  const root = repo();
  fs.writeFileSync(path.join(root, "zero.md"), "");
  const { code, out } = refusal(root, ["G2", "--pass", "--evidence", "zero.md"]);
  assert.strictEqual(code, 1);
  assert.match(out, /empty \(0 bytes\)/);
  assert.strictEqual(readState(root).gates.G2, undefined);
});

test("each evidence refusal carries a distinct message", () => {
  const root = repo();
  fs.writeFileSync(path.join(root, "zero.md"), "");
  const messages = [".", "/dev/null", "zero.md", "nope.md"]
    .map((v) => refusal(root, ["G2", "--pass", "--evidence", v]).out);
  assert.strictEqual(new Set(messages).size, 4, messages.join(" | "));
});

test("a symlink resolving to a real non-empty file is accepted", () => {
  const root = repo();
  fs.symlinkSync(path.join(root, "evidence.md"), path.join(root, "link.md"));
  assert.strictEqual(gate.run(["G2", "--pass", "--evidence", "link.md"], root, () => {}), 0);
});

test("a symlink resolving to a device is refused", () => {
  const root = repo();
  fs.symlinkSync("/dev/null", path.join(root, "devlink"));
  const { code, out } = refusal(root, ["G2", "--pass", "--evidence", "devlink"]);
  assert.strictEqual(code, 1);
  assert.match(out, /must be a regular file/);
});

// ---------------------------------------------------------------------------
// 2b — gate events recorded no actor, so a log covering co-owned gates
// (G3, G6) could not say which owner recorded a verdict. The actor is derived
// with an explicit override, and its provenance is recorded alongside it.
// ---------------------------------------------------------------------------
test("a gate event records an actor and where the name came from", () => {
  const root = repo();
  assert.strictEqual(gate.run(["G2", "--pass", "--evidence", "evidence.md"], root, () => {}), 0);
  const evt = readEvents(root).at(-1);
  assert.ok(evt.actor, "no actor on the event");
  assert.ok(["flag", "env", "git", "login"].includes(evt.actor_source), evt.actor_source);
});

test("--actor wins over every derived source and is recorded as such", () => {
  const root = repo();
  gate.run(["G2", "--pass", "--evidence", "evidence.md", "--actor", "Dana Okonkwo"], root, () => {});
  const evt = readEvents(root).at(-1);
  assert.strictEqual(evt.actor, "Dana Okonkwo");
  assert.strictEqual(evt.actor_source, "flag");
});

test("a failed gate is attributed too", () => {
  const root = repo();
  gate.run(["G2", "--fail", "--evidence", "evidence.md", "--actor", "Sam Reyes"], root, () => {});
  const evt = readEvents(root).at(-1);
  assert.strictEqual(evt.verdict, "fail");
  assert.strictEqual(evt.actor, "Sam Reyes");
});

test("two owners recording the same co-owned gate are distinguishable in the log", () => {
  const root = repo();
  gate.run(["G3", "--fail", "--evidence", "evidence.md", "--actor", "architect@x"], root, () => {});
  gate.run(["G3", "--pass", "--evidence", "evidence.md", "--actor", "security@x"], root, () => {});
  const g3 = readEvents(root).filter((e) => e.gate === "G3");
  assert.deepStrictEqual(g3.map((e) => e.actor), ["architect@x", "security@x"]);
  assert.deepStrictEqual(g3.map((e) => e.verdict), ["fail", "pass"]);
});

test("--actor with no value is refused rather than borrowing the next flag", () => {
  const root = repo();
  const { code, out } = refusal(root, ["G2", "--pass", "--evidence", "evidence.md", "--actor", "--fail"]);
  assert.strictEqual(code, 1);
  assert.match(out, /--actor requires a name/);
  assert.strictEqual(readState(root).gates.G2, undefined);
});

test("the actor is resolved before anything is written, so a bad actor writes nothing", () => {
  const root = repo();
  const before = readEvents(root).length;
  refusal(root, ["G2", "--waive", "a reason", "--expires", "2030-01-01", "--actor", "--pass"]);
  assert.strictEqual(readEvents(root).length, before);
  const rows = fs.readFileSync(path.join(root, "delivery", ".adlc", "waivers.md"), "utf8")
    .split("\n").filter((l) => l.startsWith("| 2"));
  assert.deepStrictEqual(rows, [], "a waiver row was written despite the refusal");
});

// ---------------------------------------------------------------------------
// 2c — waivers emitted `| |` under a header promising "Approved by".
// ---------------------------------------------------------------------------
function waiversText(root) {
  return fs.readFileSync(path.join(root, "delivery", ".adlc", "waivers.md"), "utf8");
}

test("a waiver row populates the Approved by column", () => {
  const root = repo();
  assert.strictEqual(
    gate.run(["G3", "--waive", "vendor SLA pending", "--expires", "2030-01-01",
              "--actor", "Dana Okonkwo"], root, () => {}), 0);
  const row = waiversText(root).trim().split("\n").at(-1);
  assert.match(row, /\| Dana Okonkwo \|$/);
  assert.doesNotMatch(row, /\| \|$/);
});

test("every waiver row has a non-empty final column", () => {
  const root = repo();
  gate.run(["G3", "--waive", "one", "--expires", "2030-01-01"], root, () => {});
  gate.run(["G6", "--waive", "two", "--expires", "2030-01-01"], root, () => {});
  const rows = waiversText(root).trim().split("\n").filter((l) => l.startsWith("| 2"));
  assert.strictEqual(rows.length, 2);
  for (const row of rows) {
    const approver = row.split("|").at(-2).trim();
    assert.notStrictEqual(approver, "", `empty Approved by in: ${row}`);
  }
});

test("a waiver event records the approver and the strength of that attribution", () => {
  const root = repo();
  gate.run(["G3", "--waive", "vendor SLA pending", "--expires", "2030-01-01",
            "--actor", "Dana Okonkwo"], root, () => {});
  const evt = readEvents(root).at(-1);
  assert.strictEqual(evt.verdict, "waived");
  assert.strictEqual(evt.actor, "Dana Okonkwo");
  assert.strictEqual(evt.actor_source, "flag");
});

test("a pipe in an actor name is escaped, not left to shift the table", () => {
  const root = repo();
  gate.run(["G3", "--waive", "r", "--expires", "2030-01-01", "--actor", "a|b"], root, () => {});
  const row = waiversText(root).trim().split("\n").at(-1);
  assert.match(row, /a\\\|b/);
  assert.strictEqual(row.split(/(?<!\\)\|/).length - 1, 7);
});

test("gate with no arguments prints usage rather than 'unknown gate undefined'", () => {
  const root = repo();
  const lines = [];
  assert.strictEqual(gate.run([], root, (l) => lines.push(l)), 1);
  const out = lines.join("\n");
  assert.match(out, /usage: navi-delivery gate/);
  assert.doesNotMatch(out, /undefined/, "a JS undefined must never reach the user");
});

test("evidence named as it sits inside the change suggests the repo-root path", () => {
  const root = repo();
  const changeFile = path.join(root, "delivery", "changes", "c", "proposal.md");
  fs.writeFileSync(changeFile, "# outcome\n");
  const lines = [];
  assert.strictEqual(gate.run(["G2", "--pass", "--evidence", "proposal.md"], root, (l) => lines.push(l)), 1);
  assert.match(lines.join("\n"), /--evidence delivery\/changes\/c\/proposal\.md/,
               "the error should name the path that works");
});

test("evidence that exists nowhere names the path it looked in", () => {
  const root = repo();
  const lines = [];
  assert.strictEqual(gate.run(["G2", "--pass", "--evidence", "nope.md"], root, (l) => lines.push(l)), 1);
  const out = lines.join("\n");
  assert.match(out, /looked in .*nope\.md/);
  assert.doesNotMatch(out, /You meant/, "there is nothing to suggest when the file exists nowhere");
});
