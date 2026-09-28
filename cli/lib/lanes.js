"use strict";
const ALL_GATES = Object.freeze(["G1","G2","G3","G4","G5","G6","G7","G8","G9"]);
const LANES = Object.freeze({
  express:  { gates: ["G2","G6","G7"], when: "copy, config, flag flip" },
  standard: { gates: ["G1","G2","G3","G5","G6","G7","G8"], when: "most features and bugs" },
  full:     { gates: [...ALL_GATES], when: "new capability, regulated, or any ML" },
  hotfix:   { gates: ["G6","G7"], when: "production incident", deferred: ["G2"], mandatory: ["G9"] },
});
const isLane = (v) => Object.prototype.hasOwnProperty.call(LANES, v);
function gatesForLane(lane) {
  if (!isLane(lane)) {
    throw new Error(`unknown lane '${lane}' — valid lanes: ${Object.keys(LANES).join(", ")}`);
  }
  return LANES[lane].gates;
}
module.exports = { ALL_GATES, LANES, isLane, gatesForLane };
