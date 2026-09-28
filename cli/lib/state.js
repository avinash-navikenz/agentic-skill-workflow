"use strict";
const fs = require("node:fs");
const { statePath, adlcDir } = require("./paths");

class StateError extends Error {}
const REQUIRED = ["version", "change", "lane", "phase", "gates", "stale"];

const newState = () => ({ version: 1, change: null, lane: null, phase: 1, gates: {}, stale: [] });

function readState(root) {
  const p = statePath(root);
  if (!fs.existsSync(p)) return newState();
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    throw new StateError(`${p}: state.json is not valid JSON — refusing to reset; fix or delete it`);
  }
  for (const key of REQUIRED) {
    if (!(key in parsed)) throw new StateError(`${p}: missing required key '${key}'`);
  }
  return parsed;
}

function writeState(root, state) {
  fs.mkdirSync(adlcDir(root), { recursive: true });
  fs.writeFileSync(statePath(root), JSON.stringify(state, null, 2) + "\n");
}

module.exports = { newState, readState, writeState, StateError };
