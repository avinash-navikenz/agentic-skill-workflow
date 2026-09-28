---
name: navi-skill-lane-selection
description: >
  Use when choosing the lane for a change before proposing it, or when a change in flight
  turns out to be bigger than its lane. Defines the four lanes, the characteristics that
  select each, the gate set each enforces, and the rule that the lane is declared before
  work starts and changed only by re-proposing.
  Trigger phrases include: which lane, lane selection, express lane, standard lane, full
  lane, hotfix, how much process, proportionate process, gate set, --lane.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: lifecycle-method
  lifecycle_phases: [1]
  used_by_agents: [navi-agent-orchestrator, navi-agent-product-owner, navi-agent-architect]
  owner: OWNER_TBD
  tags: "adlc, lanes, governance, proportionality"
  model: sonnet
---

## When to use

A change is about to be proposed and needs a lane, or a change in flight has grown past the
lane it was proposed under.

## Rules

1. Declare the lane in `proposal.md` before any work starts. The lane is set by
   `navi-delivery propose <name> --lane <lane>` and written into `state.lane` and the
   proposal frontmatter at the same moment.
2. Choose from exactly four lanes: `express`, `standard`, `full`, `hotfix`. The CLI refuses
   any other value.
3. Select the lane by the highest-severity characteristic present, never by the average.
   One regulated data field in an otherwise trivial change makes it `full`.
4. Take `full` for any change that touches a dataset, a schema, a feature store or a model.
   `standard` cannot record G4 at all — the gate is outside its set and the CLI refuses it.
5. Take `hotfix` only for an active production incident. A bug found before release is
   `standard`, not `hotfix`.
6. Take `express` only when the change alters no behaviour a test could distinguish beyond
   the literal string, value or flag being changed — copy, a config value, a flag flip.
7. Never widen a lane in place. `state.lane` is not edited by hand. A change that outgrows
   its lane is archived or abandoned and re-proposed under the correct lane.
8. Record the reason for the lane in `proposal.md` alongside the declaration. A lane chosen
   without a stated reason is not reviewable.
9. Where two lanes both plausibly fit, take the wider one. The cost of an unnecessary gate is
   hours; the cost of a missing gate is an incident.
10. A `hotfix` defers G2 but never drops it. The deferral is a waiver with a real expiry —
    see `navi-skill-waivers-and-deferrals`.

## Decision table

| Observable characteristic of the change | Lane |
|---|---|
| Production is currently degraded or down | `hotfix` |
| Touches a dataset, schema, feature or model | `full` |
| Introduces a capability that does not exist today | `full` |
| Falls under a named regulation, or processes PII not already processed | `full` |
| Changes a public API contract or a cross-team interface | `full` |
| A feature or bug fix inside an existing capability | `standard` |
| Changes behaviour that an existing test asserts | `standard` |
| Adds or changes a dependency | `standard` |
| Changes only display copy, with no logic branch on the text | `express` |
| Flips an existing feature flag whose both states are already tested | `express` |
| Changes a config value inside a range the system already handles | `express` |
| Two of the above disagree | Take the wider lane |

## Template

```markdown
---
change: theme-persistence
lane: standard
gates: G1 · G2 · G3 · G5 · G6 · G7 · G8
status: proposed
---

# theme-persistence

## Lane

`standard` — a feature inside an existing capability. It changes behaviour that existing
tests assert, so it is not `express`; it touches no dataset, schema, feature or model, and
introduces no new capability, so it is not `full`; production is healthy, so it is not
`hotfix`.

## Why
...
```

Proposing it:

```bash
navi-delivery propose theme-persistence --lane standard
# => Created delivery/changes/theme-persistence (lane: standard; gates: G1 · G2 · G3 · G5 · G6 · G7 · G8)
```

The four lanes and the gates each enforces:

```text
express   G2 G6 G7
standard  G1 G2 G3 G5 G6 G7 G8
full      G1 G2 G3 G4 G5 G6 G7 G8 G9
hotfix    G2 G6 G7 G9        (G2 deferred, retroactive; G9 mandatory)
```

## Checklist

- [ ] The lane is one of `express`, `standard`, `full`, `hotfix`
- [ ] The lane was declared before any work started
- [ ] The reason for the lane is written in `proposal.md`
- [ ] Every characteristic in the decision table was checked, not just the first match
- [ ] Data, schema, feature or model involvement was checked explicitly — that forces `full`
- [ ] `navi-delivery status` shows the lane and gate set that were intended
- [ ] No prior change is still active — `propose` refuses a second change in flight

## Anti-patterns

**Lane by size.** `It is a two-line change, so express.` Line count is not a characteristic
in the table. A two-line change that adds a PII column is `full`.

**Lane widened in place.** Editing `lane: standard` to `lane: full` in `proposal.md` and
`state.json` after G4 turns out to be needed. The gates already recorded were recorded
against a different gate set, and the event log no longer describes what happened. Archive or
abandon the change and re-propose under `full`.

**Hotfix for urgency.** A deadline is not an incident. `hotfix` exists to let a live outage be
repaired before the specification catches up; using it for a change that is merely late
deletes G1, G3, G5 and G8 from a change that needed them.

**Express for a flag that gates untested behaviour.** Flipping a flag whose `on` state has
never run in production is not a flag flip — it is the release of the behaviour behind it.
That is `standard` at least.

**Averaging.** `Mostly copy changes, with one small schema addition, so express.` The lane is
set by the highest-severity characteristic. The schema addition makes it `full`.

**Silent second change.** Starting a second change while one is active. `propose` refuses
with `change '<name>' is already active`. Archive the first change, or finish it, before
proposing the second.

## Validation

```bash
navi-delivery status     # prints the lane and every gate it enforces
```

The gate set printed by `status` must match the `gates:` line in `proposal.md`. A mismatch
means one of the two was edited by hand; the source of truth is `state.json`, and the fix is
to correct `proposal.md`, never the reverse.

Confirm the CLI agrees the lane exists before committing to it:

```bash
navi-delivery propose <name> --lane <lane>
# an unknown lane is refused with: unknown lane '<lane>' — valid lanes: express, standard, full, hotfix
```
