"use strict";
const { readState } = require("../lib/state");
const { gatesForLane, isLane, LANES } = require("../lib/lanes");

function run(argv, cwd, emit = console.log) {
  const s = readState(cwd);
  if (!s.change) { emit("no active change — run: navi-delivery propose <name> --lane <lane>"); return 0; }

  // Check for invalid lane before calling gatesForLane
  if (!isLane(s.lane)) {
    emit(`invalid lane '${s.lane}' — valid lanes: ${Object.keys(LANES).join(", ")}`);
    return 1;
  }

  emit(`change: ${s.change}`);
  emit(`lane:   ${s.lane}`);
  // No `phase:` line. `state.phase` is assigned 1 by `propose` and by `archive`
  // and is advanced by nothing, so the line printed `1` for every change for
  // the whole life of that change. The gate verdicts below carry the real
  // progression. A decorative field printed as fact is worse than no field, so
  // it is not printed. `state.phase` itself stays in state.json — removing it
  // would change the on-disk state format, which is a separate decision.
  emit("");
  for (const g of gatesForLane(s.lane)) emit(`  ${g}  ${s.gates[g] || "pending"}`);
  if (s.stale.length) {
    emit("");
    emit(`stale artifacts (${s.stale.length}) — rework required before validate passes:`);
    for (const a of s.stale) emit(`  ${a}`);
  }
  return 0;
}
module.exports = { run };
