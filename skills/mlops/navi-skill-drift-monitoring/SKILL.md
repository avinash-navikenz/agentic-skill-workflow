---
name: navi-skill-drift-monitoring
description: >
  Use when a model is about to serve traffic and nothing is watching it, when G8 asks whether
  drift and decay monitors are live with thresholds and an owner, or when a drift alert has
  fired and the next action is unclear. Defines the monitors file, the MON-### entry, the four
  layers that must each be covered or recorded empty, the derivation a threshold must carry,
  the rule that drift alerts and never retrains, and the data-quality precedence rule.
  Trigger phrases include: drift monitoring, data drift, concept drift, model decay, PSI,
  population stability index, KS statistic, prediction drift, label delay, model degradation,
  retrain trigger, model alert, stale model, G8 model monitoring.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: mlops
  lifecycle_phases: [7, 8]
  used_by_agents: [navi-agent-mlops-engineer, navi-agent-machine-learning-engineer]
  owner: OWNER_TBD
  tags: "mlops, drift, decay, monitoring, thresholds, slo, runbooks, g8"
  model: sonnet
---

## When to use

A model is about to be promoted and nothing yet watches it; G8 is about to be recorded for a
model-bearing change; a drift alert has fired and the next action has to be decided; or a
model's baseline is out of date because the model it described has been replaced.

## Rules

1. Define the monitors at `delivery/ops/models/<model>/monitors.md` before the model serves
   traffic — at Phase 7, alongside the promotion, not after the first surprise. A monitor added
   after an incident has a baseline drawn from the world the incident already changed.
2. Give every `MON-###` eight fields: `Watches`, `Method`, `Baseline window`, `Threshold`,
   `Fires`, `Owner`, `Runbook`, `Serves`. All eight, on every monitor.
3. Cover the four layers, recording each one that has no monitor as `none` with the reason:
   **input drift** (the distribution of each served feature against the training
   distribution), **prediction drift** (the distribution of the model's own output),
   **outcome decay** (the `EVAL-###` metric recomputed on labels as they arrive), and
   **operational** (latency at the stated percentile, error rate, and cost per 1,000
   predictions). A layer left unmentioned is indistinguishable from a layer nobody considered.
4. State the label delay for outcome decay, and what is watched in the meantime. Where labels
   never arrive, write outcome decay as `none — labels do not arrive` and say plainly that
   input and prediction drift carry the whole burden; the operator then knows the model's
   quality is inferred, not measured.
5. Write `Method` as a computable statistic with its parameters: population stability index
   with its binning, the Kolmogorov–Smirnov statistic, Jensen–Shannon distance, or a per-bin
   count ratio. `Looks different from training` is not a method, because two runs of it
   disagree.
6. Write `Threshold` as a number plus the number of consecutive windows required to fire. One
   window over the line is noise; the consecutive-window count is what separates a monitor from
   a pager.
7. Record every threshold's derivation: the window it was computed over and the variation
   observed in that window. A PSI threshold of 0.2 with no derivation is a number from a blog
   post, and the first time it fires nobody can say whether it means anything.
8. Give every monitor that can page a human a runbook at
   `delivery/ops/runbooks/<alert>.md` naming what fired, the first three checks in order, who
   decides, and the rollback command copied from the model's registry entry. gates.md requires
   a runbook for each alert that can page a human.
9. Wire a drift alert to a human, never to an automatic retrain. Retraining on a shifted world
   encodes the shift, and the incumbent at least has a known error profile. Where automatic
   retraining exists, its trigger is a schedule and its output is a `candidate` promoted through
   `navi-skill-model-registry-and-promotion` like any other artifact.
10. Rule out a data-quality breach before calling anything drift. Every input-feature `MON-###`
    names the `CHK-###` on the same field; where that check breached in the same window, the
    finding is a pipeline defect until the check is clean again. Most input drift is a broken
    join.
11. Name a person as `Owner`, with a rota that is reachable at the hour the monitor can fire. A
    monitor owned by a team alias with no rota pages nobody, and its alerts accumulate unread
    until somebody mutes the channel.
12. Confirm telemetry arriving, not configured. gates.md's G8 criterion is explicit about this:
    the evidence is a query output carrying a timestamp inside the last window, not a
    screenshot of a dashboard definition.
13. Bind a `MON-###` to an `SLI-###` in `delivery/ops/slo.md` where its breach is visible to a
    user, and give that SLI an objective, an error budget and an alert that fires before the
    budget burns. Where a monitor has no user-visible consequence, write `Serves: no SLI` and
    the reason — an internal monitor with an invented SLO burns a budget nobody agreed.
14. Re-derive every baseline window at each promotion and at retirement. After a promotion the
    incumbent's training distribution is the wrong reference, so a monitor left pointing at it
    measures the difference between two models rather than a change in the world. The
    promotion record says which monitors were re-baselined and when.
15. Carry every failure mode in the model card into a monitor or an explicit `none`. A card
    that names four failure modes and a monitors file that covers two leaves two conditions
    that will be reported by a user rather than detected.
16. Pass G8 with one file. `navi-delivery gate` accepts exactly one `--evidence` value and
    checks only that it resolves, while G8's evidence list names `slo.md`, the runbook paths
    and the telemetry output. Write `delivery/changes/<name>/evidence/g8-operate.md` as an
    index linking all three, and pass that path.

## Decision table

| Observed condition | Required action |
|---|---|
| A model is about to be promoted and no monitors file exists | Write it first; a baseline drawn later is drawn from a changed world |
| A layer has no monitor | Record `none` with the reason; never omit the row |
| Labels never arrive | Outcome decay is `none — labels do not arrive`; say that quality is inferred |
| Labels arrive after 90 days | State the delay; input and prediction drift carry those 90 days |
| The method offered is a description | Replace it with a statistic and its parameters |
| The threshold has no consecutive-window count | Add one; a single window over the line is noise |
| The threshold has no derivation | Compute it over a named window and state the variation seen |
| An input-feature monitor fires and its `CHK-###` breached in the same window | Pipeline defect until the check is clean; do not call it drift |
| A drift alert is proposed as a retrain trigger | Refuse — alert a human and hold the incumbent |
| Automatic retraining already exists | Make its trigger a schedule and its output a `candidate` |
| The monitor's owner is a team alias | Name the person and the rota that covers the firing hours |
| Telemetry is configured but no data has arrived | G8's criterion is unmet — show a query output with a timestamp in the last window |
| A monitor's breach is invisible to users | `Serves: no SLI` with the reason; do not invent an objective |
| A promotion has just happened | Re-baseline every monitor against the new version and record it |
| A model-card failure mode has no monitor | Add one, or record `none` in the card with the reason |
| G8 is being recorded | Pass `evidence/g8-operate.md`, the index — not `slo.md` |

## Template

Copy into `delivery/ops/models/theme-ranker/monitors.md`:

```markdown
# Monitors — theme-ranker

Baselined against version 7's training distribution (DC-003@v2, 2026-03-01..2026-08-01).
Re-baselined 2026-10-02 at the version 7 promotion.

## Layer coverage

| Layer | Monitors | If none, why |
|---|---|---|
| Input drift | MON-002, MON-003 | — |
| Prediction drift | MON-004 | — |
| Outcome decay | MON-005 | — |
| Operational | MON-006, MON-007 | — |

### MON-002 — Input drift on `client_region`

- **Watches:** the served distribution of `client_region`, hourly, against the version 7
  training distribution
- **Method:** population stability index over the 12 regions plus a `null` bin, computed on the
  trailing 24-hour window
- **Baseline window:** DC-003@v2, 2026-03-01..2026-08-01, the version 7 training set
- **Threshold:** PSI >= 0.18 for 3 consecutive 24-hour windows. Derived from 90 days to
  2026-09-20 with the model held fixed: daily PSI against the training distribution had mean
  0.041 and maximum 0.121, and the largest 3-window run above 0.10 was 1 window. 0.18 is the
  observed maximum plus half its range, and the 3-window requirement makes the historical
  false-fire count 0 over that period.
- **Fires:** page the `#ml-platform` rota — Sam Idowu primary, Dan Okafor secondary
- **Owner:** Sam Idowu
- **Runbook:** `delivery/ops/runbooks/mon-002.md`
- **Data-quality precedence:** CHK-008 (`null_rate(client_region) <= 0.12`). Where CHK-008
  breached in any window inside the alert period, this is a pipeline defect and not drift; the
  runbook checks CHK-008 first.
- **Serves:** SLI-004

### MON-003 — Unseen-category rate

- **Watches:** the share of served requests whose `prefers_color_scheme` or `client_region`
  value was not present in the training data, hourly
- **Method:** per-feature count of values outside the training vocabulary, divided by served
  requests, on the trailing 24-hour window
- **Baseline window:** the version 7 training vocabulary (DC-003@v2, 2026-03-01..2026-08-01)
- **Threshold:** rate >= 0.001 for 2 consecutive 24-hour windows. Derived from 90 days to
  2026-09-20, in which the unseen rate was exactly 0 on every day — any non-zero rate is a new
  value, and 2 windows distinguishes a rollout from a single malformed client.
- **Fires:** page the `#ml-platform` rota
- **Owner:** Sam Idowu
- **Runbook:** `delivery/ops/runbooks/mon-003.md`
- **Data-quality precedence:** CHK-009 (`event_ts` domain) — a malformed upstream write
  produces unseen values without anything having changed in the world
- **Serves:** SLI-004

### MON-004 — Prediction drift

- **Watches:** the share of served predictions above the 0.500 operating point, hourly
- **Method:** per-bin count ratio against the training-time predicted share, 10 bins
- **Baseline window:** the version 7 held-out test set, `event_ts >= 2026-08-16`
- **Threshold:** the dark share moves outside [0.36, 0.52] for 3 consecutive 24-hour windows.
  Derived from the test set's 0.44 share and the 90-day daily range of 0.39..0.49 observed
  under BASELINE-003; the bounds are that range widened by 0.03 either side.
- **Fires:** page the `#ml-platform` rota
- **Owner:** Sam Idowu
- **Runbook:** `delivery/ops/runbooks/mon-004.md`
- **Data-quality precedence:** none — the monitor reads the model's own output, not a source
  field
- **Serves:** SLI-004

### MON-005 — Outcome decay

- **Watches:** EVAL-001, the 24-hour switch rate, recomputed daily on the labels that have
  arrived
- **Method:** the EVAL-001 metric on a rolling 14-day window of labelled first renders, with
  the analytic proportion interval
- **Baseline window:** the version 7 test set: 0.191 [0.188, 0.194]
- **Threshold:** the rolling estimate's lower bound rises above 0.194 — the test set's upper
  bound — for 3 consecutive days. Derived from the test-set interval itself, so the alert fires
  only when the live rate is worse than the evaluation could have produced by chance.
- **Label delay:** 24 hours by construction. 4% of first renders never produce a label and are
  excluded, as NOTFIT-004 records.
- **Fires:** page the `#ml-platform` rota, and notify Priya Raman
- **Owner:** Sam Idowu
- **Runbook:** `delivery/ops/runbooks/mon-005.md`
- **Data-quality precedence:** CHK-007 (row count) and CHK-009 (`event_ts` window) — a thin or
  skewed partition changes the rolling estimate without anything having decayed
- **Serves:** SLI-005

### MON-006 — Inference latency

- **Watches:** p99 latency of the theme-ranker call, per 5-minute window
- **Method:** the serving platform's p99 over the window, from the request histogram
- **Baseline window:** PROMO-004's measurement, p99 9.1ms on 2026-09-30
- **Threshold:** p99 above 12ms — PROMO-004's promotion bound — for 3 consecutive 5-minute
  windows. Derived from the promotion criterion rather than from history, because the bound
  is a commitment: exceeding it means the model no longer meets what it was promoted on.
- **Fires:** page the `#ml-platform` rota
- **Owner:** Sam Idowu
- **Runbook:** `delivery/ops/runbooks/mon-006.md`
- **Data-quality precedence:** none — the monitor reads the serving path, not a source field
- **Serves:** SLI-004

### MON-007 — Inference cost

- **Watches:** USD per 1,000 predictions, daily
- **Method:** the serving platform's billed cost for the `theme-ranker` label divided by the
  served prediction count
- **Baseline window:** PROMO-005's measurement, 0.31 USD per 1,000 on 2026-09-30
- **Threshold:** above 0.40 USD per 1,000 — PROMO-005's promotion bound — for 2 consecutive
  days. Derived from the promotion criterion rather than from history, because the bound is a
  commitment rather than an observation.
- **Fires:** notify Sam Idowu; does not page
- **Owner:** Sam Idowu
- **Runbook:** `delivery/ops/runbooks/mon-007.md`
- **Data-quality precedence:** none
- **Serves:** no SLI — inference cost is invisible to users. It has an owner and a threshold
  and deliberately no objective or error budget.

## Failure modes covered

| Model-card failure mode | Monitor |
|---|---|
| `prefers-color-scheme` header absent | MON-004 (share of requests with no header) |
| `client_region` null rate rises | MON-002, with CHK-008 taking precedence |
| A new browser ships a third `prefers-color-scheme` value | MON-003 (unseen-category rate) |
| Theme default changes again, as on 2026-07-02 | none — no monitor detects a semantic change to the label. Recorded as `none` in the model card too; the quarterly retraining trigger is the only control. |

## Re-baselining

| Date | Trigger | Monitors re-baselined |
|---|---|---|
| 2026-10-02 | Version 7 promoted | MON-002, MON-003, MON-004, MON-005 — all now reference version 7's training and test distributions |
```

The SLI side, appended to `delivery/ops/slo.md`. Every `SLI-###` a monitor serves is defined
here; a monitor serving an undefined SLI has an objective nobody agreed:

```markdown
### SLI-004 — Default theme accepted on first render

- **Measures:** the share of first renders whose chosen default the user does not override
- **Objective:** at or above 0.76 over a rolling 28 days
- **Error budget:** 0.24 of first renders may be overridden over 28 days
- **Alerts before the budget burns:** MON-002 and MON-004 fire on 3 consecutive 24-hour
  windows, which at the observed rate is about 11 days before a 28-day breach
- **Runbook:** `delivery/ops/runbooks/mon-002.md`, `delivery/ops/runbooks/mon-004.md`

### SLI-005 — First-session theme switch rate

- **Measures:** the share of first renders followed by a manual theme switch within 24h
- **Objective:** at or below 0.24 over a rolling 28 days
- **Error budget:** 0.05 above the evaluation's 0.191 upper bound, spent over 28 days
- **Alerts before the budget burns:** MON-005 fires at 3 consecutive days above 0.194, which is
  reached about 9 days before a 28-day breach at the observed rate
- **Runbook:** `delivery/ops/runbooks/mon-005.md`
```

Confirming telemetry is arriving, not configured:

The shape below is Postgres; run your own monitoring store's equivalent. What G8 accepts is
not this command but its output — rows carrying a timestamp inside the last window:

```bash
# A query output with a timestamp inside the last window is the evidence G8 accepts
psql -c "SELECT monitor_id, max(window_end) AS last_point, count(*) AS points_24h
         FROM ops.monitor_readings
         WHERE window_end > now() - interval '24 hours'
         GROUP BY monitor_id ORDER BY monitor_id"
# Paste the output, with its timestamps, into evidence/g8-operate.md.
# A monitor absent from this output is configured and not arriving.
```

Then the gate:

```bash
navi-delivery gate G8 --pass --evidence delivery/changes/theme-persistence/evidence/g8-operate.md
# => G8 pass (evidence: delivery/changes/theme-persistence/evidence/g8-operate.md)
```

## Checklist

- [ ] `monitors.md` exists and predates the model serving traffic
- [ ] All four layers appear in the coverage table, `none` and a reason where empty
- [ ] Every `MON-###` has all eight fields
- [ ] Every `Method` names a statistic and its parameters
- [ ] Every `Threshold` has a number and a consecutive-window count
- [ ] Every threshold states the window it was derived from and the variation observed
- [ ] The label delay is stated, and what is watched in the meantime
- [ ] Every input-feature monitor names the `CHK-###` that takes precedence over it
- [ ] No drift alert triggers a retrain; any automatic retrain is scheduled and produces a `candidate`
- [ ] Every paging monitor has a runbook with the first three checks and the rollback command
- [ ] Every owner is a person with a rota reachable at the firing hours
- [ ] Every user-visible monitor binds to an `SLI-###` with an objective and an error budget
- [ ] Every non-user-visible monitor says `no SLI` and why
- [ ] Telemetry is shown arriving, with a timestamp inside the last window
- [ ] Every monitor was re-baselined at the last promotion, and the record says so
- [ ] Every model-card failure mode maps to a monitor or an explicit `none`
- [ ] `evidence/g8-operate.md` exists and links `slo.md`, the runbooks and the telemetry output

## Anti-patterns

**Accuracy as the only monitor.** The one dashboard tracks accuracy, and the labels arrive 90
days late. The model has been wrong for three months by the time the chart moves. Watch the
inputs and the predictions, which move today.

**PSI 0.2 because everyone uses 0.2.** No derivation, so when it fires nobody knows whether
0.21 is remarkable for this feature. On a feature whose daily PSI routinely reaches 0.18, the
monitor is a coin flip. Derive the number from held-fixed history.

**One window fires the page.** Every Monday a batch lands late, the distribution shifts for an
hour, and someone is paged. Within a month the alert is muted. Require consecutive windows.

**Drift wired to retrain.** The alert triggers a retraining job, which fits the model to the
shifted world and promotes it automatically. The shift is now the model, and nobody decided
that. Alert a human, hold the incumbent.

**Drift that was a broken join.** `client_region` goes 40% null overnight and the drift monitor
fires. Three days are spent on the model. The upstream join broke, and CHK-008 had been
breaching the whole time. Check the quality check first; name it in the monitor.

**The alias owner.** `Owner: #ml-platform.` The channel has 60 members, no rota, and the alert
fires at 04:00. Name the person and the rota covering the hours the monitor can fire.

**Configured, not arriving.** The dashboard exists, the query is saved, and no reading has ever
been written because the exporter was never deployed. G8 was recorded on a screenshot. Show a
query output with a timestamp in the last window.

**The stale baseline.** Version 7 is promoted and the monitors still reference version 6's
training distribution. Every monitor now measures the difference between two models and fires
constantly, or was widened until it never fires. Re-baseline at every promotion.

**The uncovered failure mode.** The card names four ways the model fails; the monitors cover
two. The two uncovered ones will be reported by users. Map each card failure mode to a monitor
or to an honest `none`.

## Validation

```bash
CHANGE=<name>
MODEL=<model>
M=delivery/ops/models/$MODEL/monitors.md

# All four layers appear
for l in "Input drift" "Prediction drift" "Outcome decay" "Operational"; do
  grep -q "^| $l " "$M" || echo "$M: layer '$l' is not in the coverage table"
done

for id in $(grep -o 'MON-[0-9]\{3,\}' "$M" | sort -u); do
  body=$(awk -v id="$id" '$0 ~ "^### " id " " {on=1; next} /^### /{on=0} on' "$M")
  [ -n "$body" ] || { echo "$id: named in the file but has no '### $id — …' entry"; continue; }
  for k in Watches Method "Baseline window" Threshold Fires Owner Runbook Serves; do
    printf '%s\n' "$body" | grep -q "\*\*$k:\*\*" || echo "$id: missing $k"
  done
  # Threshold has a number and a consecutive-window count
  th=$(printf '%s\n' "$body" | awk '/\*\*Threshold:\*\*/{on=1} /\*\*(Fires|Label delay):\*\*/{on=0} on')
  printf '%s\n' "$th" | grep -q '[0-9]' || echo "$id: threshold has no number"
  printf '%s\n' "$th" | grep -qiE 'consecutive' || echo "$id: threshold has no consecutive-window count"
  printf '%s\n' "$th" | grep -qiE 'derived|computed over|observed' || echo "$id: threshold states no derivation"
  # The runbook it names exists
  rb=$(printf '%s\n' "$body" | awk '/\*\*Runbook:\*\*/{print}' | grep -o '`[^`]*`' | tr -d '`')
  [ -n "$rb" ] && { test -f "$rb" || echo "$id: runbook not found: $rb"; }
  # Input-feature monitors name a CHK
  printf '%s\n' "$body" | grep -q '\*\*Data-quality precedence:\*\*' \
    || echo "$id: no data-quality precedence line"
done

# No monitor retrains
grep -niE 'trigger(s)? (a )?retrain|automatically retrain|auto-retrain' "$M"

# Every owner is a person, not an alias
grep '\*\*Owner:\*\*' "$M" | grep -E '#|@|team$|rota$' \
  && echo "an Owner line names an alias rather than a person"

# Every SLI a monitor serves exists in slo.md with an objective and a budget
for s in $(grep -o 'SLI-[0-9]\{3,\}' "$M" | sort -u); do
  grep -q "^### $s " delivery/ops/slo.md || { echo "$s is not defined in delivery/ops/slo.md"; continue; }
  b=$(awk -v id="$s" '$0 ~ "^### " id " " {on=1; next} /^### /{on=0} on' delivery/ops/slo.md)
  printf '%s\n' "$b" | grep -q '\*\*Objective:\*\*'    || echo "$s: no objective"
  printf '%s\n' "$b" | grep -q '\*\*Error budget:\*\*' || echo "$s: no error budget"
done

# Every model-card failure mode is mapped
CARD=$(find delivery/specs/models/$MODEL delivery/changes/$CHANGE/specs/models/$MODEL -name model-card.md 2>/dev/null | head -1)
python3 - "$CARD" "$M" <<'PY'
import sys, pathlib, re
card, mon = (pathlib.Path(p).read_text() for p in sys.argv[1:3])
sec = re.search(r"^## Failure modes$(.*?)^## ", card, re.S | re.M)
rows = [r for r in (sec.group(1) if sec else "").splitlines()
        if r.startswith("| ") and not r.startswith("| Input condition") and not r.startswith("| -")]
norm = lambda s: " ".join(s.lower().replace("`", "").split())
covered = norm(mon.split("## Failure modes covered", 1)[-1])
for r in rows:
    cond = norm(r.split("|")[1])
    if cond and cond not in covered:
        print(f"model-card failure mode not mapped in monitors.md: {cond}")
PY

# The monitors were re-baselined at the most recent promotion
LAST=$(grep '\*\*Stage:\*\* production' delivery/ops/models/$MODEL/registry.md 2>/dev/null \
       | grep -o '[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}' | head -1)
[ -n "$LAST" ] && { grep -q "$LAST" "$M" || echo "no re-baselining recorded for the promotion of $LAST"; }

test -f delivery/changes/$CHANGE/evidence/g8-operate.md || echo "no G8 evidence index"
```

Each command prints nothing when the rule holds. The
failure-mode mapping check is the one to run before G8: it is the only mechanical link between
what the model is known to do wrong and what anyone is watching for.
