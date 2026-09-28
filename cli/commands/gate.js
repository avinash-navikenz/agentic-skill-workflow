"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { readState, writeState } = require("../lib/state");
const { appendEvent } = require("../lib/events");
const { gatesForLane, ALL_GATES } = require("../lib/lanes");
const { waiversPath } = require("../lib/paths");
const { flagValue } = require("../lib/args");

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Date.UTC silently normalises out-of-range components instead of
// rejecting them (2026-02-30 becomes 2026-03-02; 2026-13-01 becomes
// 2027-01-01), so a regex match alone is not proof the string names a
// real day. Round-tripping the parsed components back against the input
// is what actually catches a non-existent date.
function parseCalendarDate(str) {
  const m = DATE_RE.exec(str);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return d;
}

function todayUTC() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

// Controller ruling: an expiry is the *entire* control on a waiver. An
// unparseable or already-past expiry would let a "temporary" exception
// quietly become permanent, so --expires must be a real YYYY-MM-DD
// calendar date strictly after today, or the waiver is refused outright —
// nothing is written, neither the waivers.md row nor the event.
function expiryError(str) {
  if (typeof str !== "string" || !DATE_RE.test(str)) {
    return `--expires must be a calendar date in YYYY-MM-DD form, got '${str}'`;
  }
  const d = parseCalendarDate(str);
  if (!d) return `--expires '${str}' is not a real calendar date`;
  if (d.getTime() <= todayUTC()) return `--expires '${str}' must be strictly in the future`;
  return null;
}

// Fix round 1, finding C: a waiver reason is one column in a Markdown
// table. A literal "|" would shift every later column, silently corrupting
// the table — so pipes are escaped rather than rejected (punctuation is
// not a reason to refuse an otherwise legitimate sentence). A newline has
// no escape that keeps the reason inside a single table row, so that is
// rejected outright instead.
function escapeForTableCell(reason) {
  return reason.replace(/\|/g, "\\|");
}

// Fix round 1, finding B: gate.js is the only place that sets a gate's own
// "gate:<X>" stale entry, so it is the only place that gets to clear it.
// Recording a fresh pass or waiver for a gate means that gate's own prior
// staleness is resolved; nothing is inferred about any other gate's entry.
function clearOwnStale(s, gate) {
  s.stale = s.stale.filter((entry) => entry !== `gate:${gate}`);
}

function run(argv, cwd, emit = console.log) {
  const gate = argv[0];
  if (!ALL_GATES.includes(gate)) { emit(`unknown gate '${gate}' — valid: ${ALL_GATES.join(", ")}`); return 1; }

  const s = readState(cwd);
  if (!s.change) { emit("no active change"); return 1; }
  const laneGates = gatesForLane(s.lane);
  if (!laneGates.includes(gate)) {
    emit(`${gate} is not in lane '${s.lane}' — this lane enforces: ${laneGates.join(", ")}`);
    return 1;
  }

  // Recording a decision for a gate that already has one is a deliberate,
  // supported path — it's how the fail -> rework -> re-run -> pass loop
  // this framework exists to drive is meant to work. What must never
  // happen is that re-decision looking, in the log, identical to a first
  // decision: every re-recording carries the prior verdict forward on the
  // event (`previous`) and says so in the emitted message, so the append-
  // only event log always tells the truth about what changed and when —
  // it is never silently overwritten, only ever appended to.
  const previous = s.gates[gate];

  const waive = flagValue(argv, "--waive");
  if (waive.present) {
    // Fix round 1, finding A: an omitted reason must not silently borrow
    // the next flag's name (e.g. "--waive --expires 2026-12-31" reading
    // "--expires" as the reason). flagValue already refuses to treat a
    // "--"-prefixed token as a value, so a missing reason surfaces here.
    if (!waive.value) { emit("--waive requires a reason — got none (or the next token looks like a flag)"); return 1; }
    const waiveReason = waive.value;
    if (waiveReason.includes("\n")) {
      emit("waiver reason must not contain a newline — it becomes a single waivers.md table row");
      return 1;
    }

    const expires = flagValue(argv, "--expires");
    if (!expires.value) { emit("a waiver requires --expires <YYYY-MM-DD>"); return 1; }
    const problem = expiryError(expires.value);
    if (problem) { emit(problem); return 1; }

    const row = `| ${new Date().toISOString().slice(0, 10)} | ${s.change} | ${gate} | ${escapeForTableCell(waiveReason)} | ${expires.value} | |\n`;
    fs.appendFileSync(waiversPath(cwd), row);
    s.gates[gate] = "waived";
    clearOwnStale(s, gate);
    writeState(cwd, s);
    const evt = { change: s.change, gate, verdict: "waived", reason: waiveReason, expires: expires.value };
    if (previous) evt.previous = previous;
    appendEvent(cwd, evt);
    emit(previous
      ? `${gate} re-recorded: ${previous} -> waived until ${expires.value}`
      : `${gate} waived until ${expires.value}`);
    return 0;
  }

  const passed = argv.includes("--pass");
  const failed = argv.includes("--fail");
  if (passed === failed) { emit("specify exactly one of --pass or --fail"); return 1; }

  const evidence = flagValue(argv, "--evidence");
  if (!evidence.value) { emit("--evidence is required to record a gate decision"); return 1; }
  if (!fs.existsSync(path.resolve(cwd, evidence.value))) { emit(`evidence file not found: ${evidence.value}`); return 1; }

  const verdict = passed ? "pass" : "fail";
  s.gates[gate] = verdict;
  if (failed) {
    // Fix round 1, finding D: mark stale only within the current lane's
    // gate set. ALL_GATES.slice(idx) would mark gates the current lane
    // never enforces (e.g. G8/G9 on "express"), which can then never be
    // recorded and so — now that finding B makes gate.js clear its own
    // stale entries on pass/waive — could never clear either.
    const idx = laneGates.indexOf(gate);
    const toMark = laneGates.slice(idx).map((g) => `gate:${g}`);
    s.stale = [...new Set([...s.stale, ...toMark])];
  } else {
    clearOwnStale(s, gate);
  }
  writeState(cwd, s);
  const evt = { change: s.change, gate, verdict, evidence: evidence.value };
  if (previous) evt.previous = previous;
  appendEvent(cwd, evt);
  emit(previous
    ? `${gate} re-recorded: ${previous} -> ${verdict} (evidence: ${evidence.value})`
    : `${gate} ${verdict} (evidence: ${evidence.value})`);
  if (failed) emit(`rework required — ${s.stale.length} artifact(s) marked stale`);
  return 0;
}
module.exports = { run };
