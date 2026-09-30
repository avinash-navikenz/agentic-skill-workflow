"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { deliveryDir, changeDir } = require("../lib/paths");
const { readState, writeState } = require("../lib/state");
const { appendEvent } = require("../lib/events");
const { isLane, gatesForLane, LANES } = require("../lib/lanes");

const INSIGHT = (name) => `# Postmortem — ${name}

## What we learned

- **INSIGHT-001** <what changed in our understanding>
  - Destination: product backlog | skill amendment
  - Target: <REQ candidate, or the navi-skill-* to amend>

## KPI vs actual
<what we predicted, what happened>
`;

const ROOT = path.join(__dirname, "..", "..");

// Controller ruling D: archive gated on gate verdicts only, so a standard-lane
// change archived cleanly while `validate` was exiting 1 on a T3 finding — a
// task implementing a requirement that existed nowhere. The framework claims
// everything traces to a requirement and nothing enforced that at the exit,
// which is the one moment the claim becomes permanent: archive folds the delta
// spec into specs/ and moves the change out of reach.
//
// The scope is the whole delivery tree, matching `validate`, not just this
// change. That is deliberate rather than incidental: archiving *changes* the
// global requirement set by folding the delta spec into specs/, so a finding
// anywhere in the tree is a finding about the state this archive is about to
// make canonical.
//
// Run in non-strict mode, again matching `validate`'s default: T4 ("implemented
// by no task") is a --strict opinion about completeness, and archive refuses on
// broken traceability, not on unfinished scope.
function run(argv, cwd, emit = console.log) {
  const name = argv[0];
  if (!name) { emit("usage: navi-delivery archive <name>"); return 1; }

  const dir = changeDir(cwd, name);
  if (!fs.existsSync(dir)) { emit(`unknown change '${name}'`); return 1; }

  const root = deliveryDir(cwd);
  const s = readState(cwd);

  // Controller ruling C: state.json records gate verdicts and staleness for
  // exactly one change at a time — the active one. propose.js resets
  // state.gates/state.stale to {}/[] every time a *different* change is
  // proposed, so once a change stops being active there is no durable,
  // per-change record of its gate history left anywhere for archive to
  // check. Rather than guess at (or silently trust) history that may have
  // been overwritten, archive refuses to touch any change that is not
  // *currently* the active one. This also makes ruling B's check
  // unambiguous — the gates/stale we inspect below are always for the
  // change we are about to act on — and makes the state reset at the end
  // always correct, because it is always the active change's own state.
  if (s.change !== name) {
    emit(s.change
      ? `'${name}' is not the active change (active: '${s.change}') — gate verdicts are only tracked for the active change, so a change superseded by a later 'propose' cannot be safely archived through this command. Nothing was changed.`
      : `'${name}' is not the active change (no change is currently active) — gate verdicts are only tracked for the active change, so '${name}''s history cannot be verified. Nothing was changed.`);
    return 1;
  }

  if (!isLane(s.lane)) {
    emit(`invalid lane '${s.lane}' recorded in state.json — valid lanes: ${Object.keys(LANES).join(", ")}. Nothing was changed.`);
    return 1;
  }

  // Controller ruling B: archive must not bypass the gates. Refuse unless
  // every gate the lane requires is settled (pass or waived) and no
  // artifact is stale. Nothing on disk changes when this refuses.
  const required = gatesForLane(s.lane);
  const outstanding = required.filter((g) => s.gates[g] !== "pass" && s.gates[g] !== "waived");
  if (outstanding.length || s.stale.length) {
    emit(`cannot archive '${name}': gates and/or artifacts are not settled. Nothing was changed.`);
    if (outstanding.length) {
      const detail = outstanding.map((g) => `${g} (${s.gates[g] || "pending"})`).join(", ");
      emit(`  outstanding gate(s): ${detail}`);
      emit(`  resolve with: navi-delivery gate <gate> --pass --evidence <file>  (or --waive <reason> --expires <date>)`);
    }
    if (s.stale.length) {
      emit(`  ${s.stale.length} stale artifact(s): ${s.stale.join(", ")}`);
      emit(`  resolve by re-running 'navi-delivery gate <gate> ...' on each stale gate to clear its rework`);
    }
    return 1;
  }

  // Traceability is checked here — after the gates, before anything on disk
  // moves — so this refusal reads like the two above it: nothing was changed.
  const script = path.join(ROOT, "scripts", "validate_traceability.py");
  const trace = spawnSync("python3", [script, deliveryDir(cwd)], { encoding: "utf8" });
  if (trace.error || trace.status === null) {
    emit(`cannot archive '${name}': traceability could not be checked — ${trace.error ? trace.error.message : "the validator did not exit normally"}. Nothing was changed.`);
    return 1;
  }
  if (trace.status !== 0) {
    emit(`cannot archive '${name}': traceability findings are outstanding. Nothing was changed.`);
    if (trace.stdout) emit(trace.stdout.trimEnd());
    if (trace.stderr) emit(trace.stderr.trimEnd());
    emit(`  resolve by binding each task to a requirement that exists, and giving every requirement acceptance criteria`);
    emit(`  re-check with: navi-delivery validate`);
    return 1;
  }

  // A change can be re-proposed under the same name after its first archive
  // (changes/<name>/ no longer exists once archived), so the same name can
  // collide with today's archive slot a second time. Silently overwriting
  // that slot would destroy the first archive's history, so refuse instead.
  const stampDate = new Date().toISOString().slice(0, 10);
  const stamped = path.join(root, "changes", "archive", `${stampDate}-${name}`);
  if (fs.existsSync(stamped)) {
    emit(`refusing to archive: delivery/changes/archive/${stampDate}-${name} already exists — archiving would overwrite recorded history. Nothing was changed. Move or rename the existing archive folder first if this is truly intended.`);
    return 1;
  }

  // Fold delta specs into specs/ — specs/ is "current truth" and the whole
  // point of a delta spec is to update it, so the delta wins wherever it
  // overlaps an existing path. Anything already under specs/ that the delta
  // doesn't touch is left alone (cpSync recursive+force only overwrites the
  // paths the delta actually has).
  const deltas = path.join(dir, "specs");
  if (fs.existsSync(deltas)) {
    fs.cpSync(deltas, path.join(root, "specs"), { recursive: true, force: true });
  }

  fs.mkdirSync(path.dirname(stamped), { recursive: true });
  fs.renameSync(dir, stamped);

  const post = path.join(root, "ops", "postmortems", `${name}.md`);
  if (!fs.existsSync(post)) fs.writeFileSync(post, INSIGHT(name));

  s.change = null; s.lane = null; s.phase = 1; s.gates = {}; s.stale = [];
  writeState(cwd, s);
  appendEvent(cwd, { change: name, gate: "G9", verdict: "archived" });
  emit(`Archived to delivery/changes/archive/${path.basename(stamped)}`);
  emit(`Insights: delivery/ops/postmortems/${name}.md — route each to the backlog or a skill amendment`);
  return 0;
}
module.exports = { run };
