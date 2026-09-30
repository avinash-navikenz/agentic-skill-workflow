# ADLC — the Agentic Delivery Lifecycle

Nine phases. Nine gates. Four lanes. One rule about rework, and one loop that closes.

This is the methodology reference. The operational detail — the exact entry and exit
criteria of each gate and the evidence each accepts — lives in
`skills/lifecycle-method/navi-skill-phase-gate-protocol/references/gates.md`, which is what
an agent actually reads before recording a verdict. This file explains the shape and the
reasoning; that file is the authority on the criteria.

---

## 1. The nine phases

| # | Phase | Gate | Owner |
|---|---|---|---|
| 1 | Plan | G1 | Product Owner |
| 2 | Specify | G2 | Business Analyst |
| 3 | Architect | G3 | Architect + Security Engineer |
| 4 | Data & Model | G4 | Data Engineer + ML Engineer |
| 5 | Build | G5 | Developer / Data Engineer / ML Engineer |
| 6 | Verify | G6 | QA Engineer + Security Engineer |
| 7 | Release | G7 | DevOps Engineer + MLOps Engineer |
| 8 | Operate & Monitor | G8 | MLOps Engineer + DevOps Engineer |
| 9 | Learn & Evolve | G9 | Product Owner + Architect |

Mapped onto the change lifecycle the CLI implements:

```
explore → propose → design → apply → verify → release → operate → archive
```

Phases are not a waterfall. Phase 6's owner is consulted at phase 2 — testability of an
acceptance criterion is cheapest to fix while the criterion is still being written — and
the Architect reviews phase 5 output against the design that phase 3 settled. Consultation
is recorded as a handoff with `kind: review`, not as a phase transition.

### A note on gate identifiers

**`G1` through `G9` are the identifiers.** The CLI, `cli/lib/lanes.js`, `state.json` and
`events.jsonl` all use the bare form, and `navi-delivery gate G2 --pass` is the only
spelling that works.

The suffixed forms — `G1-INTENT`, `G2-SPEC`, `G3-DESIGN`, `G4-DATA-MODEL`, `G5-BUILD`,
`G6-QUALITY`, `G7-RELEASE`, `G8-OPERATE`, `G9-FEEDBACK` — appear in prose, in agent
descriptions and in the gates reference. **The suffix is descriptive only.** It is a
mnemonic for readers, never an identifier a tool matches. `G2` and `G2-SPEC` are the same
gate; only `G2` is typed.

---

## 2. The nine gates

Each gate has entry criteria (what must be true to *start* the phase), exit criteria (what
must be true to *leave* it), and evidence the framework will accept. A verdict is one of
exactly three values: `pass`, `fail`, `waived`. There is no conditional pass and no pass
with follow-ups.

| Gate | Closes | Exit criteria, in short | Evidence |
|---|---|---|---|
| **G1** | Plan | `proposal.md` filled in, lane declared and justified, at least one measurable outcome, non-goals that a reader would otherwise assume were in scope | `proposal.md` |
| **G2** | Specify | Every `REQ-###` carries at least one `AC-###`; criteria in Given/When/Then with an observable outcome; MoSCoW priority on each requirement; open questions recorded as `Q-###` rather than assumed away; no T2 findings | the delta `spec.md`, the traceability output |
| **G3** | Architect | Approach, alternatives rejected, risks with mitigations; an `ADR-###` per consequential decision; boundaries named with an interface contract at each; quality attributes stated with what they cost; every failure mode carrying a stated behaviour; a threat model whose every threat is designed out, mitigated, or accepted by a named person | `design.md`, the ADRs, the threat model |
| **G4** | Data & Model | A data contract per source dataset; end-to-end lineage; for ML, a baseline plus a held-out, leakage-checked evaluation set whose metric ties to the proposal's outcome; data-quality thresholds with on-breach behaviour; PII classified and its handling stated | contracts, lineage doc, baseline report |
| **G5** | Build | Every task checked off or explicitly deferred; no T1 or T3 findings; every acceptance criterion referenced by at least one automated test; the project's own build green; code review complete with blocking comments resolved | build and test output, traceability output, review record |
| **G6** | Verify | Every criterion passing, or a recorded reason it is verified manually; negative and empty-state paths covered, not only the happy path; no open high-severity defect; flaky tests quarantined with an owner and a date rather than re-run until green; non-functional thresholds measured; every threat exercised as built and every shipped dependency checked, each finding dispositioned fixed / mitigated / not-applicable / waived | test report, defect list, security verification record |
| **G7** | Release | Deployment reproducible from a recorded artifact version or commit; a rollback path that has been exercised, with a known time-to-restore; blast radius stated in people; secrets referenced rather than embedded; for a model, the version registered and promotion criteria met | pipeline run, rollback rehearsal, named human approval |
| **G8** | Operate | Every shipped capability carrying an `SLI-###` in `ops/slo.md`, each with an objective, an error budget, and an alert that fires before the budget burns; a runbook for every alert that can page a human; drift and decay monitors live for a model; telemetry confirmed arriving, not merely configured | `ops/slo.md`, runbook paths, a query showing telemetry arriving |
| **G9** | Learn | Predicted outcome compared against measured, with the gap named; every insight recorded as `INSIGHT-###`; every insight routed to exactly one destination; for a hotfix, the contributing causes and the control that failed | `ops/postmortems/<name>.md` with routed insights |

### Evidence

`--pass` and `--fail` both require `--evidence <path>` naming something that exists on
disk. A verdict asserted in prose and never recorded does not exist: `status`, `validate`
and `archive` read only `.adlc/state.json` and `.adlc/events.jsonl`.

**The check is shape, not content.** Evidence must be a regular, non-empty file; a
directory, a device and a zero-byte file are each refused with their own message. The gate
records that evidence was *named* and that something is there to open; a human reviewing the
change is what establishes that the evidence says anything. Treat the path as a citation, and
make it one a reader can follow.

**Every gate decision is attributed.** The event carries `actor` and `actor_source` — see
[docs/CLI.md](docs/CLI.md) — so a gate co-owned by two agents, as G3 and G6 are, shows which
owner recorded the verdict.

Never record a gate whose evidence was produced before the most recent change to that
gate's inputs. Regenerate, then record.

---

## 3. The four lanes

Proportionality is what keeps the framework in daily use. Forcing nine gates onto a flag
flip guarantees it is abandoned by week two. The lane is declared at `propose` time,
written into `state.lane` and the proposal frontmatter at the same moment, and it decides
which gates are enforced for the life of the change.

| Lane | Trigger | Gates enforced |
|---|---|---|
| `express` | copy, a config value, a flag flip | G2 · G6 · G7 |
| `standard` | most features and bug fixes | G1 · G2 · G3 · G5 · G6 · G7 · G8 |
| `full` | a new capability, regulated work, or anything touching data or a model | all nine |
| `hotfix` | an active production incident | G2 (deferred, retroactive within 48h) · G6 · G7 · G9 (mandatory postmortem) |

### Choosing

- **By the highest-severity characteristic present, never the average.** One regulated data
  field in an otherwise trivial change makes the whole change `full`.
- **Anything touching a dataset, schema, feature store or model takes `full`** — see the G4
  gap below.
- **`hotfix` means production is degraded right now.** A bug found before release is
  `standard`.
- **`express` only when the change alters no behaviour a test could distinguish** beyond the
  literal string, value or flag being changed.
- **Where two lanes both fit, take the wider one.** The cost of an unnecessary gate is hours.
  The cost of a missing gate is an incident.

`navi-skill-lane-selection` carries the full decision table.

### Lanes are not widened in place

`state.lane` is never hand-edited. A change that outgrows its lane is closed out and
re-proposed under the correct one. Closing out means waiving every unsettled gate — with a
reason naming the abandonment and the superseding change, and a real expiry — and then
archiving. There is no `abandon` verb; `archive` refuses while any gate is pending.

### Skipped is not waived

A gate outside the active lane's set is **skipped**: recorded nowhere, and
`navi-delivery gate` refuses it outright with `<G#> is not in lane '<lane>'`. Only an
enforced gate that cannot be met is **waived**, and a waiver requires a reason and a real
calendar expiry strictly in the future, appended as a row to `.adlc/waivers.md` and as an
event. An expiry is the entire control on a waiver, which is why the CLI refuses a past
date, a non-date, or a date like `2026-02-30` that does not exist.

**A waiver attaches to the whole gate.** One reason and one expiry cover every criterion
that gate checks, so a single unfixable finding waives the gate rather than itself. Write
the reason so the next reader can tell which criterion was actually in question.

### The G4 gap on `standard`

The original design described `standard` as enforcing "G4 only if data or ML is touched".
`cli/lib/lanes.js` implements `standard` as a fixed set that does not contain G4, and
`gate` refuses any gate outside the set. **A `standard` change that turns out to touch data
or a model therefore cannot record G4 at all.**

Until that is reconciled, lane selection routes anything touching a dataset, schema,
feature or model to `full` at proposal time. Discovering it mid-change is a re-proposal,
not a lane edit.

---

## 4. Rework

A failed gate does not simply block. It propagates.

1. `navi-delivery gate G6 --fail --evidence <path>` records the verdict.
2. The failed gate **and every later gate in the same lane** are marked stale, as
   `gate:<G#>` entries in `state.stale`.
3. `navi-delivery validate` fails while any stale entry remains. Rework cannot be silently
   skipped past.
4. A rework record is written to `changes/<name>/handoffs.md` naming the phase to re-enter,
   the gate, the artifacts implicated, and the reason.
5. Each stale gate is cleared by **re-recording that gate individually** as `pass` or
   `waived`. Recording a gate clears its own stale entry and no other — a passing G6 does
   not vouch for G7.

Re-recording is a supported path, not an error. The event log carries the prior verdict as
`previous` on the new event, and the command itself says
`G6 re-recorded: fail -> pass (evidence: ...)`. History is appended, never overwritten.

Only gates the current lane enforces are marked stale. Marking G8 stale on an `express`
change would create an entry that could never be recorded, and so never cleared.

### Specs change first

A code change that outruns its spec is a defect, not a shortcut. When rework changes what
the thing does, the spec moves before the code does, and the gates from G2 forward are
re-recorded on the new spec. See [`SDD.md`](SDD.md).

---

## 5. The loop back to Plan

Phase 9 is not a retrospective that ends in a document nobody reads. It is the phase that
feeds phase 1.

`navi-delivery archive <name>` folds the change's delta spec into `delivery/specs/`, moves
the change to `changes/archive/<date>-<name>/`, and writes an insight stub to
`delivery/ops/postmortems/<name>.md`.

Every `INSIGHT-###` names **exactly one** destination:

1. **The product backlog** — a candidate `REQ-###` for a future change. The loop closes
   into phase 1 as new intent.
2. **A skill amendment** — a pull request against a `navi-skill-*` file. The loop closes
   into the framework itself.

The second path is the whole point. A postmortem that reveals a wrong standard should
change the standard, in the file the next team will actually load, rather than in a wiki
page nobody opens. An insight with no destination closes no loop and is not an insight.

```
Plan ─→ Specify ─→ Architect ─→ Data & Model ─→ Build ─→ Verify ─→ Release ─→ Operate ─→ Learn
 ↑                                                                                        │
 │                                    INSIGHT-### → product backlog                       │
 └────────────────────────────────────────────────────────────────────────────────────────┘
                                      INSIGHT-### → skill amendment → this repository
```

---

## 6. Where each rule is enforced

| Rule | Enforced by |
|---|---|
| A gate outside the lane cannot be recorded | `cli/commands/gate.js`, `cli/lib/lanes.js` |
| Evidence path must exist | `cli/commands/gate.js` |
| A waiver needs a reason and a real future expiry | `cli/commands/gate.js` |
| A failed gate marks later gates stale | `cli/commands/gate.js` |
| `validate` fails while stale | `cli/commands/validate.js` |
| `archive` refuses with gates pending or artifacts stale | `cli/commands/archive.js` |
| Every requirement has a criterion; every task a requirement | `scripts/validate_traceability.py` |
| All four lanes stay correct | `scripts/golden_path.py`, in CI |

A phase that emits no telemetry did not happen. A gate whose verdict was never recorded
was never passed.
