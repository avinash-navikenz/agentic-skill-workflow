# SDD — Spec-Driven Development in navi-delivery

The spec is the source of truth. Code is its consequence.

A code change that outruns its spec is a defect, not a shortcut — and the framework is
built so that this is a mechanical fact rather than a slogan. `navi-delivery validate`
fails on an orphan: a task nothing required, a requirement nothing tests, a capability
running with no telemetry.

---

## 1. The ID chain

```
REQ  →  AC  →  ADR  →  TASK  →  TEST  →  SLI  →  INSIGHT
```

| ID | Artifact | Lives in | Declares upstream |
|---|---|---|---|
| `REQ-###` | A requirement | `specs/<capability>/spec.md`, on a heading line | — (the root of the chain) |
| `AC-###` | An acceptance criterion | under its requirement's heading | by **position**, not by an explicit link |
| `ADR-###` | An architectural decision | `decisions/ADR-###.md`, listed in `design.md` | the `REQ-###` it serves |
| `TASK-###` | A unit of build work | `changes/<name>/tasks.md` | `Implements: REQ-###` |
| `TEST` | An automated test | your own test suite | the `AC-###` it exercises, by reference |
| `SLI-###` | A service level indicator | `ops/slo.md` | the `REQ-###` it measures |
| `INSIGHT-###` | Something learned | `ops/postmortems/<name>.md` | its destination and target |

Every artifact after the first declares the upstream ID it descends from. The chain runs
in one direction only: an insight can propose a new requirement, but it does so by becoming
a candidate `REQ-###` in a new change, never by editing backwards into a closed one.

---

## 2. Numbering

**Three digits minimum.** `REQ-001`, `AC-014`, `TASK-207`. The validator matches `\d{3,}`
and does not see `REQ-4` at all — it is silently not a requirement. This is the single most
common way a spec passes validation while meaning nothing.

**Sequential within its own scope, and never reused.** A deleted `REQ-004` leaves a
permanent gap; the next requirement written is `REQ-005`. Reusing a retired number makes
every historical reference to it ambiguous, and the archive keeps those references forever.

**Scope is the capability, not the change.** `REQ-###` numbering continues across changes
within `specs/<capability>/`, so two changes in flight against the same capability must not
both claim `REQ-012`.

---

## 3. What the validator actually sees

`scripts/validate_traceability.py` is deliberately literal. Knowing exactly what it
recognises is the difference between a spec that traces and one that only looks like it.

| Rule | It recognises | It does **not** recognise |
|---|---|---|
| A requirement | `REQ-###` on a line that starts with `#` | `REQ-###` in a paragraph, a table cell, or a bullet |
| A criterion | `AC-###` anywhere between its requirement's heading and the next requirement heading | an `AC-###` placed after the next heading — it credits the wrong requirement |
| A task | `**TASK-###**` in bold | `TASK-###` unbolded — invisible, and its `Implements:` line is never checked |
| A task's requirement | `Implements: REQ-###` **within three lines** of the task marker | the same line placed further down |

The spec files it scans are both `delivery/specs/**/spec.md` and
`delivery/changes/*/specs/**/spec.md`. A requirement is therefore traceable from the moment
it is written in the change's delta spec, and stays traceable when `archive` folds that
delta into `delivery/specs/`.

### The findings

| Finding | Meaning | Fix |
|---|---|---|
| `T0` | The file is not readable — not valid UTF-8, or a broken path | Repair or remove it. A validator that cannot read a file has not checked it |
| `T1` | `TASK-###` has no `Implements:` line | Bold the task id, and move the `Implements:` line directly under it |
| `T2` | `REQ-###` has no acceptance criteria | Write at least one, per `navi-skill-acceptance-criteria` |
| `T3` | `TASK-###` implements an unknown `REQ-###` | Always a defect in one of two files: the task names the wrong id, or the requirement was never written |
| `T4` | `REQ-###` is implemented by no task — **`--strict` only** | Add a task, or move the requirement to a later change |

Never silence a finding by renaming an ID to one that happens to exist. Fix the missing
link, or delete the orphan.

### `--strict`

Plain `validate` runs T0–T3. `validate --strict` adds T4, which asks the harder question:
is anything actually building this requirement? Run strict before G5. A requirement with no
task is scope that was specified and then quietly dropped.

---

## 4. The `Implements:` convention

One line, directly under the task, naming exactly one requirement:

```markdown
- [ ] **TASK-001** Add the CSV serialiser and the download route.
  - Implements: REQ-001
```

- **The task id is bold.** `**TASK-001**`. Without the bold, the validator never sees the
  task, never checks its `Implements:` line, and reports nothing — a false clean.
- **The line is within three lines of the marker.** Outside that window it is prose.
- **One requirement per task.** A task serving two requirements is two tasks, or the
  requirements are one requirement.
- **Never invent an upstream ID.** A `T3` is not a formatting problem; it means either the
  task points at nothing or the requirement was never written down.

The same convention extends by hand where the validator does not reach: an `ADR-###` names
the `REQ-###` it serves, a test names the `AC-###` it exercises, an `SLI-###` names the
`REQ-###` it measures, an `INSIGHT-###` names its destination and target.

---

## 5. A spec that traces cleanly

```markdown
# Capability — Reporting

### REQ-001 — Export a report as CSV
**Priority:** Must

An analyst can download the current report as a CSV file.

#### AC-001
Given a report with at least one row,
when the analyst opens it,
then a `Download CSV` control is present.

#### AC-002
Given the analyst activates `Download CSV`,
when the file is opened,
then its header row names every visible column, in display order.
```

and the tasks that build it:

```markdown
# Tasks — add-csv-export

- [ ] **TASK-001** Add the CSV serialiser and the download route.
  - Implements: REQ-001
```

`navi-delivery validate --strict` against this reports `0 traceability finding(s)`.

---

## 6. Spec-first ordering

The order is not a preference. It is what makes every gate after G2 mean anything.

1. **Specify, then design.** G3's threat model and interface contracts are drawn against a
   requirement set. Drawing them first means drawing them against a guess.
2. **Design, then decompose.** A `TASK-###` inherits its justification from a `REQ-###`. A
   task written before the requirement has nothing to inherit, and shows up as `T3`.
3. **Decompose, then build.** G5 asks whether every task is done and every criterion has a
   test. Code with no task cannot answer either question.
4. **Build, then verify.** G6 tests acceptance criteria. Criteria written after the tests
   describe the tests, which verifies nothing.
5. **Ship, then measure.** G8 asks for an `SLI-###` naming the `REQ-###` it measures. A
   capability that is live and unmeasured is untraceable to the outcome that justified it.

### When reality outruns the spec

It will. The response is to move the spec, not to let the gap stand.

- A change in flight that needs a requirement it does not have: write it into the change's
  delta spec at `changes/<name>/specs/<capability>/spec.md`. It is traceable immediately.
- A change that has grown past its lane: close it out and re-propose. Lanes are not widened
  in place — see [`ADLC.md`](ADLC.md).
- A gate already recorded whose inputs then changed: re-record it. The event log carries
  the prior verdict as `previous`, so the history stays honest.
- Code that shipped ahead of its spec: this is the defect the framework exists to surface.
  Write the requirement, record it as rework, and let the stale set force the gates from G2
  forward to be re-recorded against what was actually built.

---

## 7. Where the spec lives at each stage

```
delivery/
├── specs/<capability>/spec.md              current truth — what the system does today
└── changes/<name>/
    ├── proposal.md                          why this change, which lane, what it is not
    ├── specs/<capability>/spec.md            the delta — new and changed REQ/AC
    ├── design.md                             ADRs, contracts, quality attributes, threats
    ├── tasks.md                              TASK-### with Implements: REQ-###
    └── handoffs.md                           who handed what to whom, and what they assumed
```

`archive` folds the delta into `specs/` and moves the change to `changes/archive/`. From
that moment `specs/<capability>/spec.md` is the current truth again, and the archived
change is the record of how it got that way.

---

## 8. The skills that own this

| Concern | Skill |
|---|---|
| Writing a requirement | `navi-skill-spec-authoring` |
| Writing a criterion | `navi-skill-acceptance-criteria` |
| Opening a change | `navi-skill-change-proposal` |
| Breaking work into tasks | `navi-skill-task-decomposition` |
| The ID chain itself | `navi-skill-traceability` |
| Recording a decision | `navi-skill-decision-records` |

An agent does not produce any of these from memory. It loads the governing skill, follows
it, and records which skills it used in the handoff envelope.
