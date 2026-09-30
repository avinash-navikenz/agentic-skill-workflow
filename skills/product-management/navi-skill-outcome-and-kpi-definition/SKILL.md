---
name: navi-skill-outcome-and-kpi-definition
description: >
  Use when a change has to commit to something observable before it is built, when G1 asks for
  at least one measurable outcome, or when G9 compares what was predicted against what happened.
  Defines the KPI-### entry in the proposal, the measured baseline, the target as a direction
  and a date, the mandatory counter-metric, the falsification condition agreed in advance, the
  attribution position, and the KPI-versus-SLI boundary.
  Trigger phrases include: outcome, KPI, success metric, north star metric, measurable outcome,
  baseline, target, counter-metric, guardrail metric, vanity metric, did it work, outcome over
  output, hypothesis, attribution, KPI vs actual, G1 intent, G9 feedback.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: product-management
  lifecycle_phases: [1, 9]
  used_by_agents: [navi-agent-product-owner, navi-agent-business-analyst]
  owner: avinash.negi@navikenz.com
  tags: "product, outcomes, kpi, baseline, counter-metric, attribution, g1, g9"
  model: opus
---

## When to use

A change is being proposed and its benefit is stated as an activity; G1 is about to be recorded
and needs a measurable outcome; a stakeholder has asked for a feature rather than a difference;
or G9 is about to compare the prediction with the measurement.

## Rules

1. Write every outcome as a `KPI-###` in `delivery/changes/<name>/proposal.md` under `## Why`.
   `navi-delivery propose` scaffolds that file from `templates/change/proposal.md`, and
   `references/gates.md`'s G1 exit criterion requires at least one measurable outcome there —
   a KPI, an `SLI-###`, or a named behaviour change.
2. Give every `KPI-###` seven fields: `Measures`, `Instrument`, `Baseline`, `Target`,
   `By when`, `Owner`, `Counter-metric`. All seven, on every KPI.
3. Measure the baseline before the change is built, and record the date and the window it was
   measured over. A baseline written from memory after the result is in hand is chosen, not
   measured, and it is chosen to make the result look like one.
4. Where the quantity is not currently measured, write `Baseline: none — not measured before
   <date>` and make instrumenting it the change's first task. A KPI with no baseline can only
   ever be reported as a level, and a level proves nothing about whether anything moved.
5. Write `Target` as a direction, a number, a unit and a date: `from 0.61 to 0.70 or above, by
   2026-12-15`. `Improve retention` names no threshold anyone can miss, so it cannot be missed
   and therefore cannot be met.
6. Give every KPI a `Counter-metric`: the quantity that must not move while the KPI moves, with
   its bound. Every measure can be improved by damaging something adjacent — sessions by
   nagging, conversion by hiding the price, speed by dropping the check — and the counter-metric
   is what names the thing being traded away before anybody trades it.
7. Name a person as `Owner` — the one who will be asked about the number at the date. A KPI
   owned by a team is a KPI nobody is asked about, and the question is never asked at all if the
   answer is nobody's.
8. Keep KPIs and SLIs apart, and bind them. A KPI answers *did this help*; an `SLI-###` answers
   *is this working*. `navi-skill-observability` defines the SLIs in `delivery/ops/slo.md`;
   name the SLI a KPI depends on rather than restating its objective, or the two numbers drift
   and neither is authoritative.
9. Never take an activity as an outcome. Tickets closed, features shipped, story points burned,
   pages written, models trained: all measure that work happened, which was never in doubt.
   State the change in someone's behaviour, or in a quantity the business already tracks.
10. Fix the measurement window before the result arrives, and state it in `By when`. A window
    chosen after the data is a result chosen after the data, and every such reading is a win.
11. State the falsification condition in `## What would mean this did not work`: the value at
    the date that would mean the change failed, and what happens then — revert, persevere with
    a stated reason, or re-frame. A decision not pre-committed is negotiated afterwards by
    whoever is most invested.
12. State the attribution position at Phase 1, not at Phase 9: the confounders already known,
    and how the measurement separates them — a holdout, a comparison population, a pre-post
    with a named seasonal control, or `none available — this reading is a level and cannot be
    attributed to this change`. The last is an honest position; discovering it at G9 is not.
13. Record the predicted value and the measured value side by side at G9, and name the gap, in
    the `## KPI vs actual` section of `delivery/ops/postmortems/<name>.md`. `navi-delivery
    archive` scaffolds that heading, and G9's first exit criterion is exactly this comparison.
14. Route the insight from a missed KPI to exactly one destination — the product backlog as a
    candidate, or a skill amendment — as G9 requires. A KPI that missed and produced no insight
    was not a hypothesis; it was a hope with a number attached.
15. Never redefine a KPI after data has arrived. A definition that changes keeps its id and
    gains a dated row in `## History`, with the old definition's last reading preserved. A KPI
    redefined mid-flight is a KPI that cannot miss.
16. State this change's contribution where the outcome needs other changes too: `Target` is the
    whole outcome, and `Contribution` is the part this change is accountable for. A shared
    target with no stated split is claimed in full by everyone who touched it.
17. Write the KPI even where the lane does not record it. `cli/lib/lanes.js` omits G1 from
    `express` and `hotfix`, so nothing gates the proposal on those lanes — but `hotfix`
    enforces G9, which compares predicted against measured, and there is nothing to compare
    against if the prediction was never written down.

## Decision table

| Observed condition | Required action |
|---|---|
| The benefit is stated as a feature being shipped | Rewrite as the difference afterwards; if nothing would differ, decline the change |
| The measure is tickets, points or releases | Reject — it measures that work happened, which was not in question |
| The baseline was written after the result | Discard it; report a level and say plainly that no change can be claimed |
| The quantity is not measured today | `Baseline: none — not measured before <date>`, and instrument it as task one |
| The target has no number or no date | Add both; a target with neither cannot be missed |
| The KPI has no counter-metric | Add the quantity that must not move, with its bound |
| The owner is a team | Name the person who will be asked at the date |
| The KPI restates an SLI's objective | Name the `SLI-###` instead; two copies of one number diverge |
| The window is being chosen now the data is in | Use the window fixed in `By when`, or record the reading as unattributable |
| There is no agreed failure condition | Write `## What would mean this did not work` before G1 |
| No holdout or comparison population exists | Say so at Phase 1: the reading is a level and cannot be attributed |
| The KPI moved and so did the counter-metric | The outcome was bought, not produced; record it as such at G9 |
| The definition is being changed mid-flight | Keep the id, add a `## History` row, preserve the last reading under the old definition |
| The outcome needs three other changes | State `Contribution` — the part this change is accountable for |
| The lane is `express` or `hotfix` | Write it anyway; G1 is not enforced but G9 on `hotfix` needs a prediction to compare |
| G9 is being recorded | Put predicted and measured side by side in `## KPI vs actual` and name the gap |

## Template

Fill the `## Why` section of `delivery/changes/<name>/proposal.md`:

```markdown
## Why

Returning users are shown the wrong theme on first render because the stored preference is read
after first paint. The complaint arrives as "it forgot again" and has been the largest single
category in support contacts for two quarters.

### KPI-001 — Theme preference retained across sessions

- **Measures:** the share of returning sessions whose first render matches the user's last
  stored preference
- **Instrument:** the `theme_events` table, `first_render` rows joined to the preference store
  as of the render. The query is `analytics/kpi-001.sql`, committed, so the number is
  recomputable by someone who was not here.
- **Baseline:** 0.61, measured over the 28 days to 2026-09-20. Not an estimate: the query above
  was run on 2026-09-21 and its output is in `delivery/changes/theme-persistence/evidence/kpi-001-baseline.txt`.
- **Target:** from 0.61 to 0.95 or above, over a rolling 28 days
- **By when:** 2026-11-15 — 28 days of full exposure after ROLL-004 completes, so the window is
  fixed before any data from it exists
- **Owner:** Priya Raman
- **Counter-metric:** manual theme switches per returning session must not rise above 0.08
  (baseline 0.071 over the same 28 days). The KPI can be moved by making the preference sticky
  in a way users fight, and this is what that would look like.
- **Depends on:** SLI-004 in `delivery/ops/slo.md`. SLI-004 answers whether the resolver is
  working; KPI-001 answers whether fixing it changed what users experience. The objective lives
  in `slo.md` and is not restated here.
- **Contribution:** the whole of it. No other change in flight touches first-render theme
  resolution.

### KPI-002 — Support contacts about theme

- **Measures:** support contacts tagged `theme/appearance` per 10,000 monthly active users
- **Instrument:** the support system's tag report, monthly
- **Baseline:** 4.1 per 10,000, mean of the three months to 2026-08-31
- **Target:** at or below 1.5 per 10,000, by the December 2026 report
- **By when:** 2026-12-31
- **Owner:** Priya Raman
- **Counter-metric:** contacts tagged `settings/confusing` must not rise above 2.0 per 10,000
  (baseline 1.6) — moving a complaint to a different tag is not removing it
- **Contribution:** partial. The `settings-redesign` change also touches this tag and ships in
  the same quarter. This change is accountable for the first-render half; the split is agreed
  with Dan Okafor as 60/40 and is recorded here rather than argued in December.

## What would mean this did not work

KPI-001 below 0.85 at 2026-11-15 means the mechanism did not hold, and the decision is to
revert the write path and re-frame — the preference is being stored and not retrieved, which is
a different problem from the one this change assumed.

KPI-001 at or above 0.85 with the counter-metric above 0.08 means the outcome was bought rather
than produced, and the decision is to persevere only with a stated reason from Priya Raman,
recorded as an `ADR-###`.

## Attribution

Confounders known at Phase 1: the `settings-redesign` change ships into the same population in
the same quarter and touches the same support tag; December traffic is seasonally different in
both volume and device mix.

How the measurement separates them: ROLL-002 and ROLL-003 give a 5% and a 50% exposure with a
concurrent holdout, so KPI-001 is read as the difference between exposed and unexposed sessions
in the same weeks rather than as a before-and-after. KPI-002 has **no holdout** — support tags
are not attributable to an exposure bucket — so it is a level, is stated as a level, and a
movement in it will not be claimed as caused by this change.
```

At G9, in `delivery/ops/postmortems/<name>.md` under the heading `archive` scaffolds:

```markdown
## KPI vs actual

| KPI | Predicted | Measured | Gap | Attributed |
|---|---|---|---|---|
| KPI-001 | 0.95 by 2026-11-15 | 0.93 over the 28 days to 2026-11-15 | -0.02, inside the 0.85 failure threshold | Yes — exposed 0.93 against holdout 0.62 in the same weeks |
| KPI-002 | 1.5 per 10,000 by 2026-12-31 | 1.9 per 10,000 | +0.4 | No — no holdout exists for support tags; `settings-redesign` shipped into the same population. Recorded as a level, not as a result. |
| KPI-001 counter-metric | at or below 0.08 | 0.069 | — | The outcome was not bought |

The 0.02 gap on KPI-001 is the kiosk population, which `evidence/g6-quality.md` recorded as
untouched and which ROLL-004 exposed without ever exercising.

- **INSIGHT-004** A KPI whose population includes a segment the test strategy recorded as
  untouched will miss by roughly that segment's share, and the miss is predictable at G6 rather
  than discoverable at G9.
  - Destination: skill amendment
  - Target: `skills/quality-engineering/navi-skill-release-readiness/SKILL.md`
```

## Checklist

- [ ] Every `KPI-###` is in `proposal.md` under `## Why`
- [ ] Every `KPI-###` carries all seven fields
- [ ] Every `Instrument` names a query or report someone else could re-run
- [ ] Every baseline was measured before the build, with its date and window recorded
- [ ] A quantity not measured today says so, and instrumenting it is task one
- [ ] Every `Target` has a direction, a number, a unit and a date
- [ ] Every KPI has a counter-metric with a bound and a baseline
- [ ] Every owner is a named person
- [ ] Any SLI a KPI depends on is named rather than restated
- [ ] No KPI measures an activity
- [ ] `## What would mean this did not work` states a value and the resulting decision
- [ ] `## Attribution` names the confounders and how the measurement separates them
- [ ] A KPI with no holdout says plainly that it is a level
- [ ] `Contribution` is stated wherever the outcome needs other changes too
- [ ] No KPI was redefined after data arrived; any redefinition kept its id and a `## History` row
- [ ] `## KPI vs actual` in the postmortem puts predicted beside measured and names the gap

## Anti-patterns

**The activity outcome.** `Outcome: ship the theme persistence feature.` It will be met on the
day it ships and tells nobody whether it was worth building. State the difference afterwards.

**The retrospective baseline.** The result is 0.93 and somebody recalls the old figure as
"about 0.6". The improvement is now a memory compared with a measurement. Measure the baseline
before the build and keep the output.

**The target with no number.** `Significantly improve retention.` It cannot be missed, so at
G9 the result is whatever happened, described favourably. Direction, number, unit, date.

**No counter-metric.** Sessions per user rose 14%. So did the notification volume, and the
uninstall rate, and neither was being watched. Name the thing that must not move.

**The KPI that is an SLI.** `KPI-003: 99.9% availability.` It already exists in `slo.md` with
an objective and an error budget, and now there are two numbers. Availability is whether it
works; the KPI is whether fixing it helped.

**The window chosen afterwards.** The 28-day reading missed, so the result is reported for the
best 14 days. Every reading is a win under this method, which is how everybody stops believing
any of them. Fix the window in `By when`.

**No agreed failure condition.** The KPI misses by 30% and the discussion is whether it was
really the target. Pre-commit the value and the decision.

**Attribution discovered at G9.** The number moved, a competitor also changed their pricing in
the same month, and the claim is made anyway. It will be spent twice — once here, once when the
next change assumes the mechanism works. State the attribution position at Phase 1.

**The KPI redefined mid-flight.** `Returning sessions` quietly becomes `returning sessions with
a stored preference`, which excludes exactly the population that fails. The KPI can now only be
met. Keep the id, record the change, preserve the last reading under the old definition.

## Validation

```bash
CHANGE=<name>
P=delivery/changes/$CHANGE/proposal.md
POST=delivery/ops/postmortems/$CHANGE.md

test -f "$P" || echo "no proposal.md for $CHANGE"

# At least one measurable outcome, which is G1's exit criterion
grep -qE 'KPI-[0-9]{3,}|SLI-[0-9]{3,}' "$P" \
  || echo "$P: no KPI-### and no SLI-### — G1 requires at least one measurable outcome"

# Every KPI carries all seven fields
for id in $(grep -o 'KPI-[0-9]\{3,\}' "$P" | sort -u); do
  body=$(awk -v id="$id" '$0 ~ "^### " id " " {on=1; next} /^### /{on=0} on' "$P")
  [ -n "$body" ] || { echo "$id: named in the proposal but has no '### $id — …' entry"; continue; }
  for k in Measures Instrument Baseline Target "By when" Owner Counter-metric; do
    printf '%s\n' "$body" | grep -q "\*\*$k:\*\*" || echo "$id: missing $k"
  done
  # The target has a number and a date
  t=$(printf '%s\n' "$body" | awk '/\*\*Target:\*\*/{on=1} /\*\*By when:\*\*/{on=0} on')
  printf '%s\n' "$t" | grep -q '[0-9]' || echo "$id: target has no number"
  printf '%s\n' "$body" | grep '\*\*By when:\*\*' | grep -qE '[0-9]{4}-[0-9]{2}-[0-9]{2}' \
    || echo "$id: 'By when' is not a date"
  # The baseline is measured or explicitly absent
  b=$(printf '%s\n' "$body" | awk '/\*\*Baseline:\*\*/{on=1} /\*\*Target:\*\*/{on=0} on')
  printf '%s\n' "$b" | grep -qE '[0-9]{4}-[0-9]{2}-[0-9]{2}|none — not measured' \
    || echo "$id: baseline states neither a measurement date nor that it is not measured"
  # The counter-metric has a bound
  printf '%s\n' "$body" | awk '/\*\*Counter-metric:\*\*/{on=1} /\*\*(Depends on|Contribution):\*\*/{on=0} on' \
    | grep -q '[0-9]' || echo "$id: counter-metric states no bound"
  # The owner is a person
  printf '%s\n' "$body" | grep '\*\*Owner:\*\*' | grep -qE '#|@|team$|rota$' \
    && echo "$id: Owner is an alias rather than a person"
done

# No activity metric
grep -niE '\*\*Measures:\*\* *(number of )?(tickets|story points|features shipped|releases|commits|lines)' "$P" \
  && echo "a KPI measures an activity rather than an outcome"

# The falsification condition and the attribution position both exist
grep -q '^## What would mean this did not work$' "$P" \
  || echo "$P: no '## What would mean this did not work' section"
grep -q '^## Attribution$' "$P" || echo "$P: no '## Attribution' section"

# Any SLI a KPI depends on is defined, not restated
for s in $(grep -o 'SLI-[0-9]\{3,\}' "$P" | sort -u); do
  grep -q "^### $s " delivery/ops/slo.md 2>/dev/null \
    || echo "$s is named in the proposal but not defined in delivery/ops/slo.md"
done

# At G9: every KPI has a row in ## KPI vs actual, with predicted and measured
if [ -f "$POST" ]; then
  for id in $(grep -o 'KPI-[0-9]\{3,\}' "$P" | sort -u); do
    row=$(awk '/^## KPI vs actual$/{on=1;next} /^## /{on=0} on' "$POST" | grep "^| $id ")
    [ -n "$row" ] || { echo "$id: no row in ## KPI vs actual"; continue; }
    printf '%s\n' "$row" | awk -F'|' '$3 ~ /^[[:space:]]*$/ || $4 ~ /^[[:space:]]*$/ {
      print "KPI row with a missing predicted or measured value: " $2 }'
  done
  awk '/^## KPI vs actual$/{on=1;next} /^## /{on=0} on' "$POST" | grep -q 'Gap\|gap' \
    || echo "$POST: ## KPI vs actual names no gap"
fi
```

Each command prints nothing when the rule holds. The baseline check is the one to run before
G1: a KPI whose baseline is measured after the change is a measurement of nothing, and it is
the only defect in this list that cannot be repaired later.
