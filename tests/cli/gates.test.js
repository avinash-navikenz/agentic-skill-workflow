"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { GATES, evidenceHint, nextStepLines, advise } = require("../../cli/lib/gates");
const { ALL_GATES, gatesForLane } = require("../../cli/lib/lanes");

test("every gate the lanes use has guidance, and none is invented", () => {
  // Drift here means `status` says "G4 reads: undefined" at the moment somebody
  // needs it most.
  assert.deepStrictEqual(Object.keys(GATES).sort(), [...ALL_GATES].sort());
});

test("the guidance matches ADLC.md, which is the authority", () => {
  // ADLC.md §2 is where the criteria are decided. This asserts the CLI carries a
  // row for each gate in that table — not the wording, which is deliberately
  // shortened, but that no gate is missing and none is made up.
  const adlc = fs.readFileSync(path.resolve(__dirname, "..", "..", "ADLC.md"), "utf8");
  const documented = [...adlc.matchAll(/^\| \*\*(G\d)\*\* \|/gm)].map((m) => m[1]);
  assert.ok(documented.length >= 9, `ADLC.md's gate table parsed as ${documented.length} rows`);
  for (const g of documented) {
    assert.ok(GATES[g], `ADLC.md documents ${g}; cli/lib/gates.js does not`);
    assert.ok(GATES[g].needs.length > 20, `${g} has no usable criterion`);
  }
});

test("the evidence hint points inside the change, except where the artifact is shared", () => {
  assert.strictEqual(evidenceHint("G1", "add-csv"), "delivery/changes/add-csv/proposal.md");
  assert.strictEqual(evidenceHint("G6", "add-csv"), "delivery/changes/add-csv/evidence/g6-tests.txt");
  // slo.md and postmortems live under ops/, not under the change.
  assert.strictEqual(evidenceHint("G8", "add-csv"), "delivery/ops/slo.md");
  assert.strictEqual(evidenceHint("G9", "add-csv"), "delivery/ops/postmortems/add-csv.md");
});

test("the next step is the first unsettled gate, and names its command", () => {
  const lane = gatesForLane("standard");
  const out = nextStepLines({ change: "c", gates: { G1: "pass" }, stale: [] }, lane).join("\n");
  assert.match(out, /^G2 reads: /m);
  assert.match(out, /navi-delivery gate G2 --pass --evidence delivery\/changes\/c\//);
});

test("rework comes before progress: a stale gate is the next step even when later gates are pending", () => {
  const lane = gatesForLane("standard");
  const state = { change: "c", gates: { G1: "pass", G2: "pass", G3: "pass", G5: "pass", G6: "fail" },
                  stale: ["gate:G6", "gate:G7", "gate:G8"] };
  const out = nextStepLines(state, lane).join("\n");
  assert.match(out, /3 gate\(s\) marked stale/);
  assert.match(out, /navi-delivery gate G6 /, "it pointed past the rework");
});

test("a failed gate is unsettled, not settled", () => {
  const lane = gatesForLane("express");
  const out = nextStepLines({ change: "c", gates: { G2: "fail" }, stale: [] }, lane).join("\n");
  assert.match(out, /gate G2 /, "a fail was treated as done");
});

test("when everything is settled it says so, and names the two commands left", () => {
  const lane = gatesForLane("express");
  const out = nextStepLines(
    { change: "c", gates: { G2: "pass", G6: "pass", G7: "waived" }, stale: [] }, lane).join("\n");
  assert.match(out, /Every gate settled/);
  assert.match(out, /validate/);
  assert.match(out, /archive c/);
});

test("advice is silent when stdout is not a terminal", () => {
  // A skill's Validation block runs `$(navi-delivery status | grep ...)` and its
  // harness captures stderr too, so a pipe must produce NO advice — putting it
  // on another channel is not enough. This is what four failing skills taught.
  const seen = [];
  const realIsTTY = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
  const realWrite = process.stderr.write;
  try {
    Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });
    process.stderr.write = (s) => { seen.push(String(s)); return true; };
    advise(["Next:  do the thing"]);
    assert.deepStrictEqual(seen, [], "advice was written to a non-terminal");

    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
    advise(["Next:  do the thing"]);
    assert.strictEqual(seen.length, 1, "advice was withheld from a terminal");
  } finally {
    process.stderr.write = realWrite;
    if (realIsTTY) Object.defineProperty(process.stdout, "isTTY", realIsTTY);
    else delete process.stdout.isTTY;
  }
});
