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
  // Type validation
  if (typeof parsed.version !== "number") {
    throw new StateError(`${p}: version must be a number, got ${typeof parsed.version}`);
  }
  if (typeof parsed.phase !== "number") {
    throw new StateError(`${p}: phase must be a number, got ${typeof parsed.phase}`);
  }
  if (typeof parsed.change !== "string" && parsed.change !== null) {
    throw new StateError(`${p}: change must be a string or null, got ${typeof parsed.change}`);
  }
  if (typeof parsed.lane !== "string" && parsed.lane !== null) {
    throw new StateError(`${p}: lane must be a string or null, got ${typeof parsed.lane}`);
  }
  if (typeof parsed.gates !== "object" || parsed.gates === null || Array.isArray(parsed.gates)) {
    throw new StateError(`${p}: gates must be a plain object, got ${Array.isArray(parsed.gates) ? "array" : typeof parsed.gates}`);
  }
  if (!Array.isArray(parsed.stale)) {
    throw new StateError(`${p}: stale must be an array, got ${typeof parsed.stale}`);
  }
  return parsed;
}

function writeState(root, state) {
  fs.mkdirSync(adlcDir(root), { recursive: true });
  fs.writeFileSync(statePath(root), JSON.stringify(state, null, 2) + "\n");
}

module.exports = { newState, readState, writeState, StateError };
