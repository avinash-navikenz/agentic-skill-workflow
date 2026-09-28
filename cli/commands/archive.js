"use strict";
const fs = require("node:fs");
const path = require("node:path");
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
