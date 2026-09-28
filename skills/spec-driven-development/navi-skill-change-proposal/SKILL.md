---
name: navi-skill-change-proposal
description: >
  Use when opening a change — writing `proposal.md` or reviewing one before G1-INTENT.
  Defines the proposal template, what a complete Why, What changes, Impact and Non-goals
  contains, the lane declaration, and the rule that one change is in flight at a time.
  Trigger phrases include: proposal, proposal.md, propose a change, open a change, why what
  impact non-goals, change request, G1, intent, navi-delivery propose, start a change.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: spec-driven-development
  lifecycle_phases: [1, 2]
  used_by_agents: [navi-agent-product-owner, navi-agent-orchestrator, navi-agent-business-analyst, navi-agent-architect]
  owner: OWNER_TBD
  tags: "sdd, proposal, scope, intent"
  model: sonnet
---

## When to use

A change is about to be opened, or an existing `proposal.md` is under review before
G1-INTENT is recorded.

## Rules

1. Create the change with `navi-delivery propose <name> --lane <lane>`. The command scaffolds
   `proposal.md`, `design.md`, `tasks.md`, `handoffs.md` and `specs/` from templates and sets
   `state.change`, `state.lane` and `state.phase` in one step.
2. Name the change as a slug: lowercase letters, digits, `.`, `_` and `-`, starting with a
   letter or digit. Anything else is refused. Name it after the outcome, not the mechanism —
   `theme-persistence`, not `add-redis-cache`.
3. Finish the active change before opening another. `propose` refuses outright while
   `state.change` is set, and refuses before validating anything else about the new proposal.
4. Replace every `<angle-bracket placeholder>` the template ships. A proposal still carrying a
   placeholder is not a proposal and cannot pass G1.
5. Declare the lane in the frontmatter and justify it in the body, per
   `navi-skill-lane-selection`. The `gates:` line the template fills in must match what
   `navi-delivery status` prints.
6. Write **Why** as the outcome, with a measure. Name the `INSIGHT-###`, incident, or request
   that prompted it. An outcome with no measure cannot be compared at G9.
7. Write **What changes** as capabilities added, modified or removed, from the outside. Never
   as a task list and never as an implementation.
8. Write **Impact** covering all five: systems, data, consumers, migrations, and operational
   load. Where one is genuinely nil, write `None — <reason>` rather than omitting it.
9. Write **Non-goals** as the things a reasonable reader would otherwise assume are in scope.
   A non-goal nobody would have expected costs a line and buys nothing.
10. State the rollback posture: what happens if this change has to be undone after release,
    and whether that is reversible, reversible-with-data-loss, or one-way.
11. Keep the proposal under two pages. The specification carries the detail; the proposal
    carries the commitment.
12. Never start specification work before the proposal exists. The proposal is what the
    specification is a specification *of*.

## Decision table

| Observed in the draft | Required action |
|---|---|
| Why names an activity, not an outcome | Rewrite as the change in the world, with a measure |
| Why has no measure | Add the KPI, SLI, or named behaviour change that G9 will compare against |
| What changes reads as a task list | Move it to `tasks.md`; state capabilities here |
| What changes names a library or a table | Move it to `design.md`; state external behaviour here |
| Impact omits data | Write the data impact, or `None — no dataset is read or written` |
| Impact omits consumers | Name every downstream team or system, or `None — <reason>` |
| A migration is needed and unmentioned | Blocking — name it, and whether it is reversible |
| Non-goals is empty | Every change has a boundary. Name what a reader would assume is included |
| A non-goal is really a deferred requirement | Move it to the spec as a `Won't` with its reason |
| The lane is declared with no reason | Add the reason per `navi-skill-lane-selection` |
| `gates:` disagrees with `navi-delivery status` | `state.json` is truth — correct `proposal.md` |
| A placeholder remains | Fill it in; G1 does not pass on a template |
| `propose` reports a change already active | Finish that change, or close it out — waive each unsettled gate naming the abandonment, then `archive`. There is no `abandon` command |
| The proposal exceeds two pages | Move detail into the spec |

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

`standard` — a feature inside an existing capability. It changes behaviour existing tests
assert, so not `express`; it touches no dataset, schema, feature or model, so not `full`;
production is healthy, so not `hotfix`.

## Why

Signed-in users lose their theme choice on every page load, and 11% of support contacts in
the last quarter were about it (INSIGHT-004, from the 2026-Q2 support review).

**Outcome:** theme-related support contacts fall below 2% of the total within one quarter of
release, measured on the existing support-tag report.

## What changes

- **Added:** a durable theme preference per signed-in user, applied on every page load.
- **Modified:** the settings page writes the preference rather than holding it in memory.
- **Removed:** nothing.

## Impact

- **Systems:** the settings service and the web shell. No new service.
- **Data:** one new column on the existing user-settings record. Not personal data under the
  project's classification.
- **Consumers:** the mobile web client reads the same settings endpoint and inherits the
  behaviour. The native apps are unaffected — they never read this endpoint.
- **Migrations:** one additive column with a default. Reversible by dropping it; existing rows
  are unaffected.
- **Operational load:** no new alert, no new runbook. `SLI-001` is added to the existing
  settings dashboard.

## Rollback posture

Reversible. The feature is behind `theme-persistence-enabled`; disabling the flag restores the
in-memory behaviour with no data loss. The column is left in place.

## Non-goals

- **A theme editor.** Only the three existing themes are selectable.
- **Per-device overrides.** Deferred; needs a device identity the product does not have.
- **Themed transactional email.** Out of scope; owned by the messaging team.
```

Creating it:

```bash
navi-delivery propose theme-persistence --lane standard
# => Created delivery/changes/theme-persistence (lane: standard; gates: G1 · G2 · G3 · G5 · G6 · G7 · G8)
navi-delivery status
```

## Checklist

- [ ] The change was created with `navi-delivery propose`, not by hand
- [ ] The name is a valid slug and names the outcome, not the mechanism
- [ ] No other change was active when this one was proposed
- [ ] Every template placeholder has been replaced
- [ ] The lane is declared in the frontmatter and justified in the body
- [ ] `gates:` matches what `navi-delivery status` prints
- [ ] Why states an outcome and the measure G9 will compare against
- [ ] Why names the insight, incident or request that prompted it
- [ ] What changes is capabilities added, modified and removed
- [ ] Impact covers systems, data, consumers, migrations and operational load
- [ ] Rollback posture is stated and is one of reversible, lossy, or one-way
- [ ] Non-goals name what a reader would otherwise assume is in scope
- [ ] The proposal is under two pages

## Anti-patterns

**Why as activity.** `Why: we need to add a preferences table.` That is a task. The outcome is
what changes for a user or the business. Write the outcome and the measure.

**Outcome with no measure.** `Why: improve the user experience.` G9 compares the predicted
outcome against the measured one; with nothing predicted there is nothing to compare, and the
change never teaches anybody anything. Name the number.

**Impact by omission.** An Impact section listing two systems and nothing about data,
consumers or migrations. A reader cannot tell whether they were considered. Write
`None — <reason>` for each genuinely nil line.

**Non-goals as wishlist.** `Non-goals: we will not build a chat feature.` Nobody thought you
would. Non-goals earn their place by heading off an assumption a reader would actually make —
here, that a theme change includes email templates.

**Non-goal that is really a requirement.** `Non-goals: per-device overrides (we'll do it in
phase two).` That is a deferred requirement. Record it in the spec as a `Won't` with its
reason, so it is traceable rather than folklore.

**Proposal as specification.** Eight pages of requirements and criteria in `proposal.md`. The
proposal states the commitment; the spec states the behaviour. G1 and G2 are separate gates
because they answer separate questions.

**Hand-built change folder.** Creating `delivery/changes/<name>/` with `mkdir`. `state.change`
and `state.lane` are never set, so `status` shows no active change, `gate` refuses every gate,
and `archive` refuses the change. Use `propose`.

**Second change in flight.** Opening a second proposal while one is active. `propose` refuses
with `change '<name>' is already active`. One change at a time is the model the state file
implements; there is no way to hold two.

## Validation

```bash
navi-delivery status     # change, lane and gate set must match proposal.md
navi-delivery validate   # frontmatter, separation and traceability
```

Confirm no placeholder survives:

```bash
grep -nE '<[a-z][^>]*>' delivery/changes/<name>/proposal.md
```

Any hit is an unfilled template slot. Confirm the declared gate set matches state:

```bash
grep '^gates:' delivery/changes/<name>/proposal.md
navi-delivery status | grep -E '^  G[1-9]'
```

Every gate in the `gates:` line must appear in the `status` listing, and no other.
