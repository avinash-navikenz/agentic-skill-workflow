---
name: navi-skill-non-functional-requirements
description: >
  Use when a requirement names a quality as an adjective, when nobody has asked what happens at
  ten times the volume, or when G2 is about to be recorded and the only requirements are
  functional. Defines the nine-category pass recorded even where it yields nothing, the rule
  that an NFR is an ordinary REQ-### with its threshold as an AC-###, the four admissible
  sources for a number, the verification line every NFR carries, and the handoffs to the SLI
  and to the design's quality-attribute ranking.
  Trigger phrases include: non-functional requirements, NFR, quality requirements, performance
  requirement, availability requirement, scalability, capacity, security requirement, privacy,
  data residency, accessibility, WCAG, operability, compatibility, cost requirement, ilities,
  it must be fast, it must be secure, G2 spec.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: business-analysis
  lifecycle_phases: [2, 3]
  used_by_agents: [navi-agent-business-analyst, navi-agent-architect]
  owner: OWNER_TBD
  tags: "business-analysis, requirements, nfr, thresholds, privacy, accessibility, cost, g2"
  model: opus
---

## When to use

A spec contains only functional requirements; a stakeholder has said "it must be fast" or "it
must be secure"; a number in a spec has no stated origin; or G2 is about to be recorded and the
non-functional categories have not been asked about.

## Rules

1. Write every non-functional requirement as an ordinary `REQ-###` in
   `delivery/changes/<name>/specs/<capability>/spec.md`, with its threshold as an `AC-###`
   under it, following `navi-skill-spec-authoring`'s shape. A separate NFR document is invisible
   to the framework: `scripts/validate_traceability.py` gathers requirements and criteria from
   `**/spec.md` only, so an NFR written anywhere else has no T2 check, no task binding, and no
   test at G5.
2. Run the nine-category pass and record every category, including those with no requirement,
   as `none` with the reason: **performance**, **availability and recovery**, **capacity and
   growth**, **security**, **privacy and data residency**, **accessibility**, **operability**,
   **compatibility**, **cost**. A category left unmentioned cannot be told apart from a category
   nobody considered, and the one nobody considered is the one that becomes an incident.
3. Never let an adjective be the requirement. `fast`, `secure`, `reliable`, `scalable`,
   `user-friendly` and `highly available` each name a direction and no threshold, so no build
   can fail them and no test can check them. Every NFR carries a number, a unit, a percentile
   where the quantity is a distribution, a window, and the conditions it holds under.
4. Give every NFR a `**Threshold source:**` line stating where its number came from, as exactly
   one of four: a commitment already recorded in `delivery/project.md` `## Constraints`; a
   measured current value with the date and window it was measured over; a regulation or
   standard named by clause; or a decision taken and recorded as an `ADR-###`. A round number
   with no origin is re-argued at every gate and defended by whoever proposed it. This is a
   different fact from `navi-skill-requirements-elicitation`'s `**Source:**`, which says who
   asked for the requirement — an NFR carries both, because "the regulator requires it" and
   "the operator asked for it" are separate claims and each can be wrong on its own.
5. State the conditions in the criterion itself: the load, the data volume, the deployment
   target, the client population. `p95 under 400ms` holds trivially on an empty database and
   means nothing until the conditions are attached to it.
6. Give every NFR a `**Verified by:**` line naming how it is checked at G6 and by what
   instrument. `references/gates.md` requires non-functional thresholds to be measured rather
   than assumed, and a threshold with no named instrument is measured at Phase 6 by whatever
   tool is to hand.
7. Give every NFR a `**Priority:**` line. G2's exit criterion requires a MoSCoW priority on
   every requirement, and non-functional requirements are the ones most often written without
   one — which is how they end up as the first thing cut.
8. Bind an availability or latency requirement to an `SLI-###` rather than restating an
   objective. `navi-skill-observability` defines SLIs in `delivery/ops/slo.md` with an error
   budget; the requirement names the SLI and the day the two numbers are written separately is
   the day they begin to differ.
9. Write accessibility as a conformance level, the specific success criteria at issue, and the
   assistive technology the verification uses. `WCAG 2.2 AA` alone is a claim about a document
   nobody reads during the build; `1.4.3 contrast at 4.5:1 for body text, verified with axe-core
   and one NVDA pass` is a requirement.
10. Write privacy and residency as data classes, jurisdictions, retention and deletion — and
    name the `DC-###` where a dataset exists, so `navi-skill-data-contracts` carries the
    classification rather than a second copy of it. A requirement that says "GDPR compliant"
    names no class, no jurisdiction and no retention period.
11. Treat cost as a non-functional requirement with a unit bound and the volume assumption it
    holds at: cost per 1,000 requests, per 1,000 predictions, per tenant per month. Cost is the
    quality attribute that degrades exactly when the product succeeds, and it is the one most
    often absent from a spec entirely.
12. Write operability as what must be observable and what must be recoverable, with a time. The
    on-call operator is an actor — `navi-skill-requirements-elicitation` elicits them — and
    "recoverable within 15 minutes by a single operator without engineering escalation" is a
    requirement that changes the design, where "should be operable" is not.
13. Record a non-functional requirement that will not be met as a `Won't` with the reason, in
    the spec, rather than omitting it. An omitted NFR is indistinguishable from one nobody
    thought of, and it will be assumed to hold by everyone downstream.
14. Never copy a previous project's NFR set. A threshold that was derived for a different
    population and a different cost base is a number with a false provenance, which is worse
    than no number because it will not be questioned.
15. Send conflicts between non-functional requirements to `navi-skill-quality-attributes` at
    Phase 3, which ranks them as a total order with no ties in `design.md`'s
    `## Quality attributes` section. Two NFRs that cannot both be met are a design trade-off,
    not a specification defect, and resolving them inside the spec hides the trade-off from the
    people who have to make it.
16. Re-run the pass when the design changes the deployment target, the expected volume, or the
    data's jurisdiction. Each of the three invalidates a different subset of the numbers, and
    nothing recomputes them.

## Decision table

| Observed condition | Required action |
|---|---|
| The NFRs are in a separate document | Move them into `spec.md` as `REQ-###`; nothing else is traceable |
| A category has no requirement | Record it as `none` with the reason; never leave it unmentioned |
| The requirement is `fast`, `secure` or `highly available` | Replace with a number, a unit, a percentile, a window and the conditions |
| A number has no stated origin | Add `**Threshold source:**`: a `project.md` constraint, a measurement, a named clause, or an `ADR-###` |
| An NFR has a threshold source but no `**Source:**` | Add the provenance line too; where the number came from is not who asked for it |
| The threshold has no conditions | Add the load, the data volume and the target; without them it holds on an empty system |
| An NFR has no `Verified by` | Name the instrument now; at Phase 6 it becomes whatever tool is to hand |
| An NFR has no priority | Add MoSCoW; G2 requires it and NFRs are where it is most often missing |
| An availability requirement restates an SLO | Name the `SLI-###` in `delivery/ops/slo.md` instead |
| Accessibility is stated as `WCAG AA` | Add the success criteria at issue and the assistive technology used to verify |
| Privacy is stated as `GDPR compliant` | Name the data classes, jurisdictions, retention and deletion, and the `DC-###` |
| There is no cost requirement | Add one: a unit bound and the volume it holds at |
| Operability is stated as `should be operable` | State what must be observable, what must be recoverable, and in what time |
| An NFR will not be met this change | Record it as `Won't` with the reason — never omit it |
| The numbers came from the last project | Re-derive them; a false provenance is worse than none |
| Two NFRs cannot both be met | Send them to `navi-skill-quality-attributes` for the Phase 3 ranking |
| The deployment target, volume or jurisdiction changed | Re-run the pass; each invalidates a different subset |

## Template

Fill into `delivery/changes/<name>/specs/<capability>/spec.md`, under `## Requirements`,
alongside the functional ones:

```markdown
## Non-functional pass

| Category | Requirements | If none, why |
|---|---|---|
| Performance | REQ-020 | — |
| Availability and recovery | REQ-021 | — |
| Capacity and growth | REQ-022 | — |
| Security | REQ-023 | — |
| Privacy and data residency | REQ-024 | — |
| Accessibility | REQ-025 | — |
| Operability | REQ-026 | — |
| Compatibility | REQ-027 | — |
| Cost | none | The change adds one column and one read to an existing request. Measured at 0.0002 USD per 1,000 renders against a 0.31 USD baseline for the request as a whole, so no bound would bind. Revisit if the preference moves to its own service. |

### REQ-020 — First render completes within its budget
**Priority:** Must
**Source:** Elicited from ACTOR-001, 2026-09-18
**Threshold source:** Measured — the 28 days to 2026-09-20 gave a p95 of 372ms with no preference read
**Verified by:** `k6 run perf/first-render.js` at 1.2x peak RPS for 30 minutes, staging data
volume, per QAS-002

#### AC-020
Given the preference store is reachable and responding within its own budget,
when first render is measured over a rolling 28 days at or above production volume,
then p95 of `loadEventEnd - startTime` is at or below 400ms.
Implements: REQ-020

### REQ-021 — The capability stays available through a store outage
**Priority:** Must
**Source:** Elicited from ACTOR-004, 2026-09-19
**Threshold source:** `delivery/project.md` `## Constraints` commits to 99.5% for the web shell
**Verified by:** SLI-001 in `delivery/ops/slo.md`, which carries the objective and the error
budget. This requirement names the SLI; it does not restate the objective.

#### AC-021
Given the preference store is unreachable,
when a first render is requested,
then the document renders from the request header within the same 400ms budget and the response
carries `x-theme-source: header`.
Implements: REQ-021

### REQ-022 — The preference store holds ten times today's rows
**Priority:** Should
**Source:** Inferred — ASSUM-005
**Threshold source:** Measured — 4.1M rows on 2026-09-20, growing 6% a month over the preceding 12 months
**Verified by:** a seeded 41M-row store in the integration environment, read latency measured
at the same p95 as REQ-020

#### AC-022
Given the preference store holds 41,000,000 rows,
when a preference is read by user id,
then the read completes at or below 20ms at p95.
Implements: REQ-022

### REQ-023 — A preference is readable only by its owner and by an audited agent
**Priority:** Must
**Source:** Elicited from ACTOR-005, 2026-09-19
**Threshold source:** Decision — ADR-012, which records that support read access is permitted
with an audit record and that write access is not
**Verified by:** an integration case per actor, plus THREAT-004's `Verify` line at G6

#### AC-023
Given an authenticated user who is not the owner of a stored preference,
when the preference is requested,
then the response is 403 and no preference value is returned, in 100% of 4 attempted paths:
direct read, session payload, support console, and export.
Implements: REQ-023

### REQ-024 — A theme preference is retained only while the account exists
**Priority:** Must
**Source:** Inferred — ASSUM-003, pending Q-009
**Threshold source:** Regulation — UK GDPR Article 5(1)(e), storage limitation. Data class: preference
attribute tied to a user id, held in the EU-West region only. Carried in DC-001's
`## Classification`; not duplicated here.
**Verified by:** an integration case that deletes an account and re-reads the preference store

#### AC-024
Given a user account has been deleted,
when the preference store is read for that user id,
then no row is returned, within 24 hours of the deletion.
Implements: REQ-024

### REQ-025 — Both themes meet contrast at AA for body text
**Priority:** Must
**Source:** Elicited from ACTOR-001, 2026-09-18
**Threshold source:** Standard — WCAG 2.2 success criteria 1.4.3 (contrast minimum) and 1.4.11
(non-text contrast); the product's stated conformance target is AA
**Verified by:** `axe-core` in the integration suite for 1.4.3 and 1.4.11, plus one manual NVDA
pass on the settings screen recorded in `test-strategy.md`'s `## Verified manually`

#### AC-025
Given either theme is applied,
when body text is rendered against its background,
then the contrast ratio is at or above 4.5:1, and at or above 3:1 for interface components.
Implements: REQ-025

### REQ-027 — An added session field does not break existing consumers
**Priority:** Must
**Source:** Elicited from ACTOR-007, 2026-09-26
**Threshold source:** `delivery/project.md` `## Constraints` commits to supporting the two most
recent published mobile-shell releases
**Verified by:** the consumer-driven contract suite against CONTRACT-001's recorded shape, run
for each of the two supported releases

#### AC-027
Given a mobile-shell build from either of the two most recent published releases,
when the session payload carries the added `theme` field,
then the build parses the payload and renders, with 0 parse failures across both releases.
Implements: REQ-027

### REQ-026 — An operator can tell a theme fault from a store outage
**Priority:** Must
**Source:** Elicited from ACTOR-004, 2026-09-19
**Threshold source:** Decision — ADR-013, which sets three checks as the runbook's first-response
budget before the on-call escalates
**Verified by:** the ALERT-001 runbook's first three checks, exercised during the rollback
rehearsal

#### AC-026
Given first render is failing,
when the on-call operator follows `delivery/ops/runbooks/alert-001.md`,
then the response's `x-theme-source` header distinguishes a store fault from a resolver fault
without reading source, within the first three checks.
Implements: REQ-026

### REQ-028 — Offline preference editing
**Priority:** Won't
**Source:** Elicited from ACTOR-007, 2026-09-26
**Threshold source:** Decision — ADR-011, which records that offline editing needs a conflict-resolution
model the product does not have
**Verified by:** not verified; not in this change

Recorded rather than omitted, so that a reader does not assume it holds.
```

## Checklist

- [ ] Every NFR is a `REQ-###` in `spec.md` with its threshold as an `AC-###`
- [ ] All nine categories appear in the pass, with `none` and a reason where empty
- [ ] No requirement is an adjective; every one has a number, a unit and a window
- [ ] Every number has a `**Threshold source:**`: a constraint, a measurement, a named clause, or an ADR
- [ ] Every NFR also carries a `**Source:**` provenance line, as every other requirement does
- [ ] Every threshold states the conditions it holds under
- [ ] Every NFR has a `**Verified by:**` line naming the instrument
- [ ] Every NFR has a `**Priority:**` line
- [ ] Availability and latency requirements name an `SLI-###` rather than restating an objective
- [ ] Accessibility names the conformance level, the criteria at issue and the assistive technology
- [ ] Privacy names the data classes, jurisdictions, retention, deletion and the `DC-###`
- [ ] A cost requirement exists, with a unit bound and its volume assumption
- [ ] Operability states what must be observable, what must be recoverable, and in what time
- [ ] Anything that will not be met is a `Won't` with a reason, not an omission
- [ ] No threshold was copied from a previous project
- [ ] Any conflict between two NFRs is routed to the Phase 3 quality-attribute ranking
- [ ] The pass was re-run after any change to the target, the volume or the jurisdiction

## Anti-patterns

**The adjective requirement.** `REQ-020 — the system must be fast.` No build can fail it, no
test can check it, and at G6 it is declared met by whoever is asked. A number, a unit, a
percentile, a window and the conditions.

**The round number from nowhere.** `99.9% availability.` Nobody can say where it came from, the
service has never measured better than 99.4%, and the figure is re-argued at every gate. Give it
a `**Threshold source:**` — a constraint, a measurement, a clause or an ADR.

**The threshold with no conditions.** `p95 under 200ms.` It holds on an empty database with one
user and fails on the first real day. The conditions are what make a number falsifiable.

**The separate NFR document.** A tidy `nfrs.md` beside the spec. `validate_traceability.py`
reads `**/spec.md` and nothing else, so none of them has a T2 check, a task, or a test. They are
requirements nobody is obliged to meet.

**`GDPR compliant`.** No data class, no jurisdiction, no retention period, no deletion
behaviour. The reviewer cannot check it and the engineer cannot build it. Name the four.

**`WCAG 2.2 AA`.** A conformance claim with no criteria and no verification method. The build
ships with 3.1:1 contrast in the dark theme because nobody ran anything. Name the success
criteria and the tool.

**No cost requirement at all.** Inference cost, egress, per-tenant storage — none of them is in
the spec, and the bill arrives in the quarter the feature succeeds. State a unit bound and the
volume it holds at.

**The NFR omitted because it will not be met.** Offline editing is out of scope, so it is not in
the spec. Three consumers downstream assume it works, and one of them ships against it. Record
it as `Won't` with the reason.

**Last project's numbers.** The NFR set is copied from a system with a tenth of the traffic and
a different regulator. The numbers look authoritative and are wrong, and nobody questions them
because they have a precedent. Re-derive.

## Validation

```bash
CHANGE=<name>
for S in $(find delivery/changes/$CHANGE/specs -name spec.md 2>/dev/null); do

  # All nine categories appear in the pass
  for c in Performance "Availability and recovery" "Capacity and growth" Security \
           "Privacy and data residency" Accessibility Operability Compatibility Cost; do
    awk '/^## Non-functional pass$/{on=1;next} /^## /{on=0} on' "$S" | grep -q "^| $c " \
      || echo "$S: category '$c' is not in the non-functional pass"
  done

  # Every REQ named in the pass has an entry with Priority, Source and Verified by
  for id in $(awk '/^## Non-functional pass$/{on=1;next} /^## /{on=0} on' "$S" \
              | grep -o 'REQ-[0-9]\{3,\}' | sort -u); do
    body=$(awk -v id="$id" '$0 ~ "^### " id " " {on=1; next} /^### /{on=0} on' "$S")
    [ -n "$body" ] || { echo "$id: named in the pass but has no '### $id — …' entry"; continue; }
    for k in Priority Source "Threshold source" "Verified by"; do
      printf '%s\n' "$body" | grep -q "^\*\*$k:\*\*" || echo "$id: missing $k"
    done
    # The source is one of the four admissible kinds
    printf '%s\n' "$body" | grep '^\*\*Threshold source:\*\*' \
      | grep -qE 'Measured|project\.md|Regulation|Standard|Decision — ADR-[0-9]{3,}' \
      || echo "$id: Threshold source is none of a project.md constraint, a measurement, a named clause or an ADR"
    printf '%s\n' "$body" | grep '^\*\*Source:\*\*' \
      | grep -qE 'Elicited from ACTOR-[0-9]{3,}|Inferred — ASSUM-[0-9]{3,}' \
      || echo "$id: Source is neither 'Elicited from ACTOR-###' nor 'Inferred — ASSUM-###'"
    # A Won't still carries a reason
    printf '%s\n' "$body" | grep -q "^\*\*Priority:\*\* *Won't" \
      && { printf '%s\n' "$body" | grep -q '^\*\*Source:\*\*' \
           || echo "$id: recorded as Won't with no reason"; }
    # An availability or latency requirement names an SLI rather than restating an objective
    printf '%s\n' "$body" | grep -qiE 'availab|uptime' \
      && { printf '%s\n' "$body" | grep -qE 'SLI-[0-9]{3,}' \
           || echo "$id: availability requirement names no SLI-###"; }
  done

  # No adjective survives as a criterion. The boundary is a padded non-alphanumeric class,
  # not \< \> — those are a GNU extension that the awk shipped with macOS matches never, so
  # the check would pass silently on every input.
  awk '/^#### AC-/{on=1} /^### /{on=0}
       on { p = " " $0 " ";
         if (p ~ /[^[:alnum:]](fast|slow|secure|reliable|scalable|user-friendly|highly available|robust)[^[:alnum:]]/)
           print "an acceptance criterion states a quality as an adjective: " $0 }' "$S"

  # Every NFR criterion carries a number
  for id in $(awk '/^## Non-functional pass$/{on=1;next} /^## /{on=0} on' "$S" \
              | grep -o 'REQ-[0-9]\{3,\}' | sort -u); do
    body=$(awk -v id="$id" '$0 ~ "^### " id " " {on=1; next} /^### /{on=0} on' "$S")
    printf '%s\n' "$body" | grep -q "^\*\*Priority:\*\* *Won't" && continue
    printf '%s\n' "$body" | awk '/^#### AC-/{on=1} on' | grep -q '[0-9]' \
      || echo "$id: its acceptance criterion carries no number"
  done

  # Every SLI named is defined
  for s in $(grep -o 'SLI-[0-9]\{3,\}' "$S" | sort -u); do
    grep -q "^### $s " delivery/ops/slo.md 2>/dev/null \
      || echo "$s is named in $S but not defined in delivery/ops/slo.md"
  done

  # Accessibility names criteria and a tool; privacy names class, jurisdiction and retention
  awk '/^## Non-functional pass$/{on=1;next} /^## /{on=0} on' "$S" | grep -q '^| Accessibility | none' \
    || grep -qE 'WCAG[^|]*success criteri[^|]*[0-9]+\.[0-9]+\.[0-9]+' "$S" \
    || echo "$S: an accessibility requirement names no WCAG success criterion"

  # Every criterion carries an Implements line — T2 reads the REQ/AC pairing from this file
  a=$(grep -c '^#### AC-' "$S"); i=$(grep -c '^Implements: REQ-' "$S")
  [ "$a" -eq "$i" ] || echo "$S: $a criteria and $i 'Implements:' lines — every AC needs one"

done
```

Each command prints nothing when the rule holds. The category-pass loop is the one to run
before G2: every non-functional failure this framework has a gate for begins as a category
nobody was asked about.
