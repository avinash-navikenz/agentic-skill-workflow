---
name: navi-skill-task-decomposition
description: >
  Use when breaking a specification into the tasks that implement it, or reviewing `tasks.md`
  before G5-BUILD. Defines `TASK-###` numbering and sizing, the vertical-slice rule,
  dependency ordering, and the `Implements:` binding the traceability validator reads.
  Trigger phrases include: task breakdown, decompose, tasks.md, TASK-, break this down,
  vertical slice, task sizing, dependency order, work breakdown, what are the tasks.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: spec-driven-development
  lifecycle_phases: [5]
  used_by_agents: [navi-agent-fullstack-developer, navi-agent-data-engineer, navi-agent-machine-learning-engineer, navi-agent-orchestrator, navi-agent-architect]
  owner: avinash.negi@navikenz.com
  tags: "sdd, tasks, planning, delivery"
  model: sonnet
---

## When to use

A specification has passed G2 (and G3 where the lane enforces it) and needs the task list that
implements it, or `tasks.md` is under review before G5-BUILD.

## Rules

1. Write tasks into `delivery/changes/<name>/tasks.md`, the file `propose` scaffolds. There is
   one task list per change.
2. Write every task marker in bold: `- [ ] **TASK-001** <description>`. The validator matches
   `\*\*(TASK-\d{3,})\*\*`; an unbolded id is invisible and its missing links are never
   reported.
3. Put `Implements: REQ-###` as the first sub-bullet, directly under the task line. The
   validator reads only the marker line plus the next three; further down it is not seen and
   the task reports T1.
4. Bind every task to exactly one requirement. A task serving two requirements is two tasks,
   or one task whose second requirement is not really implemented by it.
5. Number tasks `TASK-###`, at least three digits, sequential within the change, never reused.
6. Size every task so one person completes it inside a working day. A task that cannot be
   described as finishable in a day is not yet decomposed.
7. Make every task a vertical slice: each one leaves the system working and moves at least one
   acceptance criterion from failing to passing. Never slice by layer.
8. Name the acceptance criterion each task satisfies in a `Verified by: AC-###` sub-bullet.
   A task satisfying no criterion is either unnecessary or is implementing an unwritten
   requirement.
9. State a task's prerequisites in a `Depends on: TASK-###` sub-bullet. List tasks in an order
   where every dependency precedes its dependant.
10. Keep the dependency graph acyclic. Two tasks that depend on each other are one task that
    was split in the wrong place.
11. Write every task as a verb phrase naming an outcome: `Persist the theme preference on
    change`. Never a noun phrase, never a file name, never "investigate" or "look into".
12. Carve out a separate task for anything genuinely uncertain, and name what it produces —
    a decision, a measurement, or a discarded branch. Time-box it in the description.
13. Check a task off only when its criterion passes. A task checked off with a red test is a
    false record that G5 will be recorded against.
14. Never introduce a requirement in `tasks.md`. Work the spec does not cover means the spec
    is incomplete — amend the spec, re-record G2 if it was already recorded, then add the task.

## Decision table

| Observed in the draft | Required action |
|---|---|
| A task named after a layer ("add the API endpoint") | Re-slice vertically; one task that makes a criterion pass end to end |
| A task larger than a day | Split it along the criteria it satisfies |
| A task with no `Implements:` line | Add it as the first sub-bullet, or delete the task |
| `Implements:` more than three lines below the marker | Move it up; the validator will not see it |
| An unbolded task id | Bold it, or the validator ignores the task entirely |
| A task implementing two requirements | Split into one task per requirement |
| A task satisfying no acceptance criterion | Either the criterion is missing or the task is |
| Two tasks depending on each other | Merge them, or move the shared piece into a third task that precedes both |
| A task named "investigate X" | Name the artifact it produces and time-box it |
| A task whose requirement is not in the spec | Stop — amend the spec first, then add the task |
| More than half the tasks name the same single `Depends on:` task | A layer slice wearing a dependency — that one task is the whole vertical and the rest are its layers. Re-slice so each task carries its own end-to-end path |
| A task checked off with a failing test | Uncheck it; G5 reads this file |

## Template

```markdown
# Tasks — theme-persistence

Each task names the requirement it implements. A task with no `Implements:`
line fails traceability.

- [ ] **TASK-001** Persist the theme preference when a signed-in user changes it
  - Implements: REQ-001
  - Verified by: AC-001
  - Depends on: none
  - Notes: additive column with a default; no backfill needed.

- [ ] **TASK-002** Apply the saved preference before first paint
  - Implements: REQ-001
  - Verified by: AC-001
  - Depends on: TASK-001

- [ ] **TASK-003** Fall back to the operating-system colour scheme when no preference exists
  - Implements: REQ-002
  - Verified by: AC-002
  - Depends on: TASK-002

- [ ] **TASK-004** Degrade to the light theme when the preference store is unreachable
  - Implements: REQ-003
  - Verified by: AC-003
  - Depends on: TASK-002

- [ ] **TASK-005** Measure the added time to first paint and record it against the NFR
  - Implements: REQ-001
  - Verified by: AC-001
  - Depends on: TASK-002
  - Notes: time-boxed to half a day; produces the p95 measurement the performance NFR asserts.
```

Checking the list mechanically before recording G5:

```bash
python3 scripts/validate_traceability.py delivery/   # T1 and T3 must be clean
```

## Checklist

- [ ] Every task marker is bold, `**TASK-###**`, three digits, sequential, never reused
- [ ] Every task has `Implements: REQ-###` as its first sub-bullet
- [ ] Every `Implements:` names a requirement that exists in the spec
- [ ] Every task binds to exactly one requirement
- [ ] Every task names the `AC-###` it makes pass
- [ ] Every task is a vertical slice that leaves the system working
- [ ] Every task is finishable by one person in a day
- [ ] Dependencies are stated and the list is in dependency order
- [ ] The dependency graph is acyclic
- [ ] Every task is a verb phrase naming an outcome
- [ ] No task introduces work the spec does not cover
- [ ] Nothing is checked off whose criterion is still failing
- [ ] `validate_traceability.py` reports no T1 or T3 findings

## Anti-patterns

**Horizontal slice.** `TASK-001 Add the database column`, `TASK-002 Add the API endpoint`,
`TASK-003 Wire up the UI`. Nothing works until all three land, no criterion passes in
between, and a stop halfway leaves the system half-built. Re-slice: `TASK-001 Persist the
theme preference when a signed-in user changes it` crosses all three layers and makes AC-001
pass.

**Unbolded task.** `- [ ] TASK-001 Persist the preference`. The validator matches only bold
ids, so this task is invisible — including its missing `Implements:` line. Write
`- [ ] **TASK-001** Persist the preference`.

**Buried `Implements:`.** A task with a paragraph of notes and then `Implements: REQ-001` six
lines down. Only the marker line and the next three are read, so it reports T1 despite being
present. Put it first.

**Task larger than a day.** `TASK-002 Build the preferences system.` Nobody can say whether it
is half done. Split it along the criteria: one task per acceptance criterion it moves to
passing.

**Investigation with no output.** `TASK-007 Look into caching.` It can run forever and produce
nothing reviewable. Write `TASK-007 Measure preference read latency with and without a cache
and record the result in ADR-004 — time-boxed to half a day`.

**Task inventing a requirement.** `TASK-009 Add a per-device override` when the spec records
per-device overrides as a `Won't`. The task will pass review and ship unspecified behaviour.
Amend the spec first, re-record G2 if it was already recorded, then add the task.

**Mutual dependency.** `TASK-004 depends on TASK-005` and `TASK-005 depends on TASK-004`. The
list cannot be executed in any order. The shared piece is a third task both depend on.

**Optimistic checkbox.** Checking off `TASK-003` because the code is written, while AC-002
still fails. G5-BUILD is recorded against this file; a wrong checkbox becomes a wrong gate.

## Validation

```bash
python3 scripts/validate_traceability.py delivery/
navi-delivery validate --strict     # adds T4: every requirement implemented by some task
```

T1, T3 and T4 must all be clean before G5-BUILD is recorded. Count the bindings by hand as a
cross-check, since an unbolded task is silently skipped by the validator:

```bash
grep -c '^- \[[ x]\] \*\*TASK-' delivery/changes/<name>/tasks.md
grep -c 'Implements: REQ-' delivery/changes/<name>/tasks.md
```

The two counts must be equal. A lower `Implements:` count means a task is unbound; a task
count lower than expected means an id is not bolded.

Detect dependency cycles before starting work:

```bash
python3 - <<'PY'
import re, pathlib, sys
text = pathlib.Path("delivery/changes/<name>/tasks.md").read_text()
deps, current = {}, None
for line in text.splitlines():
    m = re.search(r"\*\*(TASK-\d{3,})\*\*", line)
    if m:
        current = m.group(1); deps[current] = []
    elif current and "Depends on:" in line:
        deps[current] = re.findall(r"TASK-\d{3,}", line)
state = {}
def visit(n, stack):
    if state.get(n) == "done": return
    if state.get(n) == "open":
        print("cycle:", " -> ".join(stack + [n])); sys.exit(1)
    state[n] = "open"
    for d in deps.get(n, []): visit(d, stack + [n])
    state[n] = "done"
for n in deps: visit(n, [])
print(f"{len(deps)} task(s), no dependency cycle")
PY
```
