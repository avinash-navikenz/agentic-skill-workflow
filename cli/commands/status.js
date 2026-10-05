"use strict";
const { readState } = require("../lib/state");
const { gatesForLane, isLane, LANES } = require("../lib/lanes");
const { nextStepLines, advise } = require("../lib/gates");

function run(argv, cwd, emit = console.log, adviseWrite = undefined) {
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
  const lane = gatesForLane(s.lane);
  // The gate the reader should act on next: the first unsettled one, or the
  // first marked stale, because rework comes before anything further.
  const staleGates = new Set(s.stale.filter((a) => a.startsWith("gate:")).map((a) => a.slice(5)));
  const next = lane.find((g) => staleGates.has(g)) || lane.find((g) => !s.gates[g] || s.gates[g] === "fail");

  for (const g of lane) {
    const verdict = s.gates[g] || "pending";
    const marks = [staleGates.has(g) ? "stale" : null, g === next ? "← next" : null].filter(Boolean);
    emit(`  ${g}  ${marks.length ? verdict.padEnd(8) : verdict}${marks.join("  ")}`);
  }

  // Every stale entry, by name. Most are gates and are marked in the list
  // above, but `stale` holds arbitrary artifact paths too and those appear
  // nowhere else.
  if (s.stale.length) {
    emit("");
    emit(`stale artifacts (${s.stale.length}) — rework required before validate passes:`);
    for (const a of s.stale) emit(`  ${a}`);
  }

  // "G3 pending" is a fact; it is not an instruction. Printing the gate's own
  // criterion and the command that records it is the difference between a
  // status line and a next step.
  advise(["", ...nextStepLines(s, lane)], adviseWrite);
  return 0;
}
module.exports = { run };
