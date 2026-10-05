# Walkthrough — one change, end to end

This follows a single small change, `add-csv-export`, from an idea to an archived spec. It
is a **standard** lane change: a feature inside an existing capability, touching no data and
no model.

Every command below was run, and every block marked `output` is the CLI's own output copied
from that run — including the part where G6 fails and the change goes back for rework, which
is the part worth reading twice.

Prerequisites: you have run `./install.sh --yes` and `npm install --global .`. See the
[README](../README.md).

---

## Phase 1 — Plan

### Scaffold the framework into the repo

```bash
cd ~/work/reporting-service
navi-delivery init
```

```text
Initialised delivery/  ·  harness claude-code  ·  prompts and the send record gitignored
The record (specs, decisions, gate verdicts) will be committed — --private keeps it local.

Next:  navi-delivery propose <name> --lane <express|standard|full|hotfix>
```

`init` writes `delivery/`, generates `delivery/AGENTS.md` from the agent and skill tree, and
detects the harness from the environment. It is idempotent per repo and only needs running
once.

### Open the change

The lane is chosen **now**, before any work, and it cannot be widened later. This change
touches no dataset, schema, feature store or model, so `standard` is right. If it did touch
any of those, it would be `full` — see [ADLC.md](../ADLC.md) §3.

```bash
navi-delivery propose add-csv-export --lane standard
```

```text
Created delivery/changes/add-csv-export  ·  lane standard  ·  7 gates: G1 · G2 · G3 · G5 · G6 · G7 · G8

  proposal.md   why this change, and the outcome it commits to
  design.md     the approach — one heading per G3 criterion
  tasks.md      TASK-### bound to the REQ-### each implements
  handoffs.md   who hands what to whom, and what is blocked

Start with proposal.md. G1 reads it: proposal.md filled in: a measurable outcome, and the
non-goals a reader would assume were in scope.

Then:  navi-delivery gate G1 --pass --evidence delivery/changes/add-csv-export/proposal.md
```

Note what that line tells you: seven gates, not nine. G4 and G9 are **outside this lane's
set**, and `navi-delivery gate G4` will refuse outright rather than record a skip.

```bash
navi-delivery status
```

```text
change: add-csv-export
lane:   standard

  G1  pending
  G2  pending
  G3  pending
  G5  pending
  G6  pending
  G7  pending
  G8  pending
```

### Fill in the proposal

`propose` wrote `delivery/changes/add-csv-export/proposal.md` from a template with
placeholders. G1's exit criteria are read against this file, so a placeholder left in place
is a criterion nobody answered. The Product Owner owns this phase; `navi-skill-change-proposal`
and `navi-skill-outcome-and-kpi-definition` are the skills that govern it.

```markdown
## Why
Analysts re-key report figures into spreadsheets by hand. INSIGHT-004 from the Q2
reporting postmortem named this as the largest single source of transcription error.
Outcome: hand-transcription of report figures falls to zero.

## What changes
A `Download CSV` control on the report view, and a route that serialises the current
report to CSV.

## Impact
The reporting service and its web view. No schema change, no new data source, no PII
beyond what the report already displays.

## Non-goals
Excel (.xlsx) export. Scheduled or emailed exports. Exporting anything other than the
report currently on screen.

## Lane
`standard` — a feature inside an existing capability, touching no dataset, schema,
feature store or model.
```

Two things that look like padding and are not. **`Why` cites `INSIGHT-004`** — this change
is the Learn phase of an earlier change closing its loop, which is the whole point of the
model. **Non-goals name things a reader would otherwise reasonably assume are in scope**;
"Excel export" belongs there precisely because someone will ask.

---

## Phase 2 — Specify

The Business Analyst owns this phase. The QA Engineer is **consulted here**, not at phase 6:
a criterion that cannot be tested is cheapest to fix while it is still being written.

New requirements go in the change's **delta spec**, not in `delivery/specs/`. The validator
scans both, so a requirement is traceable from the moment it is written, and `archive` folds
the delta into `delivery/specs/` at the end.

`delivery/changes/add-csv-export/specs/reporting/spec.md`:

```markdown
# Capability — Reporting

### REQ-001 — Export a report as CSV
**Priority:** Must

An analyst can download the report currently on screen as a CSV file.

#### AC-001
Given a report with at least one row,
when the analyst opens it,
then a `Download CSV` control is present.

#### AC-002
Given the analyst activates `Download CSV`,
when the file is opened,
then its header row names every visible column, in display order.

#### AC-003
Given a report with zero rows,
when the analyst opens it,
then no `Download CSV` control is present.
```

**AC-003 is the one that earns its place.** G6 requires that negative and empty-state
criteria are covered, not only the happy path — and it is the criterion this change is about
to fail on.

And `tasks.md`:

```markdown
# Tasks — add-csv-export

- [ ] **TASK-001** Add the CSV serialiser.
  - Implements: REQ-001
- [ ] **TASK-002** Add the download route and the control, hidden on an empty report.
  - Implements: REQ-001
```

Both task ids are **bold**, and each `Implements:` line sits directly under its task. Neither
is cosmetic: an unbolded task is invisible to the validator, and an `Implements:` line more
than three lines from its marker is prose. See [SDD.md](../SDD.md) §3.

```bash
navi-delivery validate --strict
```

```text
0 finding(s) across 56 file(s)

0 separation finding(s)

0 traceability finding(s)
validate: OK
```

Three checks ran. The first two — the file count and `0 separation finding(s)` — lint the
**framework's own** agents and skills, not your repo; they report the same file count
whichever repo you run them in. Only the third, traceability, is about your change.

`--strict` adds T4: *is any task actually building this requirement?* Run it before G5. A
requirement with no task is scope that was specified and then quietly dropped.

### Record G1 and G2

Evidence first, verdict second. `--evidence` must name a path that exists.

```bash
E=delivery/changes/add-csv-export/evidence
navi-delivery gate G1 --pass --evidence $E/g1-intent.md
navi-delivery gate G2 --pass --evidence $E/g2-spec.md
```

```text
G1 pass (evidence: delivery/changes/add-csv-export/evidence/g1-intent.md)
G2 pass (evidence: delivery/changes/add-csv-export/evidence/g2-spec.md)
```

The check is **existence, not content** — an empty directory is accepted. The gate records
that evidence was cited. Make it a citation a human can follow.

---

## Phase 3 — Architect

The Architect and the Security Engineer co-own G3. `design.md` was written by `propose` with
one heading per G3 exit criterion; fill each in place.

For a change this size most of it is short, and two sections are not:

- **Decisions.** `ADR-001` records choosing streaming serialisation over building the whole
  file in memory, and what that binds. A choice with no rival option is not an ADR — state
  that constraint under Approach instead.
- **Threat model.** What this change newly lets someone see or do. A CSV export of an
  on-screen report is a reach change even when it adds no data: it turns "visible to someone
  at a screen" into "a file that leaves the building". Every threat ends as designed out,
  mitigated, or accepted by a named person.

```bash
navi-delivery gate G3 --pass --evidence $E/g3-design.md
```

```text
G3 pass (evidence: delivery/changes/add-csv-export/evidence/g3-design.md)
```

---

## Phase 4 — Data & Model: skipped

G4 is not in the `standard` lane's set. It is **skipped, not waived**, and nothing is
recorded. `navi-delivery gate G4 --pass --evidence ...` would return:

```text
G4 is not in lane 'standard' — this lane enforces: G1, G2, G3, G5, G6, G7, G8
```

This is the G4 gap described in [ADLC.md](../ADLC.md) §3. If this change had turned out to
touch a dataset, it could not have recorded G4 at all, and the correct response would have
been to close it out and re-propose on `full` — not to press on.

---

## Phase 5 — Build

Write the code. Every acceptance criterion gets at least one automated test that references
it. Check off each task in `tasks.md`.

```bash
navi-delivery gate G5 --pass --evidence $E/g5-build.md
```

```text
G5 pass (evidence: delivery/changes/add-csv-export/evidence/g5-build.md)
```

---

## Phase 6 — Verify, and this is where it goes wrong

The QA Engineer and the Security Engineer co-own G6. The suite is run and AC-003 fails: the
`Download CSV` control still renders on an empty report. The happy path works; the empty
state does not.

```bash
navi-delivery gate G6 --fail --evidence $E/g6-failures.md
```

```text
G6 fail (evidence: delivery/changes/add-csv-export/evidence/g6-failures.md)
rework required — 3 artifact(s) marked stale
```

```bash
navi-delivery status
```

```text
change: add-csv-export
lane:   standard

  G1  pass
  G2  pass
  G3  pass
  G5  pass
  G6  fail
  G7  pending
  G8  pending

stale artifacts (3) — rework required before validate passes:
  gate:G6
  gate:G7
  gate:G8
```

**Read what just happened.** G6 failed, and G6 *and every later gate in this lane* went
stale. Not G1–G5: those were decided on evidence that is still good. G7 and G8 went stale
because a release decision made on top of a failed verification is a decision about a
different change.

Only gates this lane enforces are marked. G4 and G9 are untouched — marking them would
create stale entries that this lane could never clear.

And `validate` now refuses:

```bash
navi-delivery validate
```

```text
3 stale artifact(s) — resolve rework before validating
...
validate: FAILED
```

Rework cannot be walked past. That is the entire mechanism.

### Fix it, and re-record

Fix the defect, re-run the suite, produce fresh evidence, and record the gate again.

```bash
navi-delivery gate G6 --pass --evidence $E/g6-tests.md
```

```text
G6 re-recorded: fail -> pass (evidence: delivery/changes/add-csv-export/evidence/g6-tests.md)
```

`re-recorded: fail -> pass`. The event log appends a new record carrying `previous: "fail"`;
it does not overwrite the old one. The history of this change will always say that G6 failed
once and why.

**Re-recording G6 cleared `gate:G6` and nothing else.** G7 and G8 are still stale, and each
must be recorded on its own. A passing G6 does not vouch for a release.

---

## Phase 7 — Release

```bash
navi-delivery gate G7 --pass --evidence $E/g7-release.md
```

```text
G7 pass (evidence: delivery/changes/add-csv-export/evidence/g7-release.md)
```

The evidence names the pipeline run, the rehearsed rollback and its 90-second
time-to-restore, and the blast radius in people: all report users. "Blast radius" as a
number of people rather than a number of services is deliberate — it is the form in which a
release decision is actually made.

---

## Phase 8 — Operate, and a waiver

G8 wants an `SLI-###` in `delivery/ops/slo.md` for the shipped capability, with an objective,
an error budget, and an alert. The export-volume indicator depends on a reporting dashboard
that lands with the next platform release. The gate cannot be met, and it is in the lane, so
it is **waived** — not passed, and not ignored.

```bash
navi-delivery gate G8 \
  --waive "Export volume SLI lands with the reporting dashboard in the next platform release" \
  --expires 2026-12-31
```

```text
G8 waived until 2026-12-31
```

The expiry is the entire control on a waiver, so the CLI checks it properly. Each of these
is refused, and nothing is written:

```text
--expires '2020-01-01' must be strictly in the future
--expires '2026-02-30' is not a real calendar date
--expires must be a calendar date in YYYY-MM-DD form, got 'soon'
a waiver requires --expires <YYYY-MM-DD>
```

A row lands in `delivery/.adlc/waivers.md`:

```text
| Date | Change | Gate | Reason | Expires | Approved by |
|------|--------|------|--------|---------|-------------|
| 2026-09-30 | add-csv-export | G8 | Export volume SLI lands with the reporting dashboard in the next platform release | 2026-12-31 | |
```

**A waiver covers the whole gate.** G8 checks several things — an SLI, a runbook, telemetry
confirmed arriving — and this one reason waives all of them. Write the reason so the next
reader can tell which criterion was actually in question.

---

## Phase 9 — Learn, and archive

```bash
navi-delivery status
```

```text
  G1  pass
  G2  pass
  G3  pass
  G5  pass
  G6  pass
  G7  pass
  G8  waived
```

Every gate in the lane is settled and nothing is stale, so `archive` will proceed. It refuses
otherwise, naming what is outstanding.

```bash
navi-delivery archive add-csv-export
```

```text
Archived to delivery/changes/archive/2026-09-30-add-csv-export
Insights: delivery/ops/postmortems/add-csv-export.md — route each to the backlog or a skill amendment
```

Three things happened:

1. The delta spec was folded into `delivery/specs/reporting/spec.md`. That file is now the
   current truth about what the system does.
2. The change moved to `delivery/changes/archive/2026-09-30-add-csv-export/`, intact —
   proposal, design, tasks, handoffs, and its own delta spec.
3. An insight stub was written to `delivery/ops/postmortems/add-csv-export.md`.

Fill the stub in. Every insight names **exactly one** destination:

```markdown
- **INSIGHT-001** The empty-state criterion was written but not built, and only the test
  caught it. Every criterion that describes an absence is at risk of this.
  - Destination: skill amendment
  - Target: navi-skill-test-design — require an explicit check that negative and
    empty-state criteria have a test before G5 is recorded, not at G6.
```

That is the loop closing. This change failed G6 on an empty-state criterion; the insight
routes to the skill that governs test design, so the next team loads a standard that
already knows about it. The alternative destination is the product backlog, as a candidate
`REQ-###` for a future change.

---

## The event log

Everything above is in `delivery/.adlc/events.jsonl`, append-only:

```json
{"ts":"...","change":"add-csv-export","gate":"G1","verdict":"pass","evidence":".../g1-intent.md"}
{"ts":"...","change":"add-csv-export","gate":"G2","verdict":"pass","evidence":".../g2-spec.md"}
{"ts":"...","change":"add-csv-export","gate":"G3","verdict":"pass","evidence":".../g3-design.md"}
{"ts":"...","change":"add-csv-export","gate":"G5","verdict":"pass","evidence":".../g5-build.md"}
{"ts":"...","change":"add-csv-export","gate":"G6","verdict":"fail","evidence":".../g6-failures.md"}
{"ts":"...","change":"add-csv-export","gate":"G6","verdict":"pass","evidence":".../g6-tests.md","previous":"fail"}
{"ts":"...","change":"add-csv-export","gate":"G7","verdict":"pass","evidence":".../g7-release.md"}
{"ts":"...","change":"add-csv-export","gate":"G8","verdict":"waived","reason":"Export volume SLI lands ...","expires":"2026-12-31"}
{"ts":"...","change":"add-csv-export","gate":"G9","verdict":"archived"}
```

The G6 failure is still there, with its evidence path, next to the pass that carries
`previous: "fail"`. Six months on, that pair is the answer to "why does the export hide
itself on an empty report".

`archive` writes a final `G9 archived` event even on `standard`, where G9 is not in the
enforced set. It marks the close-out, not a gate verdict.

---

## Two things this transcript shows that are worth knowing

**`status` shows no phase.** `state.phase` is in `state.json`, set to 1 at `propose` and at
`archive` and moved by nothing, so a phase line could only ever read `1`. The gate verdicts
above are the progress signal, and they are what `status` prints.

**Gate events record no actor.** G3 and G6 are each co-owned by two agents, and the log
cannot say which of them recorded the verdict. Where that matters — a release approval, an
accepted threat — name the person inside the evidence file, which is where the gates
reference already asks for it.

---

## What to read next

- [ADLC.md](../ADLC.md) — the gates in full, with entry and exit criteria
- [SDD.md](../SDD.md) — exactly what the traceability validator sees, and what it silently does not
- [CONCEPTS.md](CONCEPTS.md) — why agents and skills are separate files
- [CLI.md](CLI.md) — every verb, flag and failure message
