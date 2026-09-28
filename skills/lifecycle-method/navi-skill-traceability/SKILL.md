---
name: navi-skill-traceability
description: >
  Use when creating or reviewing any artifact that must link to an upstream one — a
  requirement, criterion, decision, task, test, SLI or insight. Defines the ID chain, the
  numbering rules, the `Implements:` convention, and the orphan classes T0 through T4 that
  the validator reports.
  Trigger phrases include: traceability, Implements, REQ-, AC-, TASK-, ADR-, SLI-, INSIGHT-,
  orphan, orphaned requirement, T1, T2, T3, T4, validate --strict, ID chain.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: lifecycle-method
  lifecycle_phases: [2, 3, 5, 6, 8, 9]
  used_by_agents: [navi-agent-orchestrator, navi-agent-business-analyst, navi-agent-architect, navi-agent-fullstack-developer, navi-agent-data-engineer, navi-agent-machine-learning-engineer, navi-agent-qa-engineer]
  owner: OWNER_TBD
  tags: "adlc, traceability, requirements, validation"
  model: sonnet
---

## When to use

An artifact with an ID is being written or reviewed, or `validate` is reporting an orphan.

## Rules

1. The chain is `REQ → AC → ADR → TASK → TEST → SLI → INSIGHT`. Every artifact after the
   first declares the upstream ID it descends from.
2. Number every ID with at least three digits: `REQ-001`, `AC-014`, `TASK-207`. The validator
   matches `\d{3,}` and ignores anything shorter.
3. Numbering is sequential within its own scope and never reused. A deleted `REQ-004` leaves a
   permanent gap; the next requirement is `REQ-005`.
4. Write every `REQ-###` on a Markdown heading line inside a `spec.md`. The validator only
   recognises a requirement when the line it appears on starts with `#`.
5. Place every `AC-###` after its requirement's heading and before the next requirement
   heading. Position is what binds a criterion to a requirement; there is no explicit link.
6. Bind every task with an `Implements: REQ-###` line within three lines of the
   `**TASK-###**` marker. Outside that window the validator does not see it.
7. Write the task marker in bold — `**TASK-001**`. An unbolded task id is invisible to the
   validator and its `Implements:` line is never checked.
8. Never invent an upstream ID. An `Implements:` line naming a requirement that no `spec.md`
   heading declares is rule T3, and T3 is always a defect in one of the two files.
9. Fold a change's delta spec into `delivery/specs/` at archive. Until then a requirement that
   exists only in `changes/<name>/specs/` is invisible to the validator — see Validation.
10. Every shipped capability has an `SLI-###` in `delivery/ops/slo.md` naming the `REQ-###` it
    measures. A capability that is live and unmeasured is untraceable to its outcome.
11. Every `INSIGHT-###` names its destination — product backlog or skill amendment — and the
    target. An insight with no destination closes no loop.
12. Fix an orphan by adding the missing link or deleting the orphaned artifact. Never silence
    a finding by renaming an ID to one that happens to exist.

## Decision table

| Validator output | What it means | Required action |
|---|---|---|
| `T0 ... file is not readable` | The file is not valid UTF-8, or the path is broken | Repair or remove the file; a validator that cannot read it has not checked it |
| `T1 TASK-### has no 'Implements: REQ-###' line` | The task is not bolded, or the line is more than three lines below the marker | Move the `Implements:` line directly under the task, and bold the task id |
| `T2 REQ-### has no acceptance criteria` | No `AC-###` appears between this requirement's heading and the next | Write at least one criterion per `navi-skill-acceptance-criteria` |
| `T3 TASK-### implements unknown REQ-###` | No `spec.md` heading in `delivery/specs/` declares that requirement | Fix the typo, or fold the delta spec, or write the requirement |
| `T4 REQ-### is implemented by no task` (strict only) | A requirement nothing is building | Add a task, or move the requirement to a later change |
| A requirement heading with no `#` | Invisible to the validator; it silently is not a requirement | Put the id on a heading line |
| An `AC-###` under the wrong requirement heading | Credits the wrong requirement; T2 stays clean while the real one is uncovered | Move the criterion under its own requirement |
| An ID numbered `REQ-4` | Not matched by the validator at all | Renumber to `REQ-004` |

## Template

A spec that traces cleanly:

```markdown
# Capability — Theme preference

### REQ-001 — Theme preference persists across sessions
**Priority:** Must

A signed-in user's chosen theme is reapplied on every subsequent page load.

#### AC-001
Given a signed-in user with a saved theme preference,
when they load any page,
then the saved theme is applied before first paint.
Implements: REQ-001

### REQ-002 — Theme falls back to the system scheme
**Priority:** Should

#### AC-002
Given a signed-in user with no saved preference,
when they load any page,
then the operating-system colour scheme is applied.
Implements: REQ-002
```

The tasks that implement it:

```markdown
# Tasks — theme-persistence

- [ ] **TASK-001** Persist the theme preference on change
  - Implements: REQ-001
  - Verified by: AC-001

- [ ] **TASK-002** Read the system colour scheme when no preference exists
  - Implements: REQ-002
  - Verified by: AC-002
```

Closing the chain in `delivery/ops/slo.md` and the postmortem:

```markdown
### SLI-001 — Theme applied before first paint
Measures: REQ-001
Objective: 99.5% of page loads over a rolling 28-day window.

### INSIGHT-001 — Preference reads were not cached
Destination: skill amendment
Target: navi-skill-pipeline-design — add a rule on read-path caching for per-user settings
```

## Checklist

- [ ] Every `REQ-###` sits on a heading line inside a `spec.md`
- [ ] Every requirement has at least one criterion under its own heading
- [ ] Every `**TASK-###**` is bold and carries `Implements:` within three lines
- [ ] Every `Implements:` names a requirement that actually exists
- [ ] Every ID is at least three digits and unique within its scope
- [ ] No ID has been reused after a deletion
- [ ] Every shipped capability has an `SLI-###` naming its requirement
- [ ] Every `INSIGHT-###` names a destination and a target
- [ ] `validate_traceability.py` reports zero findings

## Anti-patterns

**Unbolded task.** `- [ ] TASK-001 Persist the preference` — the validator matches
`\*\*(TASK-\d{3,})\*\*`, so this task is invisible and its missing `Implements:` line is never
reported. Write `- [ ] **TASK-001** Persist the preference`.

**`Implements:` too far from the task.** A task with three sub-bullets of detail and then the
`Implements:` line fires T1, because only the marker line plus the next three are read. Put
`Implements:` first among the sub-bullets.

**Requirement in a paragraph.** `The system must do X (REQ-003).` in body text. The validator
only registers a requirement when the id is on a line starting with `#`. Promote it to a
heading.

**Criterion under the wrong requirement.** `AC-014` written under `REQ-002` but implementing
`REQ-007`. T2 reports `REQ-007` as uncovered while `REQ-002` gets credit it did not earn. The
`Implements:` line on the criterion does not override position — move the criterion.

**Renaming to silence T3.** `TASK-009 implements unknown REQ-011` fixed by changing it to
`REQ-001`, which exists. The task now claims to implement a requirement it does not. Either
write `REQ-011`, or correct the task to the requirement it truly serves.

**Reused number.** `REQ-004` deleted in one change and a different requirement numbered
`REQ-004` in the next. Every downstream artifact, test name and event log entry referring to
the old `REQ-004` now points at something else. Gaps are free; collisions are not.

**Insight with no destination.** `INSIGHT-002 — retries made the outage worse.` True, and it
changes nothing. Route it: a backlog candidate, or a named `navi-skill-*` to amend.

## Validation

```bash
python3 scripts/validate_traceability.py delivery/
python3 scripts/validate_traceability.py delivery/ --strict   # adds T4
navi-delivery validate --strict                                # runs all three validators
```

Zero findings is the only passing result. `--strict` adds T4 and is what runs before archive.

**Known limitation — in-flight requirements.** `validate_traceability.py` reads requirements
only from `delivery/specs/**/spec.md`. A requirement that exists only in the change's delta
spec at `delivery/changes/<name>/specs/<capability>/spec.md` is not seen, so a task
implementing it reports T3 until `archive` folds the delta into `delivery/specs/`. While a
change is in flight, verify the delta spec directly:

```bash
grep -rnE '^#+.*REQ-[0-9]{3,}' --include=spec.md delivery/changes/<name>/specs
grep -n 'Implements:' delivery/changes/<name>/tasks.md
```

Every `Implements:` target must appear in one of the two greps. Treat a T3 finding as real
unless both the delta spec and `delivery/specs/` have been checked by hand.
