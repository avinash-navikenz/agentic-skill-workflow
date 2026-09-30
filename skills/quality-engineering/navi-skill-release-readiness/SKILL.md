---
name: navi-skill-release-readiness
description: >
  Use when answering whether a change is safe to release, when G6 is about to be recorded, or
  when the release decision needs an honest statement of residual risk. Defines the release
  report and its three mandatory sections — proven, sampled, untouched — into exactly one of
  which every criterion, risk and threat must fall; the defect and flakiness records; the
  disposition of every security finding; and the separation of the recommendation from the
  decision.
  Trigger phrases include: release readiness, go/no-go, are we ready to ship, ship decision,
  release report, residual risk, release blocker, known defects, sign off the release,
  release criteria, what is proven, what is untested, G6 evidence, gate G6.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: quality-engineering
  lifecycle_phases: [6, 7]
  used_by_agents: [navi-agent-qa-engineer, navi-agent-devops-engineer]
  owner: avinash.negi@navikenz.com
  tags: "quality, release, readiness, residual-risk, defects, go-no-go, g6, g7"
  model: opus
---

## When to use

G6 is about to be recorded; someone has asked whether the change is done; a release approval is
being sought and the approver needs to know what is unresolved; or a defect has been found late
and the question is whether it blocks.

## Rules

1. Write the release report at `delivery/changes/<name>/evidence/g6-quality.md`. It is the one
   path G6 is recorded against — `navi-delivery gate` accepts exactly one `--evidence` value
   and checks only that it resolves, while `references/gates.md`'s G6 evidence list names the
   test report, the defect list and the security verification record. The report indexes all
   three and is passed in their place.
2. Answer "are we done" in exactly three sections, in this order: `## Proven`, `## Sampled`,
   `## Untouched`. The three are what the question actually has three answers to, and the word
   "done" collapses them into the most flattering one.
3. Place every `AC-###` in the change's spec, every `RISK-###` in `test-strategy.md` and every
   `THREAT-###` in the threat model into **exactly one** of the three. Nothing appears twice
   and nothing is omitted: an item missing from all three is the one the release decision
   discovers after the release.
4. `## Proven` means a passing automated test that names the `AC-###`, or a manual verification
   recorded with the person and the date. Name the run identifier, so the claim points at
   something that can be re-read rather than at a memory of a green pipeline.
5. `## Sampled` means exercised at less than the population — a subset of devices, one region,
   synthetic load below peak, a slice of the data, one tenant's configuration. State what was
   sampled and what the sample excluded. A sampled result reported as proven is the single most
   common way a release decision is misinformed, and it is misinformed in the confident
   direction.
6. `## Untouched` means nothing exercised it. It is `test-strategy.md`'s `## Not covered` plus
   everything the run failed to reach. Each entry names the risk that remains and the person
   who accepted it. An empty `## Untouched` is a claim that the suite is complete, and it is
   almost always a claim that nobody looked.
7. Never report a coverage percentage in place of the three sections. A percentage answers a
   question nobody asked — it says how much of the code ran, not which of the promises hold.
8. List every known defect with an id, a severity, the `AC-###` or `RISK-###` it touches, the
   workaround if there is one, and an owner. G6's exit criterion is that no defect of severity
   high or above is open against the change; a defect downgraded to make the gate pass is
   recorded with the downgrade and who made it.
9. Record every flaky test as quarantined with an owner and a review date, and record the
   **first** verdict rather than the re-run that went green. G6 requires exactly this, and a
   re-run recorded as the result deletes the only evidence that anything was wrong.
10. Carry every security finding's disposition — `fixed`, `mitigated`, `not-applicable` or
    `waived` — and, for each `not-applicable`, the named evidence of non-reachability that
    G6's criterion requires. `navi-skill-dependency-vulnerabilities` and
    `navi-skill-threat-modelling` produce these; this report is where the gate reads them.
11. Put the measured value beside every non-functional threshold, with the instrument and the
    conditions from the `QAS-###`. G6 requires those thresholds measured rather than assumed,
    and a threshold quoted without its measurement is the assumption the criterion forbids.
12. State a recommendation and the residual risk; never record the decision. The recommendation
    is this report's; release approval belongs to a named person under
    `navi-skill-human-checkpoints`, which also forbids the agent that produced the artifact
    from approving it. Making the risk legible and accepting it are two different acts, and a
    report that performs both makes neither checkable.
13. Disclose every open question and every unsettled waiver in the report before approval is
    sought. `navi-skill-human-checkpoints` rule 8 voids an approval given without them, so an
    undisclosed waiver costs the approval it was hiding from.
14. Record G6 `--fail` where an exit criterion is unmet. `cli/commands/gate.js` marks every
    later gate in the lane stale on a fail, which is the intended behaviour: the rework is the
    point, and re-recording the gate clears its own staleness. Passing now and waiving later
    records a verdict that was never true.
15. Waive with the criterion named. `gate --waive` attaches one reason and one expiry to the
    whole gate, so one unmet criterion waives all of G6 — the reason therefore names each
    unmet criterion, and where several are waived the earliest expiry is the one to take.
16. Name the operational readiness this report depends on rather than re-specifying it: the
    rollback rehearsed with a measured time-to-restore
    (`navi-skill-pipeline-automation`), the rollout's halt conditions live
    (`navi-skill-progressive-delivery`), a runbook for every alert that can page
    (`navi-skill-observability`), and the `SLI-###` defined in `delivery/ops/slo.md`. G7's
    entry needs G6 settled; G7's own criteria need these, and a report that omits them hands
    the approver half a decision.
17. Re-issue the report when its subject changes — a new commit, a re-run, a defect found after
    it was written. `navi-skill-human-checkpoints` rule 11 expires an approval when what it
    approved changes, so a stale report produces an approval of something that no longer exists.
18. Expect `archive` to refuse until every gate the lane enforces is `pass` or `waived` and
    nothing is stale. A change left with G6 failed is not an administrative oversight; it is
    the framework holding the change open, which is what it is for.

## Decision table

| Observed condition | Required action |
|---|---|
| Someone asks whether we are done | Answer in `## Proven`, `## Sampled`, `## Untouched` — never in one word |
| An `AC-###` appears in none of the three sections | Place it; the unplaced item is the one discovered after release |
| An item appears in two sections | Place it in the weakest one that applies |
| A result from one region is being reported as proven | It is sampled — state the region and what the sample excluded |
| `## Untouched` is empty | Re-read `test-strategy.md`'s `## Not covered`; an empty list is usually an unexamined one |
| Coverage is being reported as a percentage | Replace with the three sections |
| A high-severity defect is open | G6 is `--fail`; a downgrade is recorded with who made it |
| A test passed on the third run | Record the first verdict and quarantine the test with an owner and a date |
| A security finding is `not-applicable` | Record the evidence of non-reachability beside it, or the finding is still open |
| A non-functional threshold has no measured value | Measure it with the `QAS-###`'s instrument; a quoted threshold is the assumption G6 forbids |
| The report records the approval | Remove it — the report recommends, a named person decides |
| A waiver is unsettled and approval is being sought | Disclose it first; an approval given without it is void |
| An exit criterion is unmet | `--fail`, take the rework, re-record — never `--pass` intending to waive later |
| Several criteria are being waived at once | Name each in the reason and take the earliest expiry |
| The rollback has not been rehearsed | Say so in the report; G7's own criterion needs it and the approver is deciding both |
| A commit lands after the report was written | Re-issue it; the approval expires with its subject |
| `archive` refuses | Read the outstanding gate — the change is being held open deliberately |

## Template

Copy into `delivery/changes/<name>/evidence/g6-quality.md`:

```markdown
# Release report — theme-persistence

Build: commit `4c1d9b2e7a3f5086bb14c0d9e2a7f3651c8d4b09`, artifact `sha256:9b2c41e0...`,
pipeline run `https://github.com/example/web-shell/actions/runs/1842771903`.
Written 2026-09-28 14:10 UTC. Re-issue this report if anything below changes.

Indexes the three artifacts G6's evidence list names: the test report
(`reports/junit.xml`, run `1842771903`), the defect list (`## Known defects` below), and the
security verification record (`## Security findings` below).

## Proven

Each of these has a passing automated test naming its criterion, in run `1842771903`, or a
recorded manual verification.

| Item | How | Evidence |
|---|---|---|
| AC-011 | integration, `test/integration/two-tab.spec.ts::AC-011 …` | run 1842771903, 26/26 integration passed |
| AC-013 | unit, TC-003 / TC-008 / TC-009 | run 1842771903 |
| AC-015 | integration with the store faulted, TC-011 | run 1842771903 |
| AC-019 | manual, kiosk device | Sam Idowu, 2026-09-27 |
| RISK-002 | unit, the resolver is a pure function and all input classes are covered | run 1842771903 |
| RISK-004 | integration with the dependency faulted | run 1842771903 |
| THREAT-004 | its `Verify` line, run against this build | `security/threat-004.sh`, run 1842771903 |
| THREAT-001 | its `Verify` line, run against this build | `npm run test:security -- --grep "session-forgery"`, run 1842771903 |
| THREAT-002 | designed out at G3; the control test asserts the write takes no user id from the request | `test/security/preference-write-ignores-body-userid.spec.ts`, run 1842771903 |
| THREAT-003 | its `Verify` line, run against this build | `npm run test:security -- --grep "log-redaction"`, run 1842771903 |

## Sampled

Exercised at less than the population. These are **not** proven, and the difference is what the
release decision is being asked to accept.

| Item | Sampled | Excluded from the sample |
|---|---|---|
| AC-016 (p95 under 400ms) | staging, 1.2x peak RPS, 30-minute steady state; measured p95 372ms | staging holds 1/8 of production's data, so the measurement is optimistic. QAS-002 records the conditions; the production figure is first observable during ROLL-002's soak. |
| RISK-001 | Chrome 131 and Safari 18 on macOS and iOS | Firefox, and every browser older than two years — 7% of sessions |
| AC-018 | one enterprise tenant's configuration | the other five tenants, whose session stores are partitioned differently |
| RISK-006 | the crafted-value path against one enterprise tenant's partitioning, with the boundary's own verification run against this build | the other five tenants' partitioning. The verification is proven; the partition boundary it runs against is one of six, so the risk is sampled rather than proven. |

## Untouched

Nothing exercised these. Taken from `test-strategy.md`'s `## Not covered`, plus what this run
did not reach.

| Item | Risk that remains | Accepted by |
|---|---|---|
| The kiosk fleet's own browser build | ~2,000 kiosk sessions a day are represented by a single manual pass and by no automated case. The resolver risk these sessions touch is proven at unit level and is recorded in `## Proven`, not restated here — an item belongs to one section only, and this row is the environment, not the risk. | Priya Raman, 2026-09-26 |
| Concurrent writes from two tabs of different users sharing a device | A shared-device write could be attributed to the wrong user; last-write-wins is specified and the case is not exercised | Priya Raman, 2026-09-26 |
| RISK-005 | The store migration has not been run backwards against production-shaped data, so the rollback route stated in `design.md` `## Failure modes` is an assertion rather than a fact | Ana Costa, 2026-09-28 — and it is the reason this report recommends starting at ROLL-001 rather than ROLL-002 |
| RISK-003 | Cross-region read latency was measured in staging only; the ap-southeast path was never exercised at production data volume | Ana Costa, 2026-09-28 |

## Known defects

| Id | Severity | Touches | Workaround | Owner |
|---|---|---|---|---|
| DEF-118 | medium | AC-012 | The preference re-applies on the second render; a user sees one frame of the previous theme | Sam Idowu |
| DEF-121 | low | RISK-003 | None needed — cosmetic, affects the settings screen only | Sam Idowu |

No defect of severity high or above is open. No defect was downgraded during this change.

## Quarantined tests

| Test | First verdict | Quarantined | Owner | Review by |
|---|---|---|---|---|
| `test/integration/store-timeout.spec.ts::AC-015 …` | fail, run 1842770441 | 2026-09-27 | Sam Idowu | 2026-10-08 |

The first verdict is recorded. The test passed on a re-run; that re-run is not the result.

## Security findings

| Finding | Source | Disposition | Evidence |
|---|---|---|---|
| THREAT-004 | threat model | mitigated | Control in `design.md` CONTRACT-002; failing test `security/threat-004.sh` |
| GHSA-xxxx-yyyy-zzzz | `npm audit` | not-applicable | The package is in `devDependencies` and excluded from the shipped set by `--omit=dev`; STAGE-003's output shows it absent from the production lockfile resolution |
| CVE-2026-11841 | container scan | fixed | Base image moved to `node:22.11.0-bookworm-slim@sha256:0f1a…` in commit 4c1d9b2 |

## Non-functional measurements

| AC | QAS | Threshold | Measured | Instrument and conditions |
|---|---|---|---|---|
| AC-016 | QAS-002 | p95 <= 400ms | 372ms | `k6 run perf/first-render.js`, 1.2x peak, 30-minute steady state, staging |
| AC-017 | QAS-003 | error rate <= 0.001 | 0.0004 | client beacon feeding SLI-001, staging, same window |

## Operational readiness

- Rollback rehearsed 2026-09-24, measured time-to-restore 3m 41s; the deploy path has not
  changed since — `delivery/ops/delivery-pipeline.md` STAGE-005
- Halt conditions for every wave are live and evaluated automatically —
  `delivery/changes/theme-persistence/rollout.md`
- ALERT-001 and ALERT-004 have runbooks under `delivery/ops/runbooks/`
- SLI-001 and SLI-004 are defined in `delivery/ops/slo.md` with objectives and error budgets

## Open questions and unsettled waivers

- Q-007 remains open: whether the kiosk fleet's browser will be upgraded this quarter. It does
  not change any criterion; it changes how long the `## Untouched` entry stays there.
- No gate on this change is currently waived.

## Recommendation

Release, starting at ROLL-001 and holding at ROLL-002 until the store migration has been run
backwards against production-shaped data — the third `## Untouched` entry is the reason.
Residual risk if released as recommended: the kiosk population and the older-browser 7% are
represented by one manual pass and nothing respectively, and the p95 figure is from an
environment with an eighth of the data.

**This is a recommendation, not a decision.** Release approval is Priya Raman's, recorded as a
`kind: review` handoff envelope under `navi-skill-human-checkpoints`.
```

Recording the gate — pass, fail, or waived with the criterion named:

```bash
# Met: record the pass against the report, not against the test output
navi-delivery gate G6 --pass --evidence delivery/changes/theme-persistence/evidence/g6-quality.md
# => G6 pass (evidence: delivery/changes/theme-persistence/evidence/g6-quality.md)

# Unmet: fail it. Later gates in the lane are marked stale, which is the rework.
navi-delivery gate G6 --fail --evidence delivery/changes/theme-persistence/evidence/g6-quality.md
# => G6 fail (evidence: …)
# => rework required — 3 artifact(s) marked stale

# Shipping short of a criterion: name each unmet criterion; the earliest expiry wins
navi-delivery gate G6 --waive "AC-018 is verified against one tenant of six; the other five are partitioned differently and the harness for them is TASK-047. DEF-118 (medium) remains open with a stated workaround." --expires 2026-11-15
# => G6 waived until 2026-11-15
```

## Checklist

- [ ] The report is at `delivery/changes/<name>/evidence/g6-quality.md` and indexes all three G6 artifacts
- [ ] `## Proven`, `## Sampled` and `## Untouched` all exist, in that order
- [ ] Every `AC-###`, `RISK-###` and `THREAT-###` is in exactly one of the three
- [ ] Every `## Proven` row names a run identifier or a person and a date
- [ ] Every `## Sampled` row states what the sample excluded
- [ ] Every `## Untouched` row names the remaining risk and who accepted it
- [ ] No coverage percentage appears anywhere in the report
- [ ] Every known defect has an id, a severity, what it touches, a workaround and an owner
- [ ] No defect of severity high or above is open, and any downgrade names who made it
- [ ] Every flaky test is quarantined with an owner and a review date, and its first verdict is recorded
- [ ] Every security finding has a disposition, and every `not-applicable` its non-reachability evidence
- [ ] Every non-functional threshold has a measured value, an instrument and its conditions
- [ ] Operational readiness is named: rehearsed rollback, live halt conditions, runbooks, SLIs
- [ ] Every open question and unsettled waiver is disclosed
- [ ] The report recommends; no approval is recorded in it
- [ ] The report's build identity matches the commit being released

## Anti-patterns

**"We're done."** One word for three different states. The part that gets hidden is always the
third one, because nobody volunteers what they did not look at. Three sections, always.

**Sampled reported as proven.** `AC-016: passed.` It passed in staging, at an eighth of
production's data volume, once. The approver reads "passed" and decides as if the population had
been exercised. Say what the sample excluded.

**The empty untouched list.** Every criterion in `## Proven`, nothing in `## Untouched`. The
strategy's `## Not covered` has three entries. The report is not describing the same change the
strategy planned. Copy them across.

**The percentage instead of the answer.** `84% coverage, recommend ship.` It says how much code
ran, not which promises hold. The uncovered 16% is the error branch, which is the only part
anyone was worried about.

**The defect downgraded at the gate.** A high becomes a medium on the morning of the release,
with no new information. G6 passes. Record the downgrade and who made it, and let the gate see
what it was before.

**The re-run recorded as the result.** The suite went red, someone re-ran it, it went green, and
the report says green. The first verdict was the true one and it is now unrecorded. Record the
first, quarantine the test.

**`not-applicable` with no reason.** A scanner finding waved away in a word. G6's criterion
makes an unexplained `not-applicable` a silent dismissal rather than a disposition — the
finding is still open. State the exclusion flag or the reachability output.

**The report that approves itself.** `Release approved — QA sign-off.` The producer of the
artifact has approved it, which `navi-skill-human-checkpoints` forbids, and the person whose
name should be on the decision never saw it. Recommend; let the approver decide.

**The undisclosed waiver.** G4 was waived three weeks ago and the report does not mention it.
The approval given on this report is void the moment it surfaces, and it surfaces at the worst
time. Disclose every unsettled waiver.

**The stale report.** Two commits landed after the report was written and the approval was
given against the earlier build. What shipped was never the thing that was approved. Re-issue
on any change to the subject.

## Validation

```bash
CHANGE=<name>
R=delivery/changes/$CHANGE/evidence/g6-quality.md
SPEC=$(find delivery/changes/$CHANGE/specs -name spec.md 2>/dev/null | head -1)
T=delivery/changes/$CHANGE/test-strategy.md
TM=delivery/changes/$CHANGE/threat-model.md

test -f "$R" || echo "no release report at $R"

# The three sections exist, in order
awk '/^## Proven$/{p=NR} /^## Sampled$/{s=NR} /^## Untouched$/{u=NR}
     END{ if(!p) print "no ## Proven"; if(!s) print "no ## Sampled"; if(!u) print "no ## Untouched";
          if(p && s && u && !(p < s && s < u)) print "the three sections are out of order" }' "$R"

# Every AC, RISK and THREAT is in exactly one of the three
sec() { awk -v h="^## $1\$" '$0 ~ h {on=1;next} /^## /{on=0} on' "$R"; }
# Each id family is read from the one file that owns it: criteria from the change's spec, risks
# from the strategy's own entries, threats from the threat model. Scanning every file for every
# family picks up ids a file merely mentions — the strategy names threats it decided not to
# cover — and reports them as missing from a report that was never meant to carry them.
ids=""
[ -f "$SPEC" ] && ids="$ids $(grep -oE 'AC-[0-9]{3,}' "$SPEC" | sort -u)"
[ -f "$T" ]    && ids="$ids $(grep -oE '^### (RISK-[0-9]{3,})' "$T" | grep -oE 'RISK-[0-9]{3,}' | sort -u)"
[ -f "$TM" ]   && ids="$ids $(grep -oE '^### (THREAT-[0-9]{3,})' "$TM" | grep -oE 'THREAT-[0-9]{3,}' | sort -u)"
for id in $(printf '%s\n' $ids | sort -u); do
  n=0
  for sec_name in Proven Sampled Untouched; do
    sec "$sec_name" | grep -q "$id" && n=$((n+1))
  done
  [ "$n" -eq 1 ] || echo "$id appears in $n of the three sections (must be exactly 1)"
done

# Every Proven row names a run identifier or a person and a date
sec Proven | grep '^| ' | grep -v '^| Item' | grep -v '^| *-' \
  | grep -vE 'run [0-9]+|[0-9]{4}-[0-9]{2}-[0-9]{2}' \
  | sed 's/^/proven row with no run identifier or date: /'

# Every Sampled row says what the sample excluded
sec Sampled | grep '^| ' | grep -v '^| Item' | grep -v '^| *-' \
  | awk -F'|' '$4 ~ /^[[:space:]]*$/ {print "sampled row with nothing excluded stated: "$2}'

# Every Untouched row names an acceptor
sec Untouched | grep '^| ' | grep -v '^| Item' | grep -v '^| *-' \
  | awk -F'|' '$4 ~ /^[[:space:]]*$/ {print "untouched row with nobody accepting it: "$2}'

# Untouched is not empty while the strategy records gaps
if [ -f "$T" ]; then
  g=$(awk '/^## Not covered$/{on=1;next} /^## /{on=0} on' "$T" | grep -c '^| ')
  u=$(sec Untouched | grep -c '^| ')
  [ "$g" -le 1 ] || [ "$u" -gt 1 ] \
    || echo "test-strategy.md records deliberate gaps but ## Untouched is empty"
fi

# No coverage percentage
grep -nEi 'coverage[^.]{0,20}[0-9]{1,3} *%' "$R" \
  && echo "the report states a coverage percentage instead of the three sections"

# No open high-or-above defect
awk '/^## Known defects$/{on=1;next} /^## /{on=0} on' "$R" \
  | grep -iE '\| *(high|critical|blocker) *\|' \
  && echo "a defect of severity high or above is listed as open"

# Every not-applicable carries evidence
awk '/^## Security findings$/{on=1;next} /^## /{on=0} on' "$R" \
  | grep -i 'not-applicable' \
  | awk -F'|' '$5 ~ /^[[:space:]]*$/ {print "not-applicable with no non-reachability evidence: "$2}'

# Every non-functional threshold has a measured value
awk '/^## Non-functional measurements$/{on=1;next} /^## /{on=0}
     on && /^\| AC-/ { split($0, c, "|");
       if (c[5] ~ /^[[:space:]]*$/) print "non-functional threshold with no measured value: " c[2] }' "$R"

# The report recommends and does not approve
grep -niE '^(release )?approved by|sign-?off given|approval recorded here' "$R" \
  && echo "the report records an approval; it may only recommend"
grep -qi '^## Recommendation' "$R" || echo "no ## Recommendation section"

# The report's build matches what is being released
RC=$(grep -oE 'commit `[0-9a-f]{7,40}`' "$R" | head -1 | tr -d '`' | awk '{print $2}')
[ -n "$RC" ] && { git cat-file -e "${RC}^{commit}" 2>/dev/null \
  || echo "the report names commit $RC, which is not in this repository"; }

# G6 is not recorded pass while an exit criterion is unmet
awk '/^## Known defects$/{on=1;next} /^## /{on=0} on' "$R" | grep -qiE '\| *(high|critical) *\|' \
  && grep '"gate":"G6"' delivery/.adlc/events.jsonl 2>/dev/null | tail -1 | grep -q '"verdict":"pass"' \
  && echo "G6 recorded as pass while a high-severity defect is open"
```

Each command prints nothing when the rule holds. The exactly-one-of-three check is the one to
run before asking for approval: it is the only mechanical guarantee that nothing the change
promised has quietly failed to appear in any of the three answers.
