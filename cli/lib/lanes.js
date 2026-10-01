"use strict";
const ALL_GATES = Object.freeze(["G1","G2","G3","G4","G5","G6","G7","G8","G9"]);
const LANES = Object.freeze({
  express:  { gates: Object.freeze(["G2","G6","G7"]), when: "copy, config, flag flip" },
  standard: { gates: Object.freeze(["G1","G2","G3","G5","G6","G7","G8"]), when: "most features and bugs" },
  full:     { gates: Object.freeze([...ALL_GATES]), when: "new capability, regulated, or any ML" },
  // Controller ruling A: the spec requires hotfix to enforce G2 (retroactive
  // within 48h), G6, G7 (immediately) and G9 (postmortem, mandatory). All
  // four must be in `gates` or `gate` refuses them outright (it only allows
  // gates within the lane's own set). `deferred`/`mandatory` document *when*
  // each fires, not *whether* it is required.
  hotfix:   { gates: Object.freeze(["G2","G6","G7","G9"]), when: "production incident", deferred: ["G2"], mandatory: ["G9"] },
});
const isLane = (v) => Object.prototype.hasOwnProperty.call(LANES, v);
function gatesForLane(lane) {
  if (!isLane(lane)) {
    throw new Error(`unknown lane '${lane}' — valid lanes: ${Object.keys(LANES).join(", ")}`);
  }
  return LANES[lane].gates;
}
module.exports = { ALL_GATES, LANES, isLane, gatesForLane };
