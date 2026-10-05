const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const init = require("../../cli/commands/init");
const propose = require("../../cli/commands/propose");
const status = require("../../cli/commands/status");
const { writeState } = require("../../cli/lib/state");

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nd-stat-"));
  init.run([], root, () => {});
  return root;
}

test("status on a fresh repo says no active change", () => {
  const root = repo();
  const lines = [];
  assert.strictEqual(status.run([], root, (s) => lines.push(s)), 0);
  assert.match(lines.join("\n"), /no active change/i);
});

test("status lists every gate in the lane as pending", () => {
  const root = repo();
  propose.run(["x", "--lane", "express"], root, () => {});
  const lines = [];
  status.run([], root, (s) => lines.push(s));
  const out = lines.join("\n");
  assert.match(out, /change:\s+x/);
  assert.match(out, /lane:\s+express/);
  for (const g of ["G2", "G6", "G7"]) assert.match(out, new RegExp(`${g}\\s+pending`));
  assert.ok(!out.includes("G4"), "gates outside the lane must not be listed");
});

test("status shows stale artifacts when present", () => {
  const root = repo();
  propose.run(["y", "--lane", "standard"], root, () => {});

  // Manually update state to include stale artifacts
  const { readState } = require("../../cli/lib/state");
  let state = readState(root);
  state.stale = ["artifact-1.md", "artifact-2.pdf"];
  writeState(root, state);

  const lines = [];
  status.run([], root, (s) => lines.push(s));
  const out = lines.join("\n");

  assert.match(out, /stale artifacts/i);
  assert.match(out, /artifact-1\.md/);
  assert.match(out, /artifact-2\.pdf/);
});

test("status shows gates with their actual verdicts", () => {
  const root = repo();
  propose.run(["z", "--lane", "express"], root, () => {});

  // Manually update state to set some gate verdicts
  const { readState } = require("../../cli/lib/state");
  let state = readState(root);
  state.gates = { G2: "pass", G6: "fail" };
  // G7 is left absent to show pending
  writeState(root, state);

  const lines = [];
  status.run([], root, (s) => lines.push(s));
  const out = lines.join("\n");

  assert.match(out, /G2\s+pass/);
  assert.match(out, /G6\s+fail/);
  assert.match(out, /G7\s+pending/);
});

test("status on invalid lane reports clear error", () => {
  const root = repo();

  // Manually write state with invalid lane
  const { readState } = require("../../cli/lib/state");
  let state = readState(root);
  state.change = "bad";
  state.lane = "stndard"; // typo: should be "standard"
  writeState(root, state);

  const lines = [];
  const exitCode = status.run([], root, (s) => lines.push(s));
  const out = lines.join("\n");

  assert.strictEqual(exitCode, 1, "should return exit code 1");
  assert.match(out, /stndard/);
  assert.match(out, /valid lanes/i);
});

test("status points at the next gate, with the command that records it", () => {
  // "G1 pending" is a fact, not an instruction. Before this, the reader had to
  // know which gate came next, what it read, and where its evidence lived.
  const root = repo();
  propose.run(["z", "--lane", "standard"], root, () => {});
  const lines = [];
  status.run([], root, (s) => lines.push(String(s)));
  const out = lines.join("\n");

  assert.match(out, /G1\s+pending\s+← next/, "the next gate is not marked");
  assert.match(out, /^G1 reads: /m, "the gate's criterion is not shown");
  assert.match(out, /Next:\s+navi-delivery gate G1 --pass --evidence delivery\/changes\/z\/proposal\.md/);
});

test("status still lists stale artifacts that are not gates", () => {
  const root = repo();
  propose.run(["z", "--lane", "standard"], root, () => {});
  const { readState } = require("../../cli/lib/state");
  const s = readState(root);
  s.stale = ["gate:G6", "a-loose-artifact.md"];
  writeState(root, s);

  const lines = [];
  status.run([], root, (x) => lines.push(String(x)));
  const out = lines.join("\n");
  assert.match(out, /a-loose-artifact\.md/, "a non-gate stale entry vanished");
  assert.match(out, /G6\s+pending\s+stale/, "the gate was not marked stale in the list");
});
