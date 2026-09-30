---
name: navi-skill-phase-gate-protocol
description: >
  Use when entering or leaving an ADLC phase, recording a gate verdict, or deciding whether
  a change may advance. Defines the nine phases, the entry and exit criteria of each gate,
  what counts as evidence, and how a failed gate propagates staleness.
  Trigger phrases include: gate, phase gate, G1, G2, G3, G4, G5, G6, G7, G8, G9, record a
  gate, gate verdict, can we advance, exit criteria, gate evidence, rework, stale artifacts.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: lifecycle-method
  lifecycle_phases: [1, 2, 3, 4, 5, 6, 7, 8, 9]
  used_by_agents: [navi-agent-orchestrator, navi-agent-product-owner, navi-agent-business-analyst, navi-agent-architect, navi-agent-fullstack-developer, navi-agent-data-engineer, navi-agent-machine-learning-engineer, navi-agent-mlops-engineer, navi-agent-devops-engineer, navi-agent-qa-engineer, navi-agent-security-engineer]
  owner: OWNER_TBD
  tags: "adlc, gates, lifecycle, governance"
  model: opus
---

## When to use

A phase is about to be entered or left, a gate verdict is about to be recorded, or a change
is asking to advance and the answer depends on which gates are settled.

## Rules

1. Record every gate decision through `navi-delivery gate <G#>`. A verdict asserted in prose
   and never recorded does not exist: `status`, `validate` and `archive` read only
   `.adlc/state.json` and `.adlc/events.jsonl`.
2. A gate takes exactly one of three verdicts: `pass`, `fail`, `waived`. There is no
   "conditional pass" and no "pass with follow-ups".
3. `--pass` and `--fail` both require `--evidence <path>` naming a file that exists on disk.
   The command refuses when the path does not resolve.
4. Record only gates inside the active lane's gate set. `gate` refuses any other gate with
   `<G#> is not in lane '<lane>'`. Changing which gates apply means changing the lane, which
   means a new proposal.
5. Record gates in ascending order within the lane. Recording `G6` before `G2` on a
   `standard` change is permitted by the CLI and is a protocol violation — fix the order
   rather than relying on the tool to stop it.
6. A `--fail` marks the failed gate and every later gate **in the same lane** stale, as
   `gate:<G#>` entries in `state.stale`. `validate` fails while any stale entry remains.
7. Clear a stale entry by re-recording that gate as `pass` or `waived`. Recording a gate
   clears its own stale entry and no other. Every stale gate is re-recorded individually.
8. Re-recording a gate is a supported path, not an error. The event log carries the prior
   verdict as `previous` on the new event; history is appended, never overwritten.
9. Never record a gate whose evidence was produced before the most recent failing change to
   its inputs. Regenerate the evidence, then record.
10. `archive` refuses until every gate in the lane is `pass` or `waived` and `state.stale`
    is empty. Do not attempt to archive around an outstanding gate; settle or waive it.
11. A gate that a lane does not enforce is skipped, not waived. Only an enforced gate that is
    not met can be waived, and waiving follows `navi-skill-waivers-and-deferrals`.
12. Consult `references/gates.md` for the entry criteria, exit criteria and accepted evidence
    of the specific gate before recording it. Do not infer them.

## Decision table

| Observed condition | Required action |
|---|---|
| Exit criteria in `references/gates.md` all met, evidence file on disk | `navi-delivery gate <G#> --pass --evidence <path>` |
| One or more exit criteria unmet | `navi-delivery gate <G#> --fail --evidence <path>`, then re-enter the owning phase |
| Exit criteria unmet but delivery must proceed | Waive per `navi-skill-waivers-and-deferrals`; never record `--pass` |
| Evidence file does not exist yet | Produce the evidence first; the command refuses the path |
| `gate` reports "not in lane" | The gate is out of scope for this lane — skip it, record nothing |
| `state.stale` is non-empty | Re-record each stale gate before advancing or archiving |
| A gate already has a verdict and inputs changed | Re-record it; the event carries `previous` |
| `archive` reports outstanding gates | Settle or waive each named gate, then archive |
| No active change (`no active change`) | Run `navi-delivery propose <name> --lane <lane>` first |
| Gate owner is unavailable and the gate is a human checkpoint | Block per `navi-skill-human-checkpoints`; never self-approve |

## Template

Recording a pass, with the evidence written first:

```bash
# 1. Produce the evidence the gate requires (see references/gates.md)
npm test -- --reporter=tap > delivery/changes/theme-persistence/evidence/g6-tests.tap

# 2. Record the verdict
navi-delivery gate G6 --pass --evidence delivery/changes/theme-persistence/evidence/g6-tests.tap
# => G6 pass (evidence: delivery/changes/theme-persistence/evidence/g6-tests.tap)

# 3. Confirm what the framework now believes
navi-delivery status
```

Recording a failure and working the rework loop:

```bash
navi-delivery gate G6 --fail --evidence delivery/changes/theme-persistence/evidence/g6-failures.md
# => G6 fail (evidence: ...)
# => rework required — 3 artifact(s) marked stale

navi-delivery status
#   G6  fail
#   stale artifacts (3) — rework required before validate passes:
#     gate:G6
#     gate:G7
#     gate:G8

# Fix the defect, regenerate evidence, then re-record G6 — this clears gate:G6 only.
navi-delivery gate G6 --pass --evidence delivery/changes/theme-persistence/evidence/g6-tests.tap
# => G6 re-recorded: fail -> pass (evidence: ...)

# G7 and G8 remain stale until each is itself re-recorded.
```

The rework record appended to `delivery/changes/<name>/handoffs.md`:

```yaml
- from: navi-agent-qa-engineer
  to: navi-agent-fullstack-developer
  phase: 6 → 5
  kind: rework
  gate: G6
  verdict: fail
  artifacts: [AC-007, AC-011]
  reason: "Empty-state criterion AC-011 has no implementation"
  stale: [gate:G6, gate:G7, gate:G8]
  skills_used: [navi-skill-phase-gate-protocol, navi-skill-release-readiness]
  assumptions: []
  open_questions: []
  confidence: high
```

## Checklist

- [ ] The gate being recorded is in the active lane's gate set
- [ ] `references/gates.md` consulted for this gate's exit criteria
- [ ] Every exit criterion is met, or the verdict is `fail` or `waived`
- [ ] The evidence file exists on disk and post-dates the last input change
- [ ] The verdict was recorded through `navi-delivery gate`, not asserted in prose
- [ ] On a fail, a rework record naming the phase to re-enter was written to `handoffs.md`
- [ ] `navi-delivery status` shows the verdict that was intended
- [ ] `state.stale` is empty before advancing past the failed gate or archiving

## Anti-patterns

**Prose verdict.** A handoff saying `G3 passed, design approved` with no `navi-delivery gate G3`
call. `status` still shows `G3 pending` and `archive` still refuses. Record the verdict.

**Conditional pass.** `G6 --pass` with a note that two tests are still red. There is no
conditional pass. Either the exit criteria are met (`--pass`), or they are not (`--fail`), or
the shortfall is a recorded, expiring waiver.

**Stale-clearing by assumption.** Re-recording `G6` as pass and assuming `G7` and `G8` are
now clean. Each gate clears only its own `gate:<G#>` entry. Re-record every stale gate.

**Recycled evidence.** Passing `G6` with the test report generated before the fix. Evidence
must post-date the last change to the thing it attests. Regenerate, then record.

**Skipping a gate into a waiver.** Waiving `G4` on an `express` change. `express` never
enforces `G4`, so there is nothing to waive — the command refuses. A gate outside the lane is
skipped and appears nowhere.

**Archiving around a gate.** Editing `state.json` by hand to clear an outstanding gate so
`archive` proceeds. This destroys the audit trail that the gate protocol exists to produce.
Settle the gate or waive it with an expiry.

**Out-of-order recording.** Recording `G7-RELEASE` while `G5-BUILD` is still pending because
the release branch happened to be cut first. Gates attest to a sequence of completed phases;
record them in lane order.

## Validation

```bash
navi-delivery status            # gate verdicts and stale set for the active change
navi-delivery validate          # fails while any artifact is stale
```

Every recorded decision is also readable in the append-only log:

```bash
grep '"gate":' delivery/.adlc/events.jsonl
```

Each line carries `ts`, `change`, `gate`, `verdict`, and either `evidence` or
`reason`/`expires`; a re-recorded gate also carries `previous`. A verdict visible in
`state.json` but absent from `events.jsonl` means `state.json` was edited by hand — restore
it by re-recording the gate through the CLI.
