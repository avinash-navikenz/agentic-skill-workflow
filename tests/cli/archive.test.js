"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const init = require("../../cli/commands/init");
const propose = require("../../cli/commands/propose");
const gate = require("../../cli/commands/gate");
const archive = require("../../cli/commands/archive");
const { readState, writeState } = require("../../cli/lib/state");

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nd-arch-"));
  init.run([], root, () => {});
  return root;
}

// The shipped tasks.md template ships `Implements: REQ-001` as a placeholder,
// so a change is only traceability-clean once a delta spec introduces REQ-001
// with acceptance criteria. archive now enforces that (ruling D), which is why
// every fixture that reaches archive writes the delta spec.
function proposeNamed(root, name, lane = "express") {
  propose.run([name, "--lane", lane], root, () => {});
  const delta = path.join(root, "delivery", "changes", name, "specs", "theme");
  fs.mkdirSync(delta, { recursive: true });
  fs.writeFileSync(path.join(delta, "spec.md"), "# Theme\n## REQ-001 x\n### AC-001 y\n");
  return root;
}

function proposeC(root, lane = "express") {
  return proposeNamed(root, "c", lane);
}

function evidenceFile(root) {
  const p = path.join(root, "evidence.txt");
  if (!fs.existsSync(p)) fs.writeFileSync(p, "ok\n");
  return "evidence.txt";
}

// Records every gate in `gates` as --pass, so a lane's full requirement is
// settled and archive's gate check (ruling B) lets the change through.
function passAll(root, gates) {
  const ev = evidenceFile(root);
  for (const g of gates) {
    const rc = gate.run([g, "--pass", "--evidence", ev], root, () => {});
    assert.strictEqual(rc, 0, `expected ${g} --pass to succeed`);
  }
}

test("archive date-stamps the change and folds deltas into specs", () => {
  const root = proposeC(repo());
  passAll(root, ["G2", "G6", "G7"]); // express lane's full gate set
  assert.strictEqual(archive.run(["c"], root, () => {}), 0);
  const today = new Date().toISOString().slice(0, 10);
  assert.ok(fs.existsSync(path.join(root, "delivery", "changes", "archive", `${today}-c`)));
  assert.ok(fs.existsSync(path.join(root, "delivery", "specs", "theme", "spec.md")));
  assert.ok(!fs.existsSync(path.join(root, "delivery", "changes", "c")));
});

test("archive emits an insight stub and clears the active change", () => {
  const root = proposeC(repo());
  passAll(root, ["G2", "G6", "G7"]);
  archive.run(["c"], root, () => {});
  const post = fs.readFileSync(path.join(root, "delivery", "ops", "postmortems", "c.md"), "utf8");
  assert.match(post, /INSIGHT-001/);
  assert.match(post, /product backlog|skill amendment/);
  assert.strictEqual(readState(root).change, null);
});

test("archiving an unknown change is refused", () => {
  const root = repo();
  assert.strictEqual(archive.run(["nope"], root, () => {}), 1);
});

test("archiving with no name at all is refused, not a crash", () => {
  const root = repo();
  assert.strictEqual(archive.run([], root, () => {}), 1);
});

// --- Ruling B: archive must not bypass the gates ------------------------

test("ruling B: archive refuses when a required gate is still pending", () => {
  const root = proposeC(repo(), "standard"); // G1,G2,G3,G5,G6,G7,G8
  passAll(root, ["G1", "G2", "G3", "G5", "G6", "G7"]); // G8 left unrecorded
  const lines = [];
  const rc = archive.run(["c"], root, (l) => lines.push(l));
  assert.strictEqual(rc, 1);
  assert.match(lines.join("\n"), /G8/);
  assert.match(lines.join("\n"), /pending/);
  // Nothing on disk changed.
  assert.ok(fs.existsSync(path.join(root, "delivery", "changes", "c")));
  assert.ok(!fs.existsSync(path.join(root, "delivery", "specs", "theme")));
  assert.strictEqual(readState(root).change, "c");
});

test("ruling B: archive refuses when a required gate has failed", () => {
  const root = proposeC(repo(), "express");
  const ev = evidenceFile(root);
  gate.run(["G2", "--pass", "--evidence", ev], root, () => {});
  gate.run(["G6", "--fail", "--evidence", ev], root, () => {});
  gate.run(["G7", "--pass", "--evidence", ev], root, () => {});
  const lines = [];
  const rc = archive.run(["c"], root, (l) => lines.push(l));
  assert.strictEqual(rc, 1);
  assert.match(lines.join("\n"), /G6/);
  assert.match(lines.join("\n"), /fail/);
  assert.ok(fs.existsSync(path.join(root, "delivery", "changes", "c")));
});

test("ruling B: a waived gate counts as settled", () => {
  const root = proposeC(repo(), "express");
  const ev = evidenceFile(root);
  gate.run(["G2", "--waive", "deferred to 48h window", "--expires", "2030-01-01"], root, () => {});
  gate.run(["G6", "--pass", "--evidence", ev], root, () => {});
  gate.run(["G7", "--pass", "--evidence", ev], root, () => {});
  assert.strictEqual(archive.run(["c"], root, () => {}), 0);
});

test("ruling B: archive refuses on stale artifacts even when every gate currently reads pass", () => {
  const root = proposeC(repo(), "standard"); // G1,G2,G3,G5,G6,G7,G8
  const ev = evidenceFile(root);
  const all = ["G1", "G2", "G3", "G5", "G6", "G7", "G8"];
  passAll(root, all);
  assert.deepStrictEqual(readState(root).stale, []);

  // Failing G3 marks G3 and everything after it (in lane order) stale...
  gate.run(["G3", "--fail", "--evidence", ev], root, () => {});
  // ...then re-passing G3 only clears G3's own stale entry, leaving the
  // downstream gates (G5,G6,G7,G8) stale even though their recorded verdict
  // is still "pass" from before.
  gate.run(["G3", "--pass", "--evidence", ev], root, () => {});

  const s = readState(root);
  for (const g of all) assert.strictEqual(s.gates[g], "pass", `${g} should read pass`);
  assert.ok(s.stale.length > 0, "expected leftover stale entries");

  const lines = [];
  const rc = archive.run(["c"], root, (l) => lines.push(l));
  assert.strictEqual(rc, 1);
  assert.match(lines.join("\n"), new RegExp(`${s.stale.length} stale artifact`));
  assert.ok(fs.existsSync(path.join(root, "delivery", "changes", "c")));
  assert.deepStrictEqual(readState(root).stale, s.stale);
});

// --- Ruling C: archiving a non-active change must not clobber the active one --

test("ruling C: archiving a change that is not the active change is refused and leaves the active change untouched", () => {
  const root = repo();
  propose.run(["a", "--lane", "express"], root, () => {});
  const ev = evidenceFile(root);
  gate.run(["G2", "--pass", "--evidence", ev], root, () => {});

  // propose.js now refuses to start a second change while one is active
  // (fix round 1), so "a" and "b" can no longer both exist this way through
  // ordinary CLI use. But archive must not simply trust state.json either
  // — a hand-edited state file, an older on-disk change directory that
  // predates that guard, or a future bug could still produce exactly this
  // shape: some other change active in state, with "a"'s directory sitting
  // un-archived on disk. Simulate that directly to exercise the invariant.
  const s = readState(root);
  s.change = "b"; s.lane = "standard"; s.phase = 1; s.gates = {}; s.stale = [];
  writeState(root, s);
  const before = readState(root);

  const lines = [];
  const rc = archive.run(["a"], root, (l) => lines.push(l));
  assert.strictEqual(rc, 1);
  assert.match(lines.join("\n"), /not the active change/);
  // "a"'s directory is untouched...
  assert.ok(fs.existsSync(path.join(root, "delivery", "changes", "a")));
  // ...and "b" (the active change) is completely untouched.
  assert.deepStrictEqual(readState(root), before);
});

test("ruling C: archiving is refused the same way when no change is active at all", () => {
  const root = repo();
  proposeNamed(root, "a");
  const ev = evidenceFile(root);
  gate.run(["G2", "--pass", "--evidence", ev], root, () => {});
  gate.run(["G6", "--pass", "--evidence", ev], root, () => {});
  gate.run(["G7", "--pass", "--evidence", ev], root, () => {});
  archive.run(["a"], root, () => {}); // clears the active change entirely
  assert.strictEqual(readState(root).change, null);

  // Fabricate a stray, never-active change directory (e.g. left behind by
  // manual fiddling) to prove the check is "must equal state.change", not
  // merely "state.change is set".
  const stray = path.join(root, "delivery", "changes", "stray");
  fs.mkdirSync(stray, { recursive: true });
  fs.writeFileSync(path.join(stray, "proposal.md"), "# stray\n");

  const lines = [];
  const rc = archive.run(["stray"], root, (l) => lines.push(l));
  assert.strictEqual(rc, 1);
  assert.match(lines.join("\n"), /no change is currently active/);
  assert.ok(fs.existsSync(stray));
});

// --- Added test: re-archiving under the same date must not clobber history --

test("added: re-archiving the same name on the same day is refused, not overwritten", () => {
  const root = proposeC(repo(), "express");
  passAll(root, ["G2", "G6", "G7"]);
  assert.strictEqual(archive.run(["c"], root, () => {}), 0);

  const today = new Date().toISOString().slice(0, 10);
  const archived = path.join(root, "delivery", "changes", "archive", `${today}-c`);
  const before = fs.readFileSync(path.join(archived, "proposal.md"), "utf8");

  // Re-propose the same name (allowed — the original changes/c/ is gone)
  // and satisfy its gates again, then try to archive it the same day.
  proposeC(root, "express");
  passAll(root, ["G2", "G6", "G7"]);
  const lines = [];
  const rc = archive.run(["c"], root, (l) => lines.push(l));
  assert.strictEqual(rc, 1);
  assert.match(lines.join("\n"), /already exists/);
  // History is untouched...
  assert.strictEqual(fs.readFileSync(path.join(archived, "proposal.md"), "utf8"), before);
  // ...and the second attempt's change directory was NOT consumed.
  assert.ok(fs.existsSync(path.join(root, "delivery", "changes", "c")));
});

// --- Added test: folding a delta spec over an existing specs/ file --------

test("added: folding a delta spec overwrites the existing specs/ file at the same path (delta is newer truth)", () => {
  const root = repo();
  fs.mkdirSync(path.join(root, "delivery", "specs", "theme"), { recursive: true });
  fs.writeFileSync(path.join(root, "delivery", "specs", "theme", "spec.md"), "# Theme\n## REQ-001 OLD\n");

  proposeC(root, "express"); // writes a delta at changes/c/specs/theme/spec.md with different content
  passAll(root, ["G2", "G6", "G7"]);
  assert.strictEqual(archive.run(["c"], root, () => {}), 0);

  const folded = fs.readFileSync(path.join(root, "delivery", "specs", "theme", "spec.md"), "utf8");
  assert.match(folded, /REQ-001 x/);
  assert.ok(!folded.includes("OLD"));
});

// ---------------------------------------------------------------------------
// Ruling D — archive gated on gate verdicts only. A standard-lane change
// archived cleanly while `validate` was exiting 1 on a T3 finding: the
// framework claims everything traces to a requirement, and nothing enforced
// that at the exit. archive now runs the traceability validator and refuses on
// findings, consistent with how it refuses on unsettled gates and stale
// artifacts — nothing on disk changes.
// ---------------------------------------------------------------------------
function writeTasks(root, body) {
  fs.writeFileSync(path.join(root, "delivery", "changes", "c", "tasks.md"), body);
}

function archiveOutcome(root) {
  const lines = [];
  const code = archive.run(["c"], root, (s) => lines.push(s));
  return { code, out: lines.join("\n") };
}

test("archive refuses a change whose task implements an unknown requirement", () => {
  const root = proposeC(repo());
  writeTasks(root, "# Tasks\n\n- **TASK-001** Build it\n  - Implements: REQ-999\n");
  passAll(root, ["G2", "G6", "G7"]);
  const { code, out } = archiveOutcome(root);
  assert.strictEqual(code, 1);
  assert.match(out, /traceability findings are outstanding/);
  assert.match(out, /T3 .*implements unknown REQ-999/);
});

test("a refused archive moves nothing and leaves the change active", () => {
  const root = proposeC(repo());
  writeTasks(root, "# Tasks\n\n- **TASK-001** Build it\n  - Implements: REQ-999\n");
  passAll(root, ["G2", "G6", "G7"]);
  assert.strictEqual(archiveOutcome(root).code, 1);

  assert.ok(fs.existsSync(path.join(root, "delivery", "changes", "c")),
    "the change directory was moved despite the refusal");
  const archived = path.join(root, "delivery", "changes", "archive");
  const contents = fs.existsSync(archived)
    ? fs.readdirSync(archived).filter((f) => f !== ".gitkeep")
    : [];
  assert.deepStrictEqual(contents, []);
  assert.ok(!fs.existsSync(path.join(root, "delivery", "specs", "theme", "spec.md")),
    "the delta spec was folded into specs/ despite the refusal");
  assert.ok(!fs.existsSync(path.join(root, "delivery", "ops", "postmortems", "c.md")),
    "a postmortem was written despite the refusal");
  assert.strictEqual(readState(root).change, "c", "state was reset despite the refusal");
});

test("archive refuses a requirement with no acceptance criteria", () => {
  const root = repo();
  propose.run(["c", "--lane", "express"], root, () => {});
  const delta = path.join(root, "delivery", "changes", "c", "specs", "theme");
  fs.mkdirSync(delta, { recursive: true });
  // A Must with no AC — T2.
  fs.writeFileSync(path.join(delta, "spec.md"), "# Theme\n## REQ-001 x\n**Priority:** Must\n");
  passAll(root, ["G2", "G6", "G7"]);
  const { code, out } = archiveOutcome(root);
  assert.strictEqual(code, 1);
  assert.match(out, /T2 .*no acceptance criteria/);
});

test("archive still succeeds once traceability is clean", () => {
  const root = proposeC(repo());
  writeTasks(root, "# Tasks\n\n- **TASK-001** Build it\n  - Implements: REQ-001\n");
  passAll(root, ["G2", "G6", "G7"]);
  const { code, out } = archiveOutcome(root);
  assert.strictEqual(code, 0, out);
  assert.match(out, /Archived to/);
});

test("a task bound to a requirement introduced by the change's own delta spec is accepted", () => {
  // The delta spec is proposed truth for the lifetime of the change; archive
  // must not demand the requirement already be canonical in delivery/specs/.
  const root = proposeC(repo());
  writeTasks(root, "# Tasks\n\n- **TASK-001** Build it\n  - Implements: REQ-001\n");
  passAll(root, ["G2", "G6", "G7"]);
  assert.strictEqual(archiveOutcome(root).code, 0);
  assert.ok(fs.existsSync(path.join(root, "delivery", "specs", "theme", "spec.md")),
    "the delta spec was not folded into specs/");
});

test("archive refuses on traceability only after the gate check, so the louder problem is reported first", () => {
  const root = proposeC(repo());
  writeTasks(root, "# Tasks\n\n- **TASK-001** Build it\n  - Implements: REQ-999\n");
  // No gates recorded at all, and a T3 outstanding.
  const { code, out } = archiveOutcome(root);
  assert.strictEqual(code, 1);
  assert.match(out, /gates and\/or artifacts are not settled/);
  assert.doesNotMatch(out, /traceability/);
});

test("a traceability refusal names the command that re-checks it", () => {
  const root = proposeC(repo());
  writeTasks(root, "# Tasks\n\n- **TASK-001** Build it\n  - Implements: REQ-999\n");
  passAll(root, ["G2", "G6", "G7"]);
  assert.match(archiveOutcome(root).out, /navi-delivery validate/);
});
