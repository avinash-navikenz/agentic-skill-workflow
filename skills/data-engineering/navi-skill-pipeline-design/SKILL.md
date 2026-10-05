---
name: navi-skill-pipeline-design
description: >
  Use when a change adds or alters a pipeline that moves or reshapes data, when G4 asks for
  end-to-end lineage, or when a rerun, a backfill or a late record has to behave predictably.
  Defines the pipeline file, the PIPE-### entry, the four run modes and their idempotency
  keys, the empty-source and lateness rules, the backfill procedure and the restatement record.
  Trigger phrases include: pipeline design, ETL, ELT, lineage, idempotent, rerun, backfill,
  late-arriving data, watermark, incremental load, full refresh, quarantine, pipeline cost,
  restatement, G4 lineage.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: data-engineering
  lifecycle_phases: [3, 4, 5]
  used_by_agents: [navi-agent-data-engineer]
  owner: avinash.negi@navikenz.com
  tags: "data, pipeline, lineage, idempotency, backfill, late-data, cost, g4"
  model: sonnet
---

## When to use

A design introduces or changes a job that reads data and writes data; G4 is about to be
recorded and needs lineage from source to consumed artifact; a pipeline has to be rerun,
backfilled or restated; or a late record has arrived and nobody has decided what happens to it.

## Rules

1. Write the pipeline document at `delivery/changes/<name>/pipeline.md` and add a row for it to
   the `## Linked artifacts` table in `design.md`, which `navi-delivery scaffold design`
   writes into
   `design.md`. That table is a design's one home for outward links; a change-scoped artifact
   never earns a heading of its own. G3 and G4 are read against the design; a file nothing
   links to is a file nobody opens.
2. Number pipelines `PIPE-###`, sequential within `delivery/`, never reused. Number each stage
   `PIPE-###.S<n>` in execution order.
3. Open the file with two lines: `Detailed here:` naming every `PIPE-###` this change adds or
   alters, and `Inherited unchanged:` naming every `PIPE-###` the lineage mentions that this
   change does not touch, with the file that defines each. A lineage hop that names a pipeline
   with no entry and no inheritance line cannot be told apart from an entry somebody forgot to
   write.
4. Give every pipeline exactly one output `DC-###` and list every input `DC-###`. A job that
   writes two datasets is two pipelines, because the two outputs fail, rerun, backfill and get
   restated on different days.
5. Declare the run mode as exactly one of four: `full-refresh` (the output is replaced),
   `incremental-append` (new rows only, never revisited), `incremental-merge` (new rows plus
   updates matched on a key), `snapshot` (a dated copy of the source as it stood). Nothing
   else, and never two.
6. State the idempotency key for the mode: `full-refresh` needs the window it replaces,
   `incremental-append` needs the watermark column and the source's ordering guarantee,
   `incremental-merge` needs the match key, `snapshot` needs the snapshot date column. A
   pipeline with no stated key is not rerunnable and does not pass G4.
7. Name the test that proves the rerun. Running the same window twice must produce the same
   output, and a test that runs it twice and compares the outputs is what makes that a fact
   rather than a belief. Name the test file in the pipeline entry.
8. State the empty-source behaviour and the minimum expected volume. A run that reads zero
   rows, or fewer than the stated minimum, fails or quarantines — never succeeds. A fast green
   run on an empty source is indistinguishable from a fast green run on a healthy one, and it
   is the second thing anyone checks and the last thing anyone monitors.
9. State a lateness bound and what happens to a record arriving after it: `reprocessed` (the
   affected window is recomputed, and the restatement is recorded under rule 13),
   `quarantined` (diverted to the named location for review), or `dropped`. `dropped` is
   admissible only with a counter emitted per run and an alert threshold on that counter.
10. Write a backfill procedure per pipeline: the command, the window granularity, the measured
   cost and runtime for one window, and whether a backfill may run concurrently with the
   scheduled run. Every pipeline is backfilled eventually; the only question is whether the
   procedure was written before or during the incident.
11. State the cost per run and the frequency the requirement assumes, and give the product as
    a monthly figure. Where the platform reports cost, name the query or command that produces
    it so the figure can be re-measured rather than re-guessed.
12. Name the trigger — a cron expression, an event, or a sensor on an upstream partition — and
    the upstream freshness it assumes. Where the trigger assumes fresher data than the
    upstream `DC-###`'s `## Freshness` guarantees, that is a design defect recorded now, not a
    runtime surprise recorded later.
13. Name the quarantine location and the person who reviews it, with a maximum age for rows
    sitting in it. A quarantine nobody reads is a delete with extra steps and a bigger bill.
14. Never rewrite a published partition in place without recording it. `## Restatements` takes
    one row per restatement: the date, the window restated, what changed, the number of rows
    affected, and the number a consumer had already reported that is now different. Where a
    figure a stakeholder has reported changes, the restatement is an escalation, not a note.
15. Write `## Lineage` as one line per hop from source system to consumed artifact, naming the
    `DC-###` at each hop and the `PIPE-###` between them. That section is what satisfies G4's
    end-to-end lineage criterion; a diagram that is regenerated by hand is not it.
16. State the failure behaviour of every stage in its row: what the stage does when its input
    is missing, malformed, or larger than expected, and whether the downstream stages run.
    `retries` is not a failure behaviour unless the number of retries and the behaviour after
    the last one are both stated.
17. Record the pipeline before G4 is recorded. `cli/lib/lanes.js` gives `standard` the fixed
    set `G1, G2, G3, G5, G6, G7, G8` and `navi-delivery gate` refuses a gate outside the
    lane's set, so a pipeline change on `standard` has no G4 to pass. Take `full` at proposal
    time under `navi-skill-lane-selection`.

## Decision table

| Observed condition | Required action |
|---|---|
| The job writes two datasets | Split into two `PIPE-###`; one output each |
| The source is append-only with a monotonic timestamp | `incremental-append`; key is the watermark column |
| The source revises rows after first emitting them | `incremental-merge`; key is the match key, not the timestamp |
| The source has no reliable key and is small | `full-refresh`; key is the window replaced |
| The requirement is "what did it look like on date X" | `snapshot`; key is the snapshot date column |
| No idempotency key can be stated | The pipeline is not rerunnable — redesign before G4 |
| The run reads zero rows | Fail or quarantine; never a green run |
| Volume is below the stated minimum | Same as zero — fail or quarantine and page the owner |
| A record arrives after the lateness bound | Reprocess, quarantine, or drop with a counter and an alert |
| A partition already published must change | Record a `## Restatements` row before publishing the correction |
| The restated figure has already been reported by a stakeholder | Escalate; do not silently republish |
| The trigger assumes fresher data than the upstream contract guarantees | Design defect — loosen the trigger or renegotiate the contract |
| A backfill must run while the schedule runs | State it in the procedure, or state that it must not and how the schedule is paused |
| Cost per run is unknown | Measure one run before G4; an unmeasured cost is an unbounded one |
| The quarantine has no named reviewer | Not a quarantine — name the reviewer and the maximum age |
| A lineage hop names a pipeline this change does not touch | List it under `Inherited unchanged:` with the file that defines it |
| The change is on the `standard` lane | Re-propose on `full`; `standard` cannot record G4 |

## Template

Copy into `delivery/changes/<name>/pipeline.md`, and add its row to `design.md`'s
`## Linked artifacts` table:

```markdown
# Pipelines — theme-persistence

Linked from `design.md`'s `## Linked artifacts` table.
Detailed here: PIPE-004 (output DC-003).
Inherited unchanged: PIPE-003 (`delivery/specs/data/raw-session-events/pipeline.md`),
PIPE-005 (`delivery/specs/data/theme-daily/pipeline.md`).

## Lineage

| Hop | From | Via | To |
|---|---|---|---|
| 1 | `identity-service` event stream (Kafka `sessions.v1`) | PIPE-003 | DC-002 `raw_session_events` |
| 2 | DC-002 `raw_session_events` | PIPE-004 | DC-003 `session_events` |
| 3 | DC-003 `session_events` | PIPE-005 | DC-005 `theme_daily` |
| 4 | DC-005 `theme_daily` | Growth dashboard (read-only) | — |

### PIPE-004 — raw_session_events → session_events

- **Inputs:** DC-002
- **Output:** DC-003
- **Run mode:** `incremental-merge`
- **Idempotency key:** `event_id` (UUIDv4, emitted by the producer). The merge matches on
  `event_id` and replaces the row; rerunning any window lands on the same rows.
- **Rerun test:** `test/pipelines/pipe-004-rerun-idempotent.spec.py` runs the 2026-09-14
  window twice against a fixture and asserts the two outputs are byte-identical.
- **Trigger:** cron `0 2 * * *` UTC, gated on a sensor for DC-002's `event_date` partition.
  Assumes DC-002 is no more than 2 hours stale at 02:00; DC-002's contract guarantees 90
  minutes, so the assumption holds with 30 minutes of margin.
- **Minimum volume:** 0.6 × the median row count of the previous 7 runs. Below that the run
  fails, writes nothing to DC-003, and pages the DC-003 owner.
- **Empty source:** fails. Zero rows is never a success for this pipeline; the producer emits
  at least the keep-alive session refreshes.
- **Lateness bound:** 2 hours after `event_ts`. A record later than that is `reprocessed`: the
  affected `event_date` partition is recomputed on the next run and a `## Restatements` row is
  written if the partition had already been read by a consumer.
- **Quarantine:** `warehouse.quarantine.session_events`, reviewed by Dan Okafor. Maximum age
  7 days; rows older than that breach CHK-009.
- **Cost:** 4.10 USD per run measured 2026-09-20, 24 runs/month = 98 USD/month. Re-measure
  with `SELECT job_id, total_bytes_processed, total_slot_ms FROM warehouse.ops.job_history
  WHERE job_label = 'pipe-004' ORDER BY start_ts DESC LIMIT 10`.
- **Backfill:** `python3 pipelines/run.py --pipeline pipe-004 --from 2026-06-01 --to 2026-08-31
  --granularity day`. One day-window costs 4.10 USD and runs 6 minutes; 92 days is 377 USD and
  about 9 hours. Must not run concurrently with the schedule — pause the trigger first, because
  both write the same partitions with the same merge key and the later writer wins by clock,
  not by correctness.

| Stage | Reads | Writes | Failure behaviour |
|---|---|---|---|
| PIPE-004.S1 | DC-002 partition | staging table | Missing partition: fail, no retry — the sensor should have prevented it |
| PIPE-004.S2 | staging table | staging table | Malformed `event_ts`: row to quarantine, counter `pipe004_bad_ts`, run continues |
| PIPE-004.S3 | staging table | staging table | Client-retry rule (ADR-011) drops `refreshed` within 30s of `created`; counter emitted |
| PIPE-004.S4 | staging table | DC-003 | Merge fails: 3 retries at 60s, then fail the run; S5 does not execute |
| PIPE-004.S5 | DC-003 | run log | Never fails the run; a failed log write pages the owner |

## Restatements

| Date | Pipeline | Window | What changed | Rows | Reported figure affected |
|---|---|---|---|---|---|
| 2026-08-04 | PIPE-004 | 2026-07-28..2026-08-02 | ADR-011's client-retry rule applied retroactively; duplicate `refreshed` events removed | 412,880 | Yes — July session count fell 3.1%; Ana Costa notified, escalated to Priya Raman before republishing |
```

## Checklist

- [ ] `pipeline.md` exists and `design.md`'s `## Linked artifacts` table carries a row for it
- [ ] `Detailed here:` and `Inherited unchanged:` between them account for every `PIPE-###` in the file
- [ ] Every `PIPE-###` names its input `DC-###`s and exactly one output `DC-###`
- [ ] Every pipeline declares exactly one of the four run modes
- [ ] Every pipeline states an idempotency key appropriate to its mode
- [ ] Every pipeline names a rerun test that runs the same window twice and compares
- [ ] Every pipeline states a minimum volume and an empty-source behaviour that is not success
- [ ] Every pipeline states a lateness bound and one of `reprocessed` / `quarantined` / `dropped`
- [ ] Every `dropped` has a per-run counter and an alert threshold
- [ ] Every pipeline has a backfill command, granularity, measured cost and concurrency rule
- [ ] Cost per run is measured, not estimated, and the re-measuring query is named
- [ ] Every trigger's assumed upstream freshness is no tighter than that contract's guarantee
- [ ] Every quarantine names a reviewer and a maximum age
- [ ] Every stage row states a failure behaviour, with retry counts where retries exist
- [ ] `## Lineage` runs from source system to consumed artifact with a `DC-###` at each hop
- [ ] Every in-place rewrite of a published partition has a `## Restatements` row
- [ ] The lane is `full`, because `standard` cannot record G4

## Anti-patterns

**The non-idempotent upsert.** `INSERT` keyed on an auto-increment id, run mode called
"incremental". The second run of the same window doubles the rows, and nobody notices until a
count is compared against the source. State the key the merge matches on, and prove it with a
run-twice test.

**The silent empty run.** The sensor is wrong, the source partition is empty, the job reads
zero rows in eleven seconds and reports success. The dashboard shows a cliff and someone calls
it a real drop in usage. State the minimum volume and fail below it.

**Lateness by omission.** No bound stated, so late records are whatever the code happens to do
— usually silently absent from a closed window and silently present in an open one. Decide it
once: reprocess, quarantine, or drop with a counter.

**The backfill invented under pressure.** No procedure, so during the incident someone loops
over dates in a shell. It runs concurrently with the schedule, both write the same partitions,
and the output depends on which finished last. Write the command, the granularity, the cost
and the concurrency rule while nothing is on fire.

**Cost as an estimate.** `Roughly a few dollars a run.` The requirement assumes hourly, the job
costs 4.10 USD, and the monthly figure is 3,000 USD against a feature funded for 200. Measure
one run and multiply.

**Two datasets, one job.** A single script writing both `session_events` and `theme_daily`
because they share a read. The day `theme_daily` needs a backfill, `session_events` gets one
too, and the restatement touches a dataset that did not need restating. Split them.

**Lineage as a picture.** A diagram in a slide deck, last updated two pipelines ago. G4 asks
for lineage end to end, and the diagram answers a question about 2026-06. Write the hop table
next to the pipelines it describes.

**The unreviewed quarantine.** Rows divert into a quarantine table for nine months. It now
costs more than the pipeline and contains the only copy of a week nobody noticed was missing.
Name the reviewer and the maximum age.

**Silent restatement.** The July numbers are corrected in place on a Tuesday. The figure in
last month's board pack is now unreproducible and nobody can say which one was right. Write
the `## Restatements` row, and escalate where a reported figure moved.

## Validation

```bash
CHANGE=<name>
P=delivery/changes/$CHANGE/pipeline.md

grep -q 'pipeline.md' delivery/changes/$CHANGE/design.md || echo "design.md does not link pipeline.md"

# Every PIPE-### in the file is either detailed here or declared inherited
HDR=$(sed -n '1,/^## /p' "$P")
for id in $(grep -o 'PIPE-[0-9]\{3,\}' "$P" | sort -u); do
  printf '%s\n' "$HDR" | grep -q "$id" \
    || echo "$id: named in the file but in neither 'Detailed here:' nor 'Inherited unchanged:'"
done

# Every pipeline this change details carries the mandatory fields
DETAILED=$(printf '%s\n' "$HDR" | awk '/^Detailed here:/{on=1} /^Inherited unchanged:/{on=0} on' | grep -o 'PIPE-[0-9]\{3,\}')
for id in $DETAILED; do
  body=$(awk -v id="$id" '$0 ~ "^### " id " " {on=1; next} /^### /{on=0} on' "$P")
  [ -n "$body" ] || { echo "$id: declared detailed here but has no '### $id — …' entry"; continue; }
  for f in "Inputs" "Output" "Run mode" "Idempotency key" "Rerun test" "Trigger" \
           "Minimum volume" "Empty source" "Lateness bound" "Quarantine" "Cost" "Backfill"; do
    printf '%s\n' "$body" | grep -q "\*\*$f:\*\*" || echo "$id: missing $f"
  done
  # Exactly one of the four run modes
  n=$(printf '%s\n' "$body" | grep -c '\*\*Run mode:\*\* `\(full-refresh\|incremental-append\|incremental-merge\|snapshot\)`')
  [ "$n" = 1 ] || echo "$id: run mode is not exactly one of the four"
  # A dropped lateness policy needs a counter — searched inside the lateness-bound block
  # only, because every pipeline entry mentions a counter somewhere in its stage table.
  lb=$(printf '%s\n' "$body" | awk '/\*\*Lateness bound:\*\*/{on=1;print;next} /^- \*\*/{on=0} on')
  printf '%s\n' "$lb" | grep -q 'dropped' \
    && ! printf '%s\n' "$lb" | grep -qi 'counter' \
    && echo "$id: drops late records with no counter in the lateness-bound block"
done

# Every pipeline output is a contract that exists
for id in $(awk '/\*\*Output:\*\*/{print}' "$P" | grep -o 'DC-[0-9]\{3,\}' | sort -u); do
  grep -rqs "^# $id " delivery/specs/data delivery/changes/*/specs/data \
    || echo "$P: output $id has no contract"
done

# Exactly one output per pipeline
awk '/^### PIPE-/{id=$2} /\*\*Output:\*\*/{n=gsub(/DC-[0-9]{3,}/,"&"); if (n!=1) print id" has "n" outputs"}' "$P"

# Lineage reaches a consumed artifact, not just the warehouse
grep -q '^## Lineage$' "$P" || echo "no '## Lineage' section"

# Every rerun test named actually exists in the repo
for t in $(grep -o '`[^`]*rerun[^`]*`' "$P" | tr -d '`'); do
  test -e "$t" || echo "rerun test not found: $t"
done

# The lane can record G4 at all
LANE=$(python3 -c 'import json;print(json.load(open("delivery/.adlc/state.json"))["lane"])')
[ "$LANE" = full ] || echo "lane is '$LANE' — G4 is enforced only on 'full'; re-propose before recording G4"
```

Each command prints nothing when the rule holds, except the lane check. The rerun-test
existence check is the one that catches the common failure: the field is filled in with a path
that was going to be written and never was.
