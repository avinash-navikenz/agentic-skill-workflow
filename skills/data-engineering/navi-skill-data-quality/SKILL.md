---
name: navi-skill-data-quality
description: >
  Use when defining what "good" means for a dataset, when G4 asks for data-quality checks and
  their thresholds, or when a check has breached and the run has to do something. Defines the
  checks file, the CHK-### entry, the five dimensions that must each be covered or explicitly
  recorded empty, the three breach behaviours, and the run record the gates read.
  Trigger phrases include: data quality, data validation, quality checks, null rate, row count
  anomaly, freshness check, referential integrity, threshold, quarantine, data quality breach,
  expectations, great expectations, dbt test, G4 checks.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: data-engineering
  lifecycle_phases: [4, 5, 8]
  used_by_agents: [navi-agent-data-engineer, navi-agent-mlops-engineer]
  owner: avinash.negi@navikenz.com
  tags: "data, data-quality, checks, thresholds, quarantine, g4, g8"
  model: sonnet
---

## When to use

A dataset is being contracted and needs checks with thresholds; G4 is about to be recorded and
needs the checks and their behaviour on breach; a check has breached and the run has to fail,
quarantine or warn; or G8 is about to be recorded and the checks need live alerts and runbooks.

## Rules

1. Write one checks file per dataset at
   `delivery/changes/<name>/specs/data/<dataset>/checks.md`, beside that dataset's
   `contract.md`. `navi-delivery archive` folds `changes/<name>/specs/` into `delivery/specs/`,
   so the checks become current truth with the contract they belong to rather than being
   archived away from it.
2. Number checks `CHK-###`, unique across `delivery/specs/data/`, never reused. A check whose
   definition changes keeps its id and gains a dated row in `## History`; a check that is
   retired is marked `retired` with a date, not deleted.
3. Give every check six fields: `Dataset`, `Asserts`, `Threshold`, `On breach`, `Owner`,
   `Serves`. All six, on every check.
4. Run the five-dimension pass against every dataset and record all five, including the ones
   with no check, as `none` with the reason: **completeness** (are the rows and the values
   there), **validity** (does each value belong to its declared domain), **uniqueness** (is the
   key a key), **consistency** (do the referenced things exist and do the derived figures
   agree), **timeliness** (is it as fresh as the contract promises). A dimension left
   unmentioned cannot be told apart from a dimension nobody considered.
5. Write `Threshold` as a number and a window. `null_rate(client_region) <= 0.12 over the run's
   partition` is a threshold; `low`, `reasonable` and `about the same as usual` are not, because
   two people reading them disagree and the job cannot evaluate either.
6. Open the second sentence of every `Threshold` with `Derived from` and name the source:
   either the window of history it was computed over and the variation observed in that
   window, or the contract clause, requirement or promotion criterion it is copied from. A
   threshold with no stated derivation was guessed, and the first time it fires nobody can
   tell a real breach from a bad number. Not every threshold comes from history — a bound
   copied from `PIPE-###`'s lateness bound or `DC-###`'s freshness guarantee is a derivation,
   and naming it is what lets a reader re-derive it when that clause moves.
7. Set `On breach` to exactly one of three: `fail` (the run stops and writes nothing
   downstream), `quarantine` (the offending rows go to the named location, the run continues,
   and the diverted count is emitted as a metric), `warn` (the run continues and an alert
   reaches a named person). Nothing else. `log it` is not a breach behaviour, because a log
   line with no reader is the same as no line.
8. Use `warn` only where the alert reaches a named person on a reachable rota. A `warn` routed
   to a channel with no rota is a `fail` that has been disabled.
9. Never impute in a check. A check reports; it does not repair. Where a gap is filled with a
   default or an estimate, that filling is a transformation: declare it in the contract's
   `## Produced by`, give it its own `NOTFIT-###`, and check the filled column's rate like any
   other. A check that quietly fixes what it finds destroys the evidence that anything was
   wrong.
10. Bind every check to what it protects with `Serves`: a `REQ-###`, a `DC-###` field, or both.
    A check protecting nothing named is a check nobody will defend when it becomes noisy.
11. Run the checks against the training and evaluation sets too, not only the production feed.
    A model fitted on a snapshot the checks never saw has an unmeasured input, and the
    evaluation inherits whatever was wrong with it. Record those runs in the same record.
12. Record every run's result. `delivery/changes/<name>/evidence/g4-data-model.md` carries the
    latest run for each `CHK-###`: the id, the verdict, the observed value, the threshold and
    the run identifier. A check defined and never run is a plan, not evidence, and the gate is
    recorded on it.
13. Never re-run a failing check until it passes. A check that passes on the third attempt is
    flaky, and gates.md's G6 criterion requires a flaky test quarantined with an owner and a
    date rather than re-run until green. The same applies here: mark it flaky, give it an
    owner and a date, and record the verdict from the first run.
14. Give every quarantine location a named reviewer and a maximum age, and a `CHK-###` of its
    own that breaches when rows sit there longer than that age. Rows that accumulate unread
    are data loss with a storage bill.
15. Carry a breach that will not be fixed in this change into a waiver under
    `navi-skill-waivers-and-deferrals`. `navi-delivery gate --waive` attaches one reason and
    one expiry to a whole gate, so the reason names the `CHK-###`, the earliest expiry among
    the waived checks wins, and settling means re-running the checks and re-recording the gate.
16. At G8, every check whose `On breach` is `warn` or `quarantine` has a live alert and a
    runbook under `delivery/ops/runbooks/`. gates.md requires a runbook for every alert that
    can page a human; a check that pages with no runbook pages someone who then reads the SQL.
17. Record the checks before G4 is recorded. `cli/lib/lanes.js` gives `standard` a fixed gate
    set without G4 and `navi-delivery gate` refuses a gate outside the lane's set, so a data
    change on `standard` has no G4 to pass. Take `full` at proposal time under
    `navi-skill-lane-selection`.

## Decision table

| Observed condition | Required action |
|---|---|
| A dimension has no check | Record it as `none` with the reason; never leave it unmentioned |
| The threshold offered is a word | Reject it — write a number and a window |
| The threshold has no stated derivation | Write `Derived from …` naming a history window with its variation, or the contract clause it copies |
| A breach would corrupt everything downstream | `On breach: fail` |
| A breach affects identifiable rows and the rest are usable | `On breach: quarantine`, with the location and the diverted-count metric |
| A breach is informational and a named person is on a rota | `On breach: warn` |
| A breach is informational and no rota exists | Not `warn` — it is `fail` until someone owns it |
| The proposed fix is to fill the gap with a default | Not a check — declare the fill in `## Produced by` and add a `NOTFIT-###` |
| The check passed on the third re-run | Flaky: record the first verdict, quarantine the check with an owner and a date |
| The model is trained on a snapshot | Run the same `CHK-###` against the snapshot and record the run |
| A check is defined but has never run | Not evidence — run it before recording G4 |
| A breach will not be fixed in this change | Waive at the gate, naming the `CHK-###` and taking the earliest expiry |
| The quarantine has no reviewer or no maximum age | Add both, plus a `CHK-###` on the quarantine's own age |
| G8 is being recorded and a `warn` check has no runbook | Write the runbook; G8's criterion is unsatisfied without it |
| The change is on the `standard` lane | Re-propose on `full`; `standard` cannot record G4 |

## Template

Copy into `delivery/changes/<name>/specs/data/session-events/checks.md`:

```markdown
# Checks — DC-003 `session_events`

Contract: `./contract.md`. Runner: `pipelines/checks/run.py --dataset session_events`.

## Dimension pass

| Dimension | Checks | If none, why |
|---|---|---|
| Completeness | CHK-007, CHK-008 | — |
| Validity | CHK-009 | — |
| Uniqueness | CHK-011 | — |
| Consistency | CHK-012 | — |
| Timeliness | CHK-013 | — |
| Quarantine age | CHK-014 | — |

### CHK-007 — Row count against recent history

- **Dataset:** DC-003, the run's `event_date` partition
- **Asserts:** `row_count >= 0.6 * median(row_count over the previous 7 completed runs)`
- **Threshold:** `0.6`. Derived from 90 days to 2026-09-20: the daily count's 5th percentile is
  0.71 of the trailing median, and the lowest observed ratio on a non-incident day is 0.64.
  0.6 sits below every healthy day in that window and above the 0.12 seen on the 2026-07-30
  partial outage.
- **On breach:** `fail` — the run stops and DC-003 is not written
- **Owner:** Dan Okafor
- **Serves:** DC-003 `## Freshness`, REQ-004

### CHK-008 — Null rate on `client_region`

- **Dataset:** DC-003, the run's partition
- **Asserts:** `null_rate(client_region) <= 0.12`
- **Threshold:** `0.12`. Derived from 90 days to 2026-09-20: mean 0.084, standard deviation
  0.011, maximum 0.107. 0.12 is the maximum plus one standard deviation.
- **On breach:** `warn` — alert to the `#data-platform` rota, which pages Dan Okafor as
  primary and Ana Costa as secondary. Documented at `delivery/ops/runbooks/chk-008.md`.
- **Owner:** Dan Okafor
- **Serves:** DC-003 `client_region`, NOTFIT-002

### CHK-009 — `event_ts` is parseable and within the window

- **Dataset:** DC-003, the run's partition
- **Asserts:** `event_ts` parses as an ISO-8601 UTC timestamp and falls inside
  `[partition_date - 2h, partition_date + 26h]`
- **Threshold:** 0 rows may fail. Derived from PIPE-004's 2-hour lateness bound and DC-003's
  26-hour freshness guarantee — not from history: both bounds are commitments, and this check
  exists to detect a row that violates one.
- **On breach:** `quarantine` — rows to `warehouse.quarantine.session_events`, run continues,
  metric `pipe004_quarantined_rows` emitted per run.
  Runbook `delivery/ops/runbooks/chk-009.md`
- **Owner:** Dan Okafor
- **Serves:** DC-003 `event_ts`, REQ-004

### CHK-011 — `event_id` is unique within the partition

- **Dataset:** DC-003, the run's partition
- **Asserts:** `COUNT(*) = COUNT(DISTINCT event_id)`
- **Threshold:** 0 duplicates. Derived from PIPE-004's stated idempotency key: `event_id` is
  the merge key, so a duplicate means the merge did not match and the rerun guarantee no longer
  holds. No tolerance is available to derive from history.
- **On breach:** `fail`
- **Owner:** Dan Okafor
- **Serves:** DC-003 `event_id`, PIPE-004 idempotency key

### CHK-012 — Every `user_id` exists in the user directory

- **Dataset:** DC-003, the run's partition, joined to DC-001 `user_directory`
- **Asserts:** every `user_id` in the partition has a matching row in DC-001
- **Threshold:** `<= 0.001` unmatched. Derived from 90 days to 2026-09-20: the unmatched rate
  is 0 on 86 of 90 days and reaches 0.0004 on the four days following an account-merge run.
- **On breach:** `quarantine` — unmatched rows diverted, run continues.
  Runbook `delivery/ops/runbooks/chk-012.md`
- **Owner:** Dan Okafor
- **Serves:** DC-003 `user_id`, DC-001

### CHK-013 — Partition freshness

- **Dataset:** DC-003, the run's partition
- **Asserts:** `now() - max(event_ts) <= 26 hours`
- **Threshold:** `26 hours`. Derived from DC-003's `## Freshness` guarantee, which is itself
  the 24-hour cadence plus PIPE-004's 2-hour lateness bound. Copied rather than re-derived, so
  that a change to the contract moves both.
- **On breach:** `fail` — the run stops and DC-003 is not written
- **Owner:** Dan Okafor
- **Serves:** DC-003 `## Freshness`

### CHK-014 — Quarantine age

- **Dataset:** `warehouse.quarantine.session_events`
- **Asserts:** `max(age(quarantined_at)) <= 7 days`
- **Threshold:** `7 days`. Derived from PIPE-004's stated quarantine maximum age, copied so
  that a change to the pipeline moves the check with it.
- **On breach:** `warn` — alert to Dan Okafor, who is the named reviewer.
  `delivery/ops/runbooks/chk-014.md`
- **Owner:** Dan Okafor
- **Serves:** PIPE-004 quarantine

## History

| Date | Check | Change |
|---|---|---|
| 2026-09-22 | CHK-008 | Threshold raised 0.09 → 0.12 after the corporate-proxy population grew; re-derived over the 90 days to 2026-09-20 |
```

The run record the gate reads, at `delivery/changes/<name>/evidence/g4-data-model.md`:

```markdown
## Data-quality runs

Runner output: `pipelines/checks/run.py --dataset session_events --partition 2026-09-27`
(run id `chk-20260927-01`), plus the training-snapshot run `chk-20260927-train`.

| Check | Set | Verdict | Observed | Threshold |
|---|---|---|---|---|
| CHK-007 | production partition 2026-09-27 | pass | 0.97 of trailing median | >= 0.6 |
| CHK-008 | production partition 2026-09-27 | pass | 0.091 | <= 0.12 |
| CHK-009 | production partition 2026-09-27 | pass | 0 rows quarantined | 0 |
| CHK-011 | production partition 2026-09-27 | pass | 0 duplicates | 0 |
| CHK-012 | production partition 2026-09-27 | pass | 0 unmatched | <= 0.001 |
| CHK-013 | production partition 2026-09-27 | pass | 3h 11m | <= 26 hours |
| CHK-014 | quarantine table | pass | 2 days | <= 7 days |
| CHK-007 | training snapshot 2026-04-01..2026-09-01 | pass | 0.88 of trailing median (lowest day) | >= 0.6 |
| CHK-008 | training snapshot 2026-04-01..2026-09-01 | **fail** | 0.144 (2026-06-11..2026-06-18) | <= 0.12 |
| CHK-011 | training snapshot 2026-04-01..2026-09-01 | pass | 0 duplicates | 0 |
| CHK-012 | training snapshot 2026-04-01..2026-09-01 | pass | 0.0002 unmatched | <= 0.001 |

CHK-008 fails on one week of the training snapshot. First-run verdict recorded; the check was
not re-run. Dispositioned by waiver — see below.
```

Waiving the breach that will not be fixed in this change:

```bash
navi-delivery gate G4 --waive "CHK-008 fails on the 2026-06-11..06-18 training window (null_rate 0.144 vs 0.12); the week is excluded from training and DC-003 NOTFIT-002 records it. Re-derivation tracked as DATA-2291." --expires 2026-12-15
# => G4 waived until 2026-12-15
```

## Checklist

- [ ] `checks.md` sits beside `contract.md` under `changes/<name>/specs/data/<dataset>/`
- [ ] Every `CHK-###` is unique across `delivery/specs/data/` and carries all six fields
- [ ] All five dimensions appear in the pass, with `none` and a reason where there is no check
- [ ] Every `Threshold` is a number and a window
- [ ] Every threshold says `Derived from …`, naming a history window and its variation or the clause it copies
- [ ] Every `On breach` is exactly `fail`, `quarantine` or `warn`
- [ ] Every `warn` names a person on a reachable rota
- [ ] No check repairs what it finds; every fill is declared in the contract with a `NOTFIT-###`
- [ ] Every check has a `Serves`
- [ ] The training and evaluation sets were checked, and those runs are in the record
- [ ] Every check has a recorded run with an observed value, not just a definition
- [ ] No failing check was re-run until green; any flaky check is quarantined with an owner and a date
- [ ] Every quarantine has a reviewer, a maximum age, and a `CHK-###` on that age
- [ ] Any unfixed breach is waived with the `CHK-###` named and a real expiry
- [ ] Every `warn` and `quarantine` check has a runbook before G8
- [ ] The lane is `full`, because `standard` cannot record G4

## Anti-patterns

**`not_null` on everything.** Forty generated checks, one per column, all asserting the column
is not null. Nothing fails, because the columns were already `not-null` in the schema, and the
checks that would have caught the real problem — the count halving, the enum gaining a value —
were never written. Cover the five dimensions, not the column list.

**The word threshold.** `Asserts: row count is reasonable.` The job cannot evaluate it, so it
is evaluated by whoever is looking, differently each time. Write the number and the window.

**The undocumented number.** `row_count >= 100000`. Where did 100000 come from? It was the
count on the day it was written. Six months later the dataset has grown fourfold and the check
has been vacuous for five of them. State the derivation, and re-derive when it changes.

**`log it`.** `On breach: log a warning.` The log has no reader, the breach has no owner, and
the run is green. Pick one of the three behaviours, and if the answer is really `warn`, name
the person who receives it.

**The check that repairs.** `COALESCE(client_region, 'ZZ')` inside the check, so the null rate
is always zero. The check now guarantees that the problem is invisible. Checks report; the
contract declares the fill and carries the `NOTFIT-###`.

**Re-run until green.** The check fails, somebody re-runs the job, it passes, the gate is
recorded on the second run. The first verdict was the true one and it is now unrecorded. Record
the first verdict and quarantine the flaky check with an owner and a date.

**Production-only checking.** Every check runs on the daily feed and none on the training
snapshot the model was fitted to. The snapshot contains a week the pipeline was double-counting
and the model learned it. Run the same checks against every set that feeds a decision.

**The write-only quarantine.** Rows have been diverting for nine months. It is now the largest
table in the warehouse and contains the only copy of a week that is missing from the main
table. Name the reviewer, set the maximum age, and check that age.

**Definitions as evidence.** `evidence/g4-data-model.md` lists twelve checks and no results.
G4 is recorded, and the first time any of them runs is in production. Record the observed
value beside the threshold.

## Validation

```bash
CHANGE=<name>
SPECS=delivery/changes/$CHANGE/specs/data

for f in $(find "$SPECS" -name checks.md 2>/dev/null); do
  # The five dimensions are all named
  for d in Completeness Validity Uniqueness Consistency Timeliness; do
    grep -q "^| $d " "$f" || echo "$f: dimension '$d' is not in the pass"
  done

  for id in $(grep -o 'CHK-[0-9]\{3,\}' "$f" | sort -u); do
    body=$(awk -v id="$id" '$0 ~ "^### " id " " {on=1; next} /^### /{on=0} on' "$f")
    [ -n "$body" ] || { echo "$id: named in the pass table but has no '### $id — …' entry"; continue; }
    for k in Dataset Asserts Threshold "On breach" Owner Serves; do
      printf '%s\n' "$body" | grep -q "\*\*$k:\*\*" || echo "$id: missing $k"
    done
    # On breach is exactly one of the three
    printf '%s\n' "$body" | grep '\*\*On breach:\*\*' \
      | grep -qE '`(fail|quarantine|warn)`' || echo "$id: 'On breach' is not one of fail/quarantine/warn"
    # Threshold carries a digit
    printf '%s\n' "$body" | grep '\*\*Threshold:\*\*' \
      | grep -q '[0-9]' || echo "$id: threshold has no number in it"
    # Threshold states a derivation
    printf '%s\n' "$body" | awk '/\*\*Threshold:\*\*/{on=1} /\*\*On breach:\*\*/{on=0} on' \
      | grep -q 'Derived from' || echo "$id: threshold does not say 'Derived from …'"
  done
done

# Every check has a recorded run with an observed value
EV=delivery/changes/$CHANGE/evidence/g4-data-model.md
for id in $(find "$SPECS" -name checks.md -exec grep -ho 'CHK-[0-9]\{3,\}' {} + 2>/dev/null | sort -u); do
  grep -q "^| $id " "$EV" || echo "$id: defined but has no run in the G4 evidence"
done

# No run row records a verdict without an observed value
awk -F'|' '/^\| *CHK-/ { if ($5 ~ /^[[:space:]]*$/) print "run row with no observed value: "$2 }' "$EV"

# If anything failed or was waived, G4 must be waived rather than passed
grep -qi 'fail' "$EV" \
  && grep '"gate":"G4"' delivery/.adlc/events.jsonl | tail -1 | grep -q '"verdict":"pass"' \
  && echo "G4 recorded as pass while a check run is recorded failed"

# Every warn/quarantine check has a runbook before G8
find delivery/specs/data delivery/changes/*/specs/data -name checks.md 2>/dev/null | while read -r f; do
  awk '/^### CHK-/{id=$2}
       /\*\*On breach:\*\* `warn`/ || /\*\*On breach:\*\* `quarantine`/ {print tolower(id)}' "$f" \
    | while read -r c; do
        test -f "delivery/ops/runbooks/$c.md" || echo "$c: no runbook at delivery/ops/runbooks/$c.md"
      done
done

LANE=$(python3 -c 'import json;print(json.load(open("delivery/.adlc/state.json"))["lane"])')
[ "$LANE" = full ] || echo "lane is '$LANE' — G4 is enforced only on 'full'; re-propose before recording G4"
```

Each command prints nothing when the rule holds, except the lane check. The "defined but has no
run" loop is the one that catches the failure this skill exists to prevent: a gate recorded on
a list of intentions.
