"use strict";
// What each gate reads, in one line, and where its evidence usually lives.
//
// The authority is ADLC.md §2 — this is the short form the CLI can say at the
// moment somebody needs it, so "G3 pending" becomes actionable without opening
// a document. tests/cli/gates.test.js asserts every gate in ADLC.md's table has
// a row here and vice versa, so the two cannot drift apart.
const GATES = Object.freeze({
  G1: { phase: "Plan",         needs: "proposal.md filled in: a measurable outcome, and the non-goals a reader would assume were in scope",
        evidence: "proposal.md" },
  G2: { phase: "Specify",      needs: "every REQ-### carrying at least one AC-### in Given/When/Then, with a MoSCoW priority",
        evidence: "specs/<capability>/spec.md" },
  G3: { phase: "Architect",    needs: "design.md answered throughout, with an ADR-### per consequential decision",
        evidence: "design.md" },
  G4: { phase: "Data & Model", needs: "a data contract per source, end-to-end lineage, and a leakage-checked evaluation set",
        evidence: "specs/<capability>/data-contract.md" },
  G5: { phase: "Build",        needs: "every task checked off or deferred, every AC referenced by an automated test, the build green",
        evidence: "tasks.md" },
  G6: { phase: "Verify",       needs: "every criterion passing, negative and empty-state paths covered, no open high-severity defect",
        evidence: "evidence/g6-tests.txt" },
  G7: { phase: "Release",      needs: "a reproducible artifact, an exercised rollback path, and the blast radius stated in people",
        evidence: "evidence/g7-release.md" },
  G8: { phase: "Operate",      needs: "an SLI-### with an objective, an error budget, an alert that fires before it burns, and a runbook",
        evidence: "ops/slo.md" },
  G9: { phase: "Learn",        needs: "predicted outcome against measured, every INSIGHT-### routed to exactly one destination",
        evidence: "ops/postmortems/<change>.md" },
});

// Where the evidence for a gate most likely sits, resolved for a real change.
// A suggestion, not a rule — `gate` accepts any readable file.
function evidenceHint(gate, change) {
  const spec = GATES[gate];
  if (!spec) return null;
  return spec.evidence.startsWith("ops/")
    ? `delivery/${spec.evidence.replace("<change>", change)}`
    : `delivery/changes/${change}/${spec.evidence}`;
}

// The next thing to do, as lines ready to print. Shared by `status` and `gate`
// so the two can never give different advice about the same state — which they
// would, eventually, if each worked it out for itself.
function nextStepLines(state, laneGates) {
  const staleGates = new Set((state.stale || [])
    .filter((a) => a.startsWith("gate:")).map((a) => a.slice(5)));
  const next = laneGates.find((g) => staleGates.has(g))
    || laneGates.find((g) => !state.gates[g] || state.gates[g] === "fail");

  if (!next) {
    return ["Every gate settled.",
            `Next:  navi-delivery validate  \u2192  navi-delivery archive ${state.change}`];
  }
  const lines = [];
  if (staleGates.size) {
    lines.push(`${staleGates.size} gate(s) marked stale by a failure \u2014 re-record each before validate passes.`);
  }
  lines.push(`${next} reads: ${GATES[next].needs}.`);
  lines.push("");
  lines.push(`Next:  navi-delivery gate ${next} --pass --evidence ${evidenceHint(next, state.change)}`);
  return lines;
}

module.exports = { GATES, evidenceHint, nextStepLines };
