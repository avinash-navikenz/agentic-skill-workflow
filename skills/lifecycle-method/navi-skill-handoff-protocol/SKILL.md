---
name: navi-skill-handoff-protocol
description: >
  Use when one agent passes work to another, consults another, or hands back rework at a
  phase transition. Defines the handoff envelope YAML shape, the required fields, the
  `kind: review` convention for consultations, and the rule that assumptions and open
  questions travel with the work.
  Trigger phrases include: handoff, hand off, handoffs.md, phase transition, pass to the
  architect, consult QA, handoff envelope, assumptions, open questions, confidence, rework
  record, kind review.
allowed-tools: Read Write Edit Grep
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: lifecycle-method
  lifecycle_phases: [1, 2, 3, 4, 5, 6, 7, 8, 9]
  used_by_agents: [navi-agent-orchestrator, navi-agent-product-owner, navi-agent-business-analyst, navi-agent-architect, navi-agent-fullstack-developer, navi-agent-data-engineer, navi-agent-machine-learning-engineer, navi-agent-mlops-engineer, navi-agent-devops-engineer, navi-agent-qa-engineer]
  owner: OWNER_TBD
  tags: "adlc, handoff, collaboration, provenance"
  model: sonnet
---

## When to use

Work is moving between agents — forward at a phase transition, sideways as a consultation, or
backwards as rework after a failed gate.

## Rules

1. Append one envelope to `delivery/changes/<name>/handoffs.md` for every transfer of work.
   A phase transition with no envelope did not happen.
2. Append. Never rewrite or delete an existing envelope. The file is a chronological record.
3. Write every envelope inside a fenced ```yaml block, as a single-element YAML list item
   beginning with `- from:`.
4. Every envelope carries all eight base fields: `from`, `to`, `phase`, `artifacts`,
   `skills_used`, `assumptions`, `open_questions`, `confidence`.
5. Name `from` and `to` with exact `navi-agent-*` identifiers. Never a human name, never a
   team name, never a role in prose.
6. Write `phase` as `<n> → <m>` using the arrow. A consultation that returns to its origin
   writes the same number both sides, as in `5 → 5`.
7. List concrete IDs in `artifacts`, ranges included: `[REQ-001..REQ-014, AC-001..AC-031]`.
   An empty list is only valid when the transfer genuinely produced no identified artifact.
8. List every skill actually loaded in `skills_used`. This is the record that satisfies the
   corollary that an agent may not produce a lifecycle artifact from memory.
9. Write every unverified belief the downstream work will rest on into `assumptions`, as a
   full sentence naming the belief and its status. An assumption not written down becomes an
   incident.
10. Reference open questions by `Q-###` id in `open_questions`, not by restating them. The
    questions themselves live in the spec.
11. Set `confidence` to exactly one of `high`, `medium`, `low`. `low` obliges the receiving
    agent to verify before building on the handoff.
12. Mark a consultation with `kind: review`. Mark a return after a failed gate with
    `kind: rework`, plus `gate` and `reason`. Omit `kind` for a normal forward transition.
13. Never hand off past a gate the lane enforces and has not recorded. The gate verdict comes
    first; the envelope records the transition that follows it.

## Decision table

| Situation | `phase` | `kind` | Extra required fields |
|---|---|---|---|
| Normal forward transition, gate passed | `2 → 3` | omitted | none |
| Consulting another persona mid-phase | `2 → 2` | `review` | none |
| Returning work after a failed gate | `6 → 5` | `rework` | `gate`, `reason`, `stale` |
| Blocking on a human checkpoint | `3 → 3` | `review` | `blocked_on`, `escalated_to` |
| Handing off with an unverified number | any | as applicable | the number written into `assumptions` |
| Handing off with an unresolved question | any | as applicable | the `Q-###` in `open_questions` |
| Receiving an envelope with `confidence: low` | — | — | Verify the named assumptions before building |
| Receiving an envelope listing no `skills_used` | — | — | Refuse it; the artifact was produced from memory |
| A transfer with nothing to name in `artifacts` | any | as applicable | `artifacts: []` and a reason in `assumptions` |

## Template

A forward transition:

```yaml
- from: navi-agent-business-analyst
  to: navi-agent-architect
  phase: 2 → 3
  artifacts: [REQ-001..REQ-014, AC-001..AC-031]
  skills_used: [navi-skill-spec-authoring, navi-skill-acceptance-criteria, navi-skill-traceability]
  assumptions: ["Peak load assumed 500 rps — unconfirmed, from the 2026-Q2 capacity note"]
  open_questions: [Q-003, Q-007]
  confidence: medium
```

A consultation, recorded as a review:

```yaml
- from: navi-agent-business-analyst
  to: navi-agent-qa-engineer
  phase: 2 → 2
  kind: review
  artifacts: [AC-001..AC-031]
  skills_used: [navi-skill-acceptance-criteria]
  assumptions: []
  open_questions: [Q-009]
  confidence: high
```

A rework return after a failed gate:

```yaml
- from: navi-agent-qa-engineer
  to: navi-agent-fullstack-developer
  phase: 6 → 5
  kind: rework
  gate: G6
  reason: "AC-011 (empty-state) has no implementation; AC-007 fails at p95"
  stale: [gate:G6, gate:G7, gate:G8]
  artifacts: [AC-007, AC-011]
  skills_used: [navi-skill-phase-gate-protocol, navi-skill-acceptance-criteria]
  assumptions: []
  open_questions: []
  confidence: high
```

A block on a human checkpoint:

```yaml
- from: navi-agent-architect
  to: navi-agent-orchestrator
  phase: 3 → 3
  kind: review
  blocked_on: architecture-sign-off
  escalated_to: "<named human approver>"
  artifacts: [ADR-004, ADR-005]
  skills_used: [navi-skill-human-checkpoints, navi-skill-decision-records]
  assumptions: []
  open_questions: [Q-012]
  confidence: medium
```

## Checklist

- [ ] The envelope is appended, with nothing above it rewritten
- [ ] All eight base fields are present
- [ ] `from` and `to` are exact `navi-agent-*` names
- [ ] `phase` uses the `<n> → <m>` arrow form
- [ ] `artifacts` names concrete IDs, not descriptions
- [ ] `skills_used` lists every skill actually loaded
- [ ] Every unverified belief is written into `assumptions` as a full sentence
- [ ] `open_questions` carries `Q-###` ids, not restated questions
- [ ] `confidence` is exactly `high`, `medium` or `low`
- [ ] A consultation carries `kind: review`; a rework carries `kind: rework`, `gate`, `reason`
- [ ] The gate this transition follows is already recorded

## Anti-patterns

**Prose handoff.** `Handing the spec over to architecture now, looks solid.` No `from`, no
artifact ids, no skills, no assumptions. The receiving agent cannot tell what it received or
what it rests on. Write the envelope.

**Empty assumptions on a guess.** `assumptions: []` on a design sized for 500 rps that nobody
measured. The assumption is load-bearing and unwritten, so it survives to production as a
surprise. Write `"Peak load assumed 500 rps — unconfirmed"`.

**Consultation as a transition.** Recording the QA review of phase-2 criteria as
`phase: 2 → 6`. The change did not advance to Verify; QA was consulted. Write `phase: 2 → 2`
with `kind: review`.

**Human name in `from`.** `from: Priya` — the envelope records which agent produced the work,
so the handoff is replayable in any harness where a persona is a role rather than a subagent.
Write `from: navi-agent-business-analyst` and name the human in `escalated_to` if one was
involved.

**Rewritten history.** Editing yesterday's envelope because the assumption turned out wrong.
The record of what was believed at the time is the point. Append a new envelope correcting it.

**Missing `skills_used`.** An envelope listing artifacts but no skills. Either the artifact
was produced from memory, in which case it needs regenerating under the governing skill, or
the field was skipped, in which case fill it in.

**Overstated confidence.** `confidence: high` on a spec with three open questions. Confidence
describes the work, not the mood. Three open questions is `medium` at best.

## Validation

`handoffs.md` is a Markdown file with fenced YAML blocks. Confirm every block parses and every
envelope carries the base fields:

```bash
python3 - <<'PY'
import re, sys, yaml, pathlib
REQUIRED = {"from","to","phase","artifacts","skills_used","assumptions","open_questions","confidence"}
bad = 0
for p in pathlib.Path("delivery/changes").glob("*/handoffs.md"):
    for block in re.findall(r"```yaml\n(.*?)```", p.read_text(), re.S):
        for env in yaml.safe_load(block) or []:
            missing = REQUIRED - set(env)
            if missing:
                print(f"{p}: envelope {env.get('from','?')} -> {env.get('to','?')} missing {sorted(missing)}")
                bad = 1
print("handoff envelopes OK" if not bad else "handoff envelopes INCOMPLETE")
sys.exit(bad)
PY
```

Cross-check the agent names against the shipped roster — every `from` and `to` must resolve:

```bash
grep -hoE 'navi-agent-[a-z-]+' delivery/changes/*/handoffs.md | sort -u
ls agents/
```
