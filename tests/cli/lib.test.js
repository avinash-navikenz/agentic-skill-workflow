const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const lanes = require("../../cli/lib/lanes");
const state = require("../../cli/lib/state");
const events = require("../../cli/lib/events");

function tmpRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nd-"));
  fs.mkdirSync(path.join(root, "delivery", ".adlc"), { recursive: true });
  return root;
}

test("every lane maps to a non-empty gate subset of G1..G9", () => {
  for (const name of Object.keys(lanes.LANES)) {
    const gates = lanes.gatesForLane(name);
    assert.ok(gates.length > 0, `${name} has no gates`);
    for (const g of gates) assert.ok(lanes.ALL_GATES.includes(g), `${name}: bad gate ${g}`);
  }
});

test("express is the lightest lane and full is every gate", () => {
  assert.deepStrictEqual(lanes.gatesForLane("express"), ["G2", "G6", "G7"]);
  assert.deepStrictEqual(lanes.gatesForLane("full"), lanes.ALL_GATES);
});

test("controller ruling A: hotfix enforces G2 (retroactive), G6/G7 (immediate) and G9 (mandatory postmortem)", () => {
  assert.deepStrictEqual(lanes.gatesForLane("hotfix"), ["G2", "G6", "G7", "G9"]);
  assert.deepStrictEqual(lanes.LANES.hotfix.deferred, ["G2"]);
  assert.deepStrictEqual(lanes.LANES.hotfix.mandatory, ["G9"]);
  // express, standard and full are untouched by this ruling.
  assert.deepStrictEqual(lanes.gatesForLane("express"), ["G2", "G6", "G7"]);
  assert.deepStrictEqual(lanes.gatesForLane("standard"), ["G1", "G2", "G3", "G5", "G6", "G7", "G8"]);
  assert.deepStrictEqual(lanes.gatesForLane("full"), lanes.ALL_GATES);
});

test("unknown lane is rejected", () => {
  assert.strictEqual(lanes.isLane("standrd"), false);
  assert.throws(() => lanes.gatesForLane("standrd"), /unknown lane 'standrd'/);
});

test("state round-trips", () => {
  const root = tmpRepo();
  const s = state.newState();
  s.change = "add-dark-mode"; s.lane = "standard"; s.phase = 3;
  state.writeState(root, s);
  assert.deepStrictEqual(state.readState(root), s);
});

test("corrupt state.json fails loudly and never resets silently", () => {
  const root = tmpRepo();
  fs.writeFileSync(path.join(root, "delivery", ".adlc", "state.json"), "{ not json");
  assert.throws(() => state.readState(root), /state\.json is not valid JSON/);
});

test("state.json missing a required key names that key", () => {
  const root = tmpRepo();
  fs.writeFileSync(path.join(root, "delivery", ".adlc", "state.json"),
    JSON.stringify({ version: 1, change: "x", lane: "full" }));
  assert.throws(() => state.readState(root), /missing required key 'phase'/);
});

test("events append as one JSON object per line", () => {
  const root = tmpRepo();
  events.appendEvent(root, { gate: "G2", verdict: "pass" });
  events.appendEvent(root, { gate: "G6", verdict: "fail" });
  const all = events.readEvents(root);
  assert.strictEqual(all.length, 2);
  assert.strictEqual(all[1].gate, "G6");
  assert.ok(all[0].ts, "event must be timestamped");
});

test("readState() with absent state.json returns fresh state and does not throw", () => {
  const root = tmpRepo();
  // Delete the state.json file if it exists to ensure it's truly absent
  const statePath = path.join(root, "delivery", ".adlc", "state.json");
  if (fs.existsSync(statePath)) {
    fs.unlinkSync(statePath);
  }
  // Should return a fresh state, not throw
  const s = state.readState(root);
  assert.deepStrictEqual(s, state.newState());
});

test("readEvents() with absent events.jsonl returns empty array", () => {
  const root = tmpRepo();
  // Ensure events.jsonl does not exist
  const eventsPath = path.join(root, "delivery", ".adlc", "events.jsonl");
  if (fs.existsSync(eventsPath)) {
    fs.unlinkSync(eventsPath);
  }
  // Should return empty array, not throw
  const all = events.readEvents(root);
  assert.deepStrictEqual(all, []);
});

test("gatesForLane returns frozen array, not mutable reference", () => {
  // Get the array for "standard" lane
  const gates1 = lanes.gatesForLane("standard");
  // Attempt to mutate it in strict mode should throw
  assert.throws(() => {
    gates1.push("G10");
  }, /Cannot add property/);
  // Verify that the internal array was not modified
  const gates2 = lanes.gatesForLane("standard");
  assert.deepStrictEqual(gates2, ["G1", "G2", "G3", "G5", "G6", "G7", "G8"], "gates should not be mutated");
});

test("readState validates that phase is a number", () => {
  const root = tmpRepo();
  fs.writeFileSync(path.join(root, "delivery", ".adlc", "state.json"),
    JSON.stringify({ version: 1, change: null, lane: null, phase: "three", gates: {}, stale: [] }));
  assert.throws(() => state.readState(root), /phase.*must be a number/);
});

test("readState validates that version is a number", () => {
  const root = tmpRepo();
  fs.writeFileSync(path.join(root, "delivery", ".adlc", "state.json"),
    JSON.stringify({ version: "1", change: null, lane: null, phase: 1, gates: {}, stale: [] }));
  assert.throws(() => state.readState(root), /version.*must be a number/);
});

test("readState validates that gates is a plain object", () => {
  const root = tmpRepo();
  fs.writeFileSync(path.join(root, "delivery", ".adlc", "state.json"),
    JSON.stringify({ version: 1, change: null, lane: null, phase: 1, gates: [], stale: [] }));
  assert.throws(() => state.readState(root), /gates.*must be a plain object/);
});

test("readState validates that stale is an array", () => {
  const root = tmpRepo();
  fs.writeFileSync(path.join(root, "delivery", ".adlc", "state.json"),
    JSON.stringify({ version: 1, change: null, lane: null, phase: 1, gates: {}, stale: null }));
  assert.throws(() => state.readState(root), /stale.*must be an array/);
});

test("readState validates that change is string or null", () => {
  const root = tmpRepo();
  fs.writeFileSync(path.join(root, "delivery", ".adlc", "state.json"),
    JSON.stringify({ version: 1, change: 123, lane: null, phase: 1, gates: {}, stale: [] }));
  assert.throws(() => state.readState(root), /change.*must be a string or null/);
});

test("readState validates that lane is string or null", () => {
  const root = tmpRepo();
  fs.writeFileSync(path.join(root, "delivery", ".adlc", "state.json"),
    JSON.stringify({ version: 1, change: null, lane: 123, phase: 1, gates: {}, stale: [] }));
  assert.throws(() => state.readState(root), /lane.*must be a string or null/);
});

test("readEvents handles truncated final line with clear error", () => {
  const root = tmpRepo();
  // Write a valid event and a truncated line (process killed mid-write)
  fs.writeFileSync(path.join(root, "delivery", ".adlc", "events.jsonl"),
    '{"ts":"2026-09-28T00:00:00Z","gate":"G2"}\n{"ts":"2026-09-28T00:00:01Z","gate"');
  assert.throws(() => events.readEvents(root), /line \d+.*JSON/);
});
