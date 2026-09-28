---
name: navi-skill-acceptance-criteria
description: >
  Use when writing or reviewing acceptance criteria for a requirement. Defines the
  Given/When/Then form, the objective-testability rules, and AC-### numbering.
  Trigger phrases include: acceptance criteria, AC, given when then, testable requirement,
  definition of done for a requirement.
allowed-tools: Read Write Edit Grep
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: spec-driven-development
  lifecycle_phases: [2, 6]
  used_by_agents: [navi-agent-business-analyst, navi-agent-qa-engineer, navi-agent-product-owner]
  owner: OWNER_TBD
  tags: "sdd, requirements, quality"
  model: sonnet
---

## When to use

A requirement exists and needs criteria, or criteria exist and need review.

## Rules

1. One criterion per behaviour. Never bundle two behaviours into one AC.
2. Write every criterion as `Given <state>, when <action>, then <observable outcome>`.
3. Number criteria `AC-###`, sequential within the capability, never reused after deletion.
4. Every criterion names an observable outcome. Reject adjectives without a threshold.
5. Each criterion states its requirement in an `Implements: REQ-###` line.
6. A criterion that cannot be observed by a test or an instrument is not a criterion — record it as an open question instead.
7. Write every `AC-###` under the heading of the `REQ-###` it implements, in the same `spec.md`. Rule T2 reads the file positionally: an AC placed under a different requirement's heading counts for that requirement, not for this one.
8. Every requirement carries at least one criterion before G2-SPEC is recorded as pass.
9. Name the negative path. Every criterion set covers at least one failure, rejection or empty-state case alongside the happy path.
10. State the measurement instrument for any threshold — the percentile, the window, and the environment. A threshold with no instrument is not observable.

## Decision table

| Phrase in the requirement | Required action |
|---|---|
| "fast", "responsive", "quick" | Replace with a latency threshold and a percentile |
| "secure" | Replace with the specific threat and its mitigation |
| "user-friendly", "polished", "intuitive" | Not testable — raise as an open question |
| "most", "usually", "typically" | Replace with a percentage and a measurement window |
| "and" joining two outcomes in one `then` | Split into two criteria with consecutive numbers |
| "should", "may", "ideally" | Decide: either a criterion with a threshold, or delete it |
| "handles errors gracefully" | Name each error class and its observable response |
| a criterion with no `Implements:` line | Add one, or delete the criterion as orphaned |

## Template

```markdown
### REQ-001 — Theme preference persists across sessions

#### AC-001
Given a signed-in user with a saved theme preference,
when they load any page,
then the saved theme is applied before first paint.
Implements: REQ-001

#### AC-002
Given a signed-in user with no saved theme preference,
when they load any page,
then the operating-system colour scheme is applied and no preference is written.
Implements: REQ-001

#### AC-003
Given the preference store is unreachable,
when a signed-in user loads any page,
then the light theme is applied and one warning is logged with the user id omitted.
Implements: REQ-001
```

## Checklist

- [ ] Every criterion uses Given/When/Then
- [ ] Every criterion carries an `Implements:` line
- [ ] No adjective appears without a threshold
- [ ] Numbering is sequential with no reuse
- [ ] Untestable statements moved to open questions
- [ ] Every criterion sits under the heading of the requirement it implements
- [ ] At least one negative or empty-state criterion exists per requirement
- [ ] Every threshold names its percentile, window and environment

## Anti-patterns

**Bundled behaviours.** `then the theme applies and the preference syncs across devices` — two outcomes, two tests, two criteria. Split them into `AC-001` (theme applies) and `AC-002` (preference syncs).

**Unmeasurable adjective.** `then the page loads quickly` — replace with `then the page reaches interactive within 1.5s at p95 on a 4G profile`.

**Restating the requirement.** `Given the feature, when used, then it works` — carries no information. Name the state, the action and the observable: `Given a cart with three items, when checkout is submitted, then one order record is written with three line items`.

**Orphaned criterion.** An `AC-###` with no `Implements:` line, or sitting under no requirement heading. Traceability cannot bind it and rule T2 will not credit it. Move it under its requirement and add the line.

**Happy path only.** `AC-001` covers the signed-in user with a saved preference and nothing else. Add the empty-state case and the store-unavailable case before recording G2.

**Threshold with no instrument.** `then the p95 is under 200ms` — under what load, measured where, over what window? Write `then p95 server response time is under 200ms measured at the load balancer over a 5-minute window at 200 rps`.

## Validation

Run `python3 scripts/validate_traceability.py delivery/` — every `REQ-###` must
report at least one `AC-###`, and rule T2 must be clean.

Grep for adjectives that carry no threshold before recording G2-SPEC:

```bash
grep -rnE '\b(fast|quick|responsive|intuitive|polished|user-friendly|secure|graceful(ly)?)\b' \
  --include=spec.md delivery/specs delivery/changes
```

Every hit must either carry a number on the same criterion or be moved to open questions.
