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
