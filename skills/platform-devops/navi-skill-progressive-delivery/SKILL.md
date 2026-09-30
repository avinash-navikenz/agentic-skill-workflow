---
name: navi-skill-progressive-delivery
description: >
  Use when deciding how much of the population sees a change first, what would halt the ramp,
  and how it is taken back — or when G7 asks for the blast radius and an exercised rollback.
  Defines the rollout file, the ROLL-### wave, the blast-radius statement as a count and a
  population, the halt condition bound to an SLI, the kill switch that is not a redeploy, and
  the soak long enough for the signal to exist.
  Trigger phrases include: progressive delivery, canary, canary release, blast radius,
  feature flag rollout, percentage rollout, ring deployment, blue-green, shadow traffic,
  dark launch, kill switch, halt the rollout, bake time, soak, ramp to 100%, G7 blast radius.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: platform-devops
  lifecycle_phases: [7, 8]
  used_by_agents: [navi-agent-devops-engineer, navi-agent-mlops-engineer]
  owner: OWNER_TBD
  tags: "devops, progressive-delivery, canary, blast-radius, rollback, kill-switch, g7"
  model: sonnet
---

## When to use

A change is about to reach users and the exposure has not been decided; G7 is about to be
recorded and needs the blast radius stated; a canary is running and nobody agreed what would
stop it; or a model is about to serve traffic and the choice is between shadow, canary and a
full switch.

## Rules

1. Write the rollout at `delivery/changes/<name>/rollout.md` and add a row for it to the
   `## Linked artifacts` table that `templates/change/design.md` ships into every `design.md`.
   That table is a design's one home for outward links; a change-scoped artifact never earns a
   heading of its own.
2. Open with `## Blast radius`: the population affected if this change is wrong, as a **count**
   and a **description of who they are**, at each wave and at full exposure. G7's exit criteria
   ask who is affected if this fails and how many, and a percentage alone answers neither —
   1% of requests can be 100% of one customer.
3. Number waves `ROLL-###` in the order they run, and give every wave eight fields:
   `Exposure`, `Population`, `Selector`, `Soak`, `Promote when`, `Halt when`, `Rollback`,
   `Owner`. All eight, on every wave.
4. Write `Selector` as the mechanism that decides who is in the wave — the flag rule, the
   routing weight, the ring membership — not as an intention. A wave whose selector is
   `some internal users` cannot be reproduced, and when it goes wrong nobody can enumerate who
   saw it.
5. Set `Soak` from the signal, not from the calendar. State the metric the wave is watching,
   the rate at which it produces events at this exposure, and the time needed to observe the
   effect size that matters. A 10-minute soak on a metric that receives 4 events an hour at 1%
   exposure observes nothing, and promoting on it is promoting on no information.
6. Bind every `Halt when` to an `SLI-###` defined in `delivery/ops/slo.md` with a threshold and
   a window, or to a named error signature. `navi-skill-observability` defines those SLIs; a
   halt condition that names no measured quantity is an opinion formed under pressure.
7. Make halting automatic wherever the condition is machine-checkable, and say which system
   evaluates it. A halt condition that requires a person to be watching is a halt condition
   that fails at 03:00, which is when the ramp is unattended.
8. Give the change a kill switch that is not a redeploy, and state its propagation time. A
   rollback through the pipeline takes the pipeline's time-to-restore; a flag flip takes
   seconds. State both, because the right one differs by failure: data corruption wants the
   flag now, a bad binary wants the previous digest.
9. Never ramp two changes through the same population at the same time. Where it is
   unavoidable, say so in `## Concurrent exposure` and name which one is halted first — with
   two ramps running, a halt condition that fires attributes to neither.
10. Keep the previous path alive until the last wave has completed its soak, and remove it in
    its own later merge. The flag's introduction, the old path's retention and the merge that
    removes it are `navi-skill-version-control-workflow`'s; this skill owns only the exposure
    ramp on top of them. The removal task exists in `tasks.md` from the day the flag is added.
11. Record what each wave actually observed — the date, the exposure reached, the measured
    value of every `Halt when` metric, and the promote-or-halt decision. A rollout plan with no
    observations is a plan; G7 is recorded on what happened.
12. Roll a model out through shadow before canary where the prediction is cheap to compute and
    expensive to act on: serve the incumbent, compute the candidate, compare offline. Where
    exposure itself carries risk to a person, the offline evaluation decides and there is no
    canary — see `navi-skill-evaluation-design` for what that evaluation has to show.
13. Halt on a segment, not only on the aggregate. A candidate that is better overall and worse
    for one population passes an aggregate halt condition every time; name the `SLICE-###`
    segments from the model card or the requirement's affected populations in `Halt when`.
14. Treat a halt as a `--fail` on nothing and a rollback as an event to record, not as a
    verdict. `navi-delivery gate` records gate verdicts; a halted ramp is recorded in
    `## Wave observations` and re-entered after the fix. Recording G7 `--pass` on a change
    whose ramp is halted states the opposite of what happened.
15. State the data direction before the first wave. Where the new path writes data the old path
    cannot read, rollback is not available and the wave plan is the only control — say so in
    `## Rollback` and name the migration that makes the old path able to read it.
16. Name a person as `Owner` per wave, with the hours the wave runs in. A wave promoted by
    whoever notices is a wave with no decision record.

## Decision table

| Observed condition | Required action |
|---|---|
| The blast radius is stated as a percentage | Add the count and who they are; 1% of requests can be one whole customer |
| A wave's selector is a description | Replace it with the flag rule, routing weight or ring membership |
| The soak is a round number of minutes | Derive it: state the event rate at this exposure and the effect size to be observed |
| The soak observes fewer events than the effect size needs | Lengthen the soak or raise the exposure; promoting now is promoting on no information |
| A halt condition names no measured quantity | Bind it to an `SLI-###` with a threshold and a window, or to an error signature |
| The halt requires someone to be watching | Automate it and name the evaluating system |
| There is no kill switch other than redeploying | Add a flag-level switch and state both propagation times |
| Two changes are ramping through the same population | Separate them, or record `## Concurrent exposure` naming which halts first |
| The old path was removed in the same merge | Restore it; it comes out in its own later merge after the final soak |
| The rollout has no recorded observations | Record each wave's date, exposure and measured halt metrics before G7 |
| A model prediction is cheap to compute and expensive to act on | Shadow first, then canary |
| Exposure itself could harm a person | No canary — the offline evaluation decides |
| The halt condition watches only the aggregate | Add the `SLICE-###` segments; a worse segment hides inside a better mean |
| The ramp is halted and G7 is being recorded | Record what happened in `## Wave observations`; do not `--pass` a halted ramp |
| The new path writes data the old path cannot read | State that rollback is unavailable and name the migration that restores it |
| A wave has no named owner | Name the person and the hours the wave runs in |

## Template

Copy into `delivery/changes/<name>/rollout.md`, and add its row to `design.md`'s
`## Linked artifacts` table:

```markdown
# Rollout — theme-persistence

Artifact: `sha256:9b2c41e0...`, promoted by `STAGE-004` of
`delivery/ops/delivery-pipeline.md`. Flag: `theme_persistence_v2`, introduced in PR #418 under
`navi-skill-version-control-workflow`; removal is TASK-034.

## Blast radius

| Wave | Exposure | Count | Who they are |
|---|---|---|---|
| ROLL-001 | internal only | ~120 | Employees with `staff=true`; no external customer |
| ROLL-002 | 5% of sessions | ~41,000 sessions/day | Sampled by session hash across all regions and both themes |
| ROLL-003 | 50% of sessions | ~410,000 sessions/day | As above |
| ROLL-004 | 100% | ~820,000 sessions/day | Every user of the web shell, including the 6 enterprise tenants on the dedicated cluster |

If this change is wrong at full exposure, every first render chooses the wrong default theme
and every user sees a flash of the wrong colour scheme. Nobody loses data: the write path is
additive and the old column is retained until TASK-034.

## Rollback

Two routes, with different propagation times, for different failures:

- **Flag flip** — `theme_persistence_v2=false`, propagates in under 30 seconds to every edge.
  This is the route for a behavioural fault: the old path is still deployed and still correct.
- **Digest rollback** — `STAGE-005` of the delivery pipeline, measured time-to-restore 3m 41s
  at the 2026-09-24 rehearsal. This is the route for a bad binary — a crash loop or a
  regression outside the flagged path.

Data direction: the new path writes `user_preferences.theme_v2` and continues to write the
legacy `theme` column until TASK-034. Rollback is therefore available at every wave. Were the
legacy write to be removed before the final soak, rollback would stop being available and this
section would have to say so.

## Waves

### ROLL-001 — Internal only

- **Exposure:** the flag is on for `staff=true` only
- **Population:** ~120 employees
- **Selector:** `theme_persistence_v2` targeting rule `user.staff == true` — enumerable from
  the identity directory, so who saw it can be listed after the fact
- **Soak:** 24 hours. SLI-004 receives roughly 400 first renders a day at this exposure; a
  1-point move in the acceptance rate is observable over 400 events, and a shorter soak is not.
- **Promote when:** SLI-004 within its objective, zero `ThemeResolveError` occurrences, and
  Ana Costa records the observation row
- **Halt when:** SLI-004 below 0.76 over any rolling 6-hour window, **or** any
  `ThemeResolveError`. Evaluated automatically by the alerting rule `alert-sli-004-fast`.
- **Rollback:** flag flip
- **Owner:** Ana Costa, 09:00–17:00 UTC

### ROLL-002 — 5% of sessions

- **Exposure:** 5% of all sessions
- **Population:** ~41,000 sessions/day across all regions
- **Selector:** `theme_persistence_v2` bucketed on `hash(session_id) % 100 < 5` — stable, so a
  session does not flip between paths mid-visit
- **Soak:** 12 hours. At 41,000 sessions/day SLI-004 accumulates ~20,000 first renders in 12
  hours, enough to detect a 0.5-point move at the observed variance.
- **Promote when:** SLI-004 within objective on the aggregate **and** on SLICE-003 (users with
  no `prefers-color-scheme` header) and SLICE-005 (the six enterprise tenants)
- **Halt when:** SLI-004 below 0.76 on the aggregate or on either named slice over any rolling
  2-hour window, or p99 render latency above 12ms. Evaluated automatically.
- **Rollback:** flag flip
- **Owner:** Ana Costa, 09:00–17:00 UTC

### ROLL-003 — 50% of sessions

- **Exposure:** 50% of all sessions
- **Population:** ~410,000 sessions/day
- **Selector:** `hash(session_id) % 100 < 50`
- **Soak:** 24 hours, spanning one full weekday-to-weekend boundary, because the enterprise
  tenants' traffic pattern differs at the weekend and SLICE-005 is otherwise unobserved
- **Promote when:** as ROLL-002, plus no new `ThemeResolveError` signature
- **Halt when:** as ROLL-002. Evaluated automatically.
- **Rollback:** flag flip
- **Owner:** Ana Costa, 09:00–17:00 UTC

### ROLL-004 — Full exposure

- **Exposure:** 100%
- **Population:** every user of the web shell
- **Selector:** flag default `true`; the targeting rules are removed
- **Soak:** 7 days before TASK-034 removes the old path, so that a regression discovered in
  the first week still has a flag to flip
- **Promote when:** the 7-day soak completes within objective; promotion here means merging
  TASK-034, not widening exposure
- **Halt when:** as ROLL-002
- **Rollback:** flag flip until TASK-034 merges; digest rollback afterwards
- **Owner:** Ana Costa, 09:00–17:00 UTC

## Concurrent exposure

`search-ranking-v4` is ramping through the same population in the same period. It halts first:
it is the larger change and its halt condition is the noisier of the two, so attributing a
shared regression to it and re-observing is cheaper than the reverse. Agreed with Dan Okafor
2026-09-26.

## Wave observations

| Date | Wave | Exposure reached | SLI-004 | p99 latency | ThemeResolveError | Decision |
|---|---|---|---|---|---|---|
| 2026-09-28 | ROLL-001 | staff only | 0.79 | 8.4ms | 0 | promote |
| 2026-09-29 | ROLL-002 | 5% | 0.78 (SLICE-003 0.77, SLICE-005 0.78) | 9.1ms | 0 | promote |
| 2026-09-30 | ROLL-003 | 50% | 0.78 | 9.4ms | 0 | promote |
```

Halting a wave from the command line, and recording what happened:

```bash
# The kill switch, for a behavioural fault — propagation under 30 seconds
./flags set theme_persistence_v2=false --env production
# Then add the row to ## Wave observations with the measured values and 'halt', and
# re-enter the owning phase. Do not record G7 --pass on a halted ramp.
```

## Checklist

- [ ] `rollout.md` exists and `design.md`'s `## Linked artifacts` table carries a row for it
- [ ] `## Blast radius` states a count and who they are, per wave and at full exposure
- [ ] Every `ROLL-###` carries all eight fields
- [ ] Every `Selector` names a mechanism, not an intention
- [ ] Every `Soak` is derived from the event rate at that exposure and the effect size
- [ ] Every `Halt when` names an `SLI-###` with a threshold and a window, or an error signature
- [ ] Every machine-checkable halt condition is evaluated automatically, by a named system
- [ ] A kill switch exists that is not a redeploy, with its propagation time stated
- [ ] Both rollback routes are stated with their propagation times
- [ ] Concurrent ramps through the same population are recorded, with which halts first
- [ ] The old path survives until the final soak, and its removal is a task in `tasks.md`
- [ ] `## Wave observations` carries a dated row per completed wave with measured values
- [ ] Segment halt conditions name the `SLICE-###` populations, not only the aggregate
- [ ] The data direction is stated, and rollback availability follows from it
- [ ] Every wave names a person and the hours the wave runs in
- [ ] G7 is not recorded `--pass` while a wave is halted

## Anti-patterns

**The percentage blast radius.** `Blast radius: 1% of traffic.` The 1% is selected by
customer id, and it is one customer — their entire estate. State the count and who they are.

**The calendar soak.** `Bake for 15 minutes` on a metric that produces four events an hour at
canary exposure. The wave promotes having observed nothing, and the regression appears at
100%. Derive the soak from the event rate and the effect size.

**The halt nobody agreed.** The canary is running and the ramp widens because it looks fine.
"Looks fine" was three dashboards read by one person. Bind the halt to an `SLI-###` with a
threshold and a window, and let a machine evaluate it.

**Canary as the only rollback.** The only way back is the pipeline, and the pipeline takes four
minutes. Four minutes of writing corrupt preferences is 2,700 broken sessions. Add a switch
that propagates in seconds and say which failure each route is for.

**Two ramps, one population.** `theme-persistence` and `search-ranking-v4` both at 5% on the
same users. Latency moves. Neither team can attribute it, both halt, and a week is spent
re-running both separately. Separate them, or record which halts first.

**The aggregate that hides a segment.** The candidate is better on average and 6 points worse
for users with no `prefers-color-scheme` header. Every aggregate halt condition passes. Name
the slices in `Halt when`.

**Old path removed in the same merge.** The flag is added and the legacy branch deleted in one
pull request. The flag now selects between the new path and nothing. Keep the old path until
the last soak completes, and remove it in its own merge.

**The plan with no observations.** `rollout.md` describes four waves in the future tense and
G7 is recorded against it. Nothing says what any wave measured. Record the row per wave, with
numbers.

**Rollback assumed, not checked.** The new path writes a column the old code does not read.
Flipping the flag back loses every preference written during the ramp. State the data
direction before the first wave, not during the incident.

## Validation

```bash
CHANGE=<name>
R=delivery/changes/$CHANGE/rollout.md

test -f "$R" || echo "no rollout.md for $CHANGE"
grep -q 'rollout.md' delivery/changes/$CHANGE/design.md \
  || echo "design.md's Linked artifacts table does not name rollout.md"

# The blast radius names counts, not only percentages
awk '/^## Blast radius$/{on=1;next} /^## /{on=0} on' "$R" \
  | grep -qE '[0-9][0-9,]*' || echo "## Blast radius states no count"

# Every wave carries all eight fields
for id in $(grep -o 'ROLL-[0-9]\{3,\}' "$R" | sort -u); do
  body=$(awk -v id="$id" '$0 ~ "^### " id " " {on=1; next} /^### /{on=0} on' "$R")
  [ -n "$body" ] || { echo "$id: named in the file but has no '### $id — …' entry"; continue; }
  for k in Exposure Population Selector Soak "Promote when" "Halt when" Rollback Owner; do
    printf '%s\n' "$body" | grep -q "\*\*$k:\*\*" || echo "$id: missing $k"
  done
  # The soak is derived, not asserted
  printf '%s\n' "$body" | awk '/\*\*Soak:\*\*/{on=1;next} /\*\*Promote when:\*\*/{on=0} on' \
    | grep -qiE 'observ|detect|events|rate|variance' \
    || printf '%s\n' "$body" | grep '\*\*Soak:\*\*' \
      | grep -qiE 'observ|detect|events|rate|variance' \
      || echo "$id: soak states no derivation from an event rate or effect size"
  # The halt condition names a measured quantity
  printf '%s\n' "$body" | awk '/\*\*Halt when:\*\*/{on=1;next} /\*\*Rollback:\*\*/{on=0} on' \
    | grep -qE 'SLI-[0-9]{3,}|Error|error' \
    || printf '%s\n' "$body" | grep '\*\*Halt when:\*\*' | grep -qE 'SLI-[0-9]{3,}|Error|error' \
    || echo "$id: halt condition names no SLI and no error signature"
  # The owner is a person, not an alias
  printf '%s\n' "$body" | grep '\*\*Owner:\*\*' | grep -qE '#|@|team|rota' \
    && echo "$id: Owner names an alias rather than a person"
done

# Every SLI a halt condition names is defined with an objective
for s in $(grep -o 'SLI-[0-9]\{3,\}' "$R" | sort -u); do
  grep -q "^### $s " delivery/ops/slo.md 2>/dev/null \
    || echo "$s is named in rollout.md but not defined in delivery/ops/slo.md"
done

# A kill switch that is not a redeploy, with a propagation time
awk '/^## Rollback$/{on=1;next} /^## /{on=0} on' "$R" \
  | grep -qiE 'flag|switch' || echo "## Rollback names no route other than a redeploy"
awk '/^## Rollback$/{on=1;next} /^## /{on=0} on' "$R" \
  | grep -qiE 'second|minute|propagat' || echo "## Rollback states no propagation time"

# Every completed wave has an observation row
for id in $(grep -o 'ROLL-[0-9]\{3,\}' "$R" | sort -u); do
  awk '/^## Wave observations$/{on=1;next} /^## /{on=0} on' "$R" | grep -q "$id" \
    || echo "$id: no row in ## Wave observations"
done

# The old path's removal exists as a task
grep -oE 'TASK-[0-9]{3,}' "$R" | sort -u | while read -r t; do
  grep -q "$t" delivery/changes/$CHANGE/tasks.md 2>/dev/null \
    || echo "$t is named in rollout.md but is not in tasks.md"
done

# G7 is not recorded pass while an observation row says halt
awk '/^## Wave observations$/{on=1;next} /^## /{on=0} on' "$R" | grep -qi 'halt' \
  && grep '"gate":"G7"' delivery/.adlc/events.jsonl 2>/dev/null | tail -1 | grep -q '"verdict":"pass"' \
  && echo "G7 recorded as pass while a wave observation records a halt"
```

Each command prints nothing when the rule holds. The wave-observation loop is the one to run
before G7: it is the only mechanical difference between a rollout that happened and a rollout
that was planned.
