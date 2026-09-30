# The nine ADLC gates

One section per gate. Each names the phase it closes, its owner or owners, what must be true to enter
the phase, what must be true to leave it, and what the framework accepts as evidence.

The lane decides which of these nine are enforced. A gate outside the active lane's set is
skipped and recorded nowhere; `navi-delivery gate` refuses it outright.

| Lane | Gates enforced |
|---|---|
| `express` | G2, G6, G7 |
| `standard` | G1, G2, G3, G5, G6, G7, G8 |
| `full` | G1, G2, G3, G4, G5, G6, G7, G8, G9 |
| `hotfix` | G2 (deferred, retroactive), G6, G7, G9 (mandatory) |

---

## G1-INTENT — closes Phase 1, Plan

**Owner:** Product Owner (`navi-agent-product-owner`)

**Entry criteria**
- A request, incident insight, or `INSIGHT-###` exists naming a desired outcome.
- No other change is active — `propose` refuses a second change in flight.

**Exit criteria**
- `proposal.md` exists with non-placeholder `Why`, `What changes`, `Impact` and `Non-goals`.
- The lane is declared in the proposal frontmatter and matches `state.lane`.
- At least one measurable outcome (a KPI, an SLI, or a named behaviour change) is stated.
- Every non-goal is a thing a reader would otherwise reasonably assume is in scope.

**Evidence accepted**
- `delivery/changes/<name>/proposal.md`.

**Not enforced by:** `express`, `hotfix`.

---

## G2-SPEC — closes Phase 2, Specify

**Owner:** Business Analyst (`navi-agent-business-analyst`)

**Entry criteria**
- G1 is `pass` or `waived`, or the lane does not enforce G1.
- The capability the change touches is identified.

**Exit criteria**
- Every `REQ-###` in the change's delta spec carries at least one `AC-###` under its heading.
- Every acceptance criterion is in Given/When/Then form with an observable outcome.
- Every requirement carries a MoSCoW priority.
- Open questions are recorded as `Q-###` rather than resolved by assumption.
- `validate_traceability.py` reports no T2 findings for the change's requirements.

**Evidence accepted**
- `delivery/changes/<name>/specs/<capability>/spec.md`.
- The `validate_traceability.py` output showing a clean T2.

**Enforced by every lane.** On `hotfix` it is deferred — see
`navi-skill-waivers-and-deferrals` for the retroactive-within-48-hours rule.

---

## G3-DESIGN — closes Phase 3, Architect

**Owners:** Architect and Security Engineer (`navi-agent-architect`,
`navi-agent-security-engineer`)

**Entry criteria**
- G2 is `pass` or `waived`.
- The requirements set is stable enough that the interfaces can be drawn.

**Exit criteria**
- `design.md` names the approach, the alternatives rejected, and the risks with mitigations.
- Every consequential decision has an `ADR-###` under `delivery/decisions/`.
- Component and data boundaries are named, with the interface contract at each boundary.
- The quality attributes the design optimises for are stated, along with what they cost.
- Every failure mode identified has a stated behaviour.
- A threat model covers the boundaries this design draws, naming what is worth taking and who
  would want it. Every threat it identifies is either designed out, mitigated by a named
  control, or accepted — and an accepted threat carries the person accepting it.

**Evidence accepted**
- `delivery/changes/<name>/design.md`.
- `delivery/decisions/ADR-###.md` for each decision the design depends on.
- The threat model for the change, and the `ADR-###` recording each accepted threat.

**Not enforced by:** `express`, `hotfix`.

---

## G4-DATA-MODEL — closes Phase 4, Data & Model

**Owners:** Data Engineer and ML Engineer (`navi-agent-data-engineer`,
`navi-agent-machine-learning-engineer`)

**Entry criteria**
- G3 is `pass` or `waived`.
- The change touches a dataset, a schema, a feature, or a model.

**Exit criteria**
- Every source dataset has a data contract: schema, ownership, freshness, and nullability.
- Lineage from source to consumed artifact is documented end to end.
- For an ML change: a baseline exists, the evaluation set is held out and leakage-checked,
  and the evaluation metric is tied to the outcome named in `proposal.md`.
- Data-quality checks and their thresholds are defined, with the behaviour on breach.
- PII is classified and its handling stated.

**Evidence accepted**
- The data contract files, the lineage document, the baseline evaluation report.

**Enforced by:** `full` only. A `standard` change that touches data or a model cannot record
G4 — see the note at the end of this file.

---

## G5-BUILD — closes Phase 5, Build

**Owners:** Developer, Data Engineer and ML Engineer (`navi-agent-fullstack-developer`,
`navi-agent-data-engineer`, `navi-agent-machine-learning-engineer`) — whichever of the three
built the thing, and all of those that did

**Entry criteria**
- G3 is `pass` or `waived`, and G4 where the lane enforces it.
- `tasks.md` exists with every `TASK-###` carrying an `Implements: REQ-###` line.

**Exit criteria**
- Every task in `tasks.md` is checked off or explicitly deferred to a later change.
- `validate_traceability.py` reports no T1 or T3 findings.
- Every acceptance criterion has at least one automated test referencing it.
- The build is green on the project's own test command.
- Code review is complete, with every blocking comment resolved.

**Evidence accepted**
- The build and test output.
- The `validate_traceability.py` output.
- The merge or review record.

**Not enforced by:** `express`, `hotfix`.

---

## G6-QUALITY — closes Phase 6, Verify

**Owners:** QA Engineer and Security Engineer (`navi-agent-qa-engineer`,
`navi-agent-security-engineer`)

**Entry criteria**
- G5 is `pass` or `waived`, or the lane does not enforce G5.
- A test strategy naming the risks and the coverage for each exists.

**Exit criteria**
- Every acceptance criterion has a passing test, or a recorded reason it is verified manually.
- The negative and empty-state criteria are covered, not only the happy path.
- No known defect of severity high or above is open against the change.
- Flaky tests are quarantined with an owner and a date, not re-run until green.
- Non-functional thresholds named in the spec are measured, not assumed.
- Every threat identified for this change has been exercised against it as built, and each
  dependency it ships is checked against known vulnerabilities. Where the lane enforces G3, the
  threat set is the one that gate's model named; where it does not, it is the change's own
  reach — what it newly lets someone see or do. Every finding carries a disposition: fixed,
  mitigated, not-applicable, or waived under `navi-skill-waivers-and-deferrals`.
- `not-applicable` is admissible only where the finding cannot be reached from anything this
  change ships — a dependency excluded from the shipped set, or a vulnerable path no shipped
  code calls — and only with the evidence for that non-reachability stated in the record
  beside it: the exclusion flag that removed it from the shipped set, or the reachability
  output that shows the path is not called. A `not-applicable` carrying no stated reason is a
  silent dismissal, not a disposition: the finding is still open and G6 is `--fail` until it
  ends in one of the four with its reason recorded.

**Evidence accepted**
- The test report (TAP, JUnit XML, or the project's own format).
- The defect list with severities.
- The security verification record: what was exercised, what was found, and the disposition of
  each finding, traced back to the threat it answers — and, for each `not-applicable`, the
  named evidence of non-reachability.

**Enforced by every lane.**

---

## G7-RELEASE — closes Phase 7, Release

**Owners:** DevOps Engineer and MLOps Engineer (`navi-agent-devops-engineer`,
`navi-agent-mlops-engineer`)

**Entry criteria**
- G6 is `pass` or `waived`.
- Release approval has been given by the named human — see `navi-skill-human-checkpoints`.

**Exit criteria**
- The deployment is reproducible from a recorded artifact version or commit.
- A rollback path exists, has been exercised, and its time-to-restore is known.
- The blast radius is stated: who is affected if this fails, and how many.
- Secrets used by the release are referenced, never embedded.
- For a model release: the model version is registered and the promotion criteria are met.

**Evidence accepted**
- The pipeline run record.
- The rollback rehearsal record.
- The release approval, naming the approving human.

**Enforced by every lane.**

---

## G8-OPERATE — closes Phase 8, Operate & Monitor

**Owners:** MLOps Engineer and DevOps Engineer (`navi-agent-mlops-engineer`,
`navi-agent-devops-engineer`)

**Entry criteria**
- G7 is `pass` or `waived` and the change is live in the target environment.

**Exit criteria**
- Every shipped capability has at least one `SLI-###` defined in `delivery/ops/slo.md`.
- Each SLI has an objective, an error budget, and an alert that fires before the budget burns.
- A runbook exists under `delivery/ops/runbooks/` for each alert that can page a human.
- For a model: drift and decay monitors are live with thresholds and an owner.
- Telemetry is confirmed arriving, not merely configured.

**Evidence accepted**
- `delivery/ops/slo.md`.
- The runbook paths.
- A dashboard or query output showing telemetry arriving.

**Not enforced by:** `express`, `hotfix`.

---

## G9-FEEDBACK — closes Phase 9, Learn & Evolve

**Owners:** Product Owner and Architect (`navi-agent-product-owner`, `navi-agent-architect`)

**Entry criteria**
- G8 is `pass` or `waived`, or the change is a hotfix closing out an incident.
- Enough time has passed to observe the outcome the proposal committed to.

**Exit criteria**
- The predicted outcome is compared against the measured one, with the gap named.
- Every insight is recorded as `INSIGHT-###` in `delivery/ops/postmortems/<name>.md`.
- Every insight is routed to exactly one destination: the product backlog as a candidate
  requirement, or a skill amendment as a PR against a `navi-skill-*` file.
- For a hotfix: the postmortem names the contributing causes and the control that failed.

**Evidence accepted**
- `delivery/ops/postmortems/<name>.md` with routed insights.

**Enforced by:** `full` and `hotfix`. On `standard` it is batched across changes rather than
recorded per change; `archive` does not require it there.

---

## Known gap: G4 on the `standard` lane

The design spec describes the `standard` lane as enforcing "G4 only if data/ML touched".
`cli/lib/lanes.js` implements `standard` as a fixed set that does not contain G4, and
`navi-delivery gate` refuses any gate outside the lane's set. A `standard` change that turns
out to touch data or a model therefore cannot record G4 at all.

Until that is reconciled, a change that touches a dataset, a schema, a feature or a model
takes the `full` lane. Deciding this at proposal time is the job of
`navi-skill-lane-selection`; discovering it mid-change is a re-proposal, not a lane edit.
