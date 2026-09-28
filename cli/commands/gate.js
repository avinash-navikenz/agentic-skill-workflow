"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { readState, writeState } = require("../lib/state");
const { appendEvent } = require("../lib/events");
const { gatesForLane, ALL_GATES } = require("../lib/lanes");
const { waiversPath } = require("../lib/paths");

function flagValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i === -1 ? null : argv[i + 1];
}

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

  const waiveReason = flagValue(argv, "--waive");
  if (waiveReason) {
    const expires = flagValue(argv, "--expires");
    if (!expires) { emit("a waiver requires --expires <YYYY-MM-DD>"); return 1; }
    const problem = expiryError(expires);
    if (problem) { emit(problem); return 1; }

    const row = `| ${new Date().toISOString().slice(0, 10)} | ${s.change} | ${gate} | ${waiveReason} | ${expires} | |\n`;
    fs.appendFileSync(waiversPath(cwd), row);
    s.gates[gate] = "waived";
    writeState(cwd, s);
    const evt = { change: s.change, gate, verdict: "waived", reason: waiveReason, expires };
    if (previous) evt.previous = previous;
    appendEvent(cwd, evt);
    emit(previous
      ? `${gate} re-recorded: ${previous} -> waived until ${expires}`
      : `${gate} waived until ${expires}`);
    return 0;
  }

  const passed = argv.includes("--pass");
  const failed = argv.includes("--fail");
  if (passed === failed) { emit("specify exactly one of --pass or --fail"); return 1; }

  const evidence = flagValue(argv, "--evidence");
  if (!evidence) { emit("--evidence is required to record a gate decision"); return 1; }
  if (!fs.existsSync(path.resolve(cwd, evidence))) { emit(`evidence file not found: ${evidence}`); return 1; }

  const verdict = passed ? "pass" : "fail";
  s.gates[gate] = verdict;
  if (failed) {
    const idx = ALL_GATES.indexOf(gate);
    s.stale = [...new Set([...s.stale, ...ALL_GATES.slice(idx).map((g) => `gate:${g}`)])];
  }
  writeState(cwd, s);
  const evt = { change: s.change, gate, verdict, evidence };
  if (previous) evt.previous = previous;
  appendEvent(cwd, evt);
  emit(previous
    ? `${gate} re-recorded: ${previous} -> ${verdict} (evidence: ${evidence})`
    : `${gate} ${verdict} (evidence: ${evidence})`);
  if (failed) emit(`rework required — ${s.stale.length} artifact(s) marked stale`);
  return 0;
}
module.exports = { run };
