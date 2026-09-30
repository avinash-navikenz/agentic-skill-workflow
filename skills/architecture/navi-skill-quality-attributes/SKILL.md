---
name: navi-skill-quality-attributes
description: >
  Use when a design has to state what it optimises for, when a non-functional requirement
  arrives as an adjective, or when G6 needs a threshold it can measure. Defines the QAS-###
  scenario form, the ranking that forces a trade-off, and the cost every attribute charges.
  Trigger phrases include: quality attributes, non-functional, NFR, latency budget,
  availability target, scalability, performance target, trade-off, QAS, what does this cost.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: architecture
  lifecycle_phases: [3, 6]
  used_by_agents: [navi-agent-architect, navi-agent-qa-engineer]
  owner: OWNER_TBD
  tags: "architecture, quality-attributes, nfr, performance, availability, trade-offs"
  model: opus
---

## When to use

A design is being chosen and the criteria that discriminate between the options must be
written down; a requirement names a quality as an adjective; or G6 is about to measure a
non-functional threshold and needs to know the instrument.

## Rules

1. Write every quality attribute as a `QAS-###` scenario in `delivery/changes/<name>/design.md`
   under the `## Quality attributes` heading, numbered sequentially within the change.
   `templates/change/design.md` ships that heading, so fill it in place. Never append a second
   `## Quality attributes` — two headings of the same name make G3's reader pick one, and the
   ranking in the other is then unread.
2. Give every scenario all six fields, in order: `Source`, `Stimulus`, `Environment`,
   `Response`, `Measure`, `Serves`. A scenario missing `Environment` is a number nobody can
   reproduce; one missing `Source` is a load nobody can generate.
3. Write `Measure` as one number, one unit, one percentile where the quantity is a
   distribution, and one window. `p95 under 200ms over a 5-minute window` is a measure;
   `under 200ms` is an aspiration, because the tail is where the complaint comes from.
4. Write `Environment` as the concrete conditions the measure holds under: the load, the
   data volume, and the deployment target. A measure that holds on an empty database is a
   measure of an empty database.
5. State the threshold once, in the spec, as an `AC-###`, and open the scenario's `Measure`
   with that id. A figure written after the id is a quotation of that criterion and matches it
   word for word; the spec is the source and the scenario is the citation. A `Measure` with a
   figure and no `AC-###` is a second source of truth, and the day the two disagree neither is
   authoritative.
6. Bind every scenario to the requirement it serves with `Serves: REQ-###`. A scenario that
   serves no requirement is a preference; delete it or raise the requirement it implies.
7. Rank every attribute the design names against every other, as a total order with no ties,
   in a `### Ranking` table under the same heading. Ranking is the whole content of the
   claim: attributes that are all equally important are all equally negotiable.
8. Charge every attribute a cost. Each scenario carries a `Costs:` line naming the attribute
   it degrades and by how much, referencing the losing `QAS-###` where one exists. An
   attribute that costs nothing was not designed for — it was assumed.
9. Name the instrument in `Measured-by:`: the command, the query, or the dashboard that
   produces the number, written so somebody else can run it. G6 measures thresholds rather
   than assuming them, and an unnamed instrument is how an assumption passes as a measurement.
10. Record an attribute for which no instrument exists and none will be built as a `Q-###`
    open question in the spec, not as a scenario. A scenario nobody can measure produces a
    gate criterion nobody can honestly meet.
11. Resolve a conflict between two top-ranked attributes in an `ADR-###` before recording G3,
    naming which one yields and under what conditions. A conflict left unresolved in the
    design is resolved at 3am by whoever is on call.
12. Re-measure every scenario at G6 against the running build and attach the output as gate
    evidence. A scenario measured only at design time records an intention.

## Decision table

| Observed input | Required action |
|---|---|
| Spec says "fast", "responsive", "snappy" | Write a latency scenario: percentile, window, load, environment |
| Spec says "scalable" | Write a growth scenario: from what volume, to what volume, by when |
| Spec says "highly available" | Write an availability scenario: the figure, the measurement period, what counts as down |
| Spec says "secure" | Not a quality attribute scenario — route to `navi-skill-threat-modelling` |
| Spec says "maintainable" | Write a modifiability scenario: the named change, the components it touches, the effort bound |
| A measure has no percentile and names a distribution | Add the percentile; a mean hides the tail that produces the complaint |
| A measure has no window | Add the window; an instantaneous number is unfalsifiable |
| No instrument exists and none is funded | Record `Q-###`; do not write the scenario |
| Two attributes are ranked equal | Break the tie; record the reasoning in an `ADR-###` |
| A scenario names no cost | Find the attribute it degrades, or delete the scenario |
| The spec's figure and the design's figure differ | The spec wins; the scenario cites the `AC-###` instead of restating it |
| G6 is being recorded and a scenario was never measured | Record `--fail`, measure it, then re-record |

## Template

Fill the `## Quality attributes` section that `templates/change/design.md` ships into every
`delivery/changes/<name>/design.md`:

```markdown
## Quality attributes

### Ranking

| Rank | Attribute | Why it outranks the one below |
|---|---|---|
| 1 | Data integrity | A wrong stored preference is invisible and permanent; a slow one is neither |
| 2 | Availability of first paint | The shell renders for every request; this path has no fallback UI |
| 3 | Latency of the preference write | The write is user-initiated and can be optimistic |
| 4 | Modifiability of the storage choice | ADR-007 is reversible inside one component |

### QAS-001 — First paint under session-payload load

- **Source:** 500 concurrent signed-in users (2026-Q2 capacity note)
- **Stimulus:** Each requests the application shell
- **Environment:** Production configuration, warm cache, user table at 2.1M rows
- **Response:** The shell renders with the stored theme applied, no flash of the wrong theme
- **Measure:** AC-004 — p95 time-to-first-paint under 1200ms over a 5-minute window at 500 rps
- **Measured-by:** `npm run perf -- --scenario=shell --rps=500 --window=5m` writing
  `delivery/changes/theme-persistence/evidence/g6-qas-001.json`
- **Costs:** QAS-003 — holding the preference in the session payload adds 40ms to sign-in,
  measured at p95
- **Serves:** REQ-001

### QAS-002 — Preference survives the store being unreachable

- **Source:** The user store, failing
- **Stimulus:** The session payload read times out
- **Environment:** Production configuration, store returning connection errors for 60s
- **Response:** The light theme renders and one warning is logged with the user id omitted
- **Measure:** AC-003 — 100% of requests in the failure window render within the same 1200ms
  budget, zero requests render a blank shell
- **Measured-by:** `npm run test:resilience -- --fault=user-store-timeout`
- **Costs:** QAS-001 — the fallback path bypasses the cache, so p95 in the failure window is
  the uncached figure, not the warm one
- **Serves:** REQ-001, REQ-004

### QAS-003 — Sign-in latency after the payload grows

- **Source:** A signed-in user
- **Stimulus:** Submits credentials
- **Environment:** Production configuration, session payload including the preference field
- **Response:** The session is established and the payload carries the stored preference
- **Measure:** AC-012 — p95 sign-in under 900ms over a 5-minute window at 50 rps
- **Measured-by:** `npm run perf -- --scenario=signin --rps=50 --window=5m`
- **Costs:** Accepted. QAS-001 outranks this scenario in the ranking table above; ADR-007
  records the reasoning.
- **Serves:** REQ-004
```

## Checklist

- [ ] Every attribute the design claims to optimise for has a `QAS-###`
- [ ] Every scenario has all six fields in order
- [ ] Every `Measure` carries a number, a unit, a percentile where applicable, and a window
- [ ] Every `Environment` names load, data volume and deployment target
- [ ] Every threshold appears once, in the spec, and is cited by `AC-###`
- [ ] Every scenario has `Serves: REQ-###`
- [ ] The ranking table is a total order with no ties
- [ ] Every scenario names a `Costs:` attribute or records the cost as accepted with an ADR
- [ ] Every scenario names a runnable `Measured-by:` instrument
- [ ] Attributes with no instrument are `Q-###` open questions, not scenarios
- [ ] Every scenario was measured against the build before G6 was recorded

## Anti-patterns

**The adjective list.** `Quality attributes: fast, scalable, secure, maintainable.` Every
design on the table satisfies this, so it discriminates between nothing. Write
`p95 shell render under 1200ms at 500 rps (AC-004)` and let the options fail it.

**The mean.** `Measure: average response time under 200ms.` Half the users are above the
average and the complaint comes from the tail. Write `p95 under 200ms over a 5-minute window`.

**The unranked list.** Four attributes, no order, each described as critical. The first time
two of them conflict the decision is made by whoever is typing. Rank them, no ties, and say
why each outranks the one below.

**The free attribute.** `QAS-002: the system is highly available. Costs: none.` Availability
is bought with redundancy, with latency, or with complexity somebody operates. Name what it
took, or the attribute was assumed rather than designed for.

**Two copies of one number.** `spec.md` says p95 under 200ms; `design.md` says under 250ms.
Both are cited in different reviews and neither is wrong on its face. State the figure once
in the spec and cite `AC-###` from the scenario.

**The unmeasurable measure.** `Measure: the system feels responsive under load.` No
instrument produces this, so G6 cannot honestly record it. Either name the instrument or
record `Q-003` and leave the scenario unwritten.

**Design-time measurement.** `QAS-001` measured against a prototype in week one and never
again. G6 requires the threshold measured against the build. Re-run the instrument and attach
the output as evidence.

**Environment omitted.** `p95 under 200ms` measured on a developer laptop against a seeded
database of 40 rows. It will hold there forever and nowhere else. Name the load, the data
volume and the deployment target.

## Validation

```bash
DESIGN=delivery/changes/<name>/design.md

# Every scenario carries all six fields
for id in $(grep -o 'QAS-[0-9]\{3,\}' "$DESIGN" | sort -u); do
  for f in Source Stimulus Environment Response Measure Serves; do
    awk -v id="$id" '$0 ~ "^### " id " " {on=1; next} /^### /{on=0} on' "$DESIGN" | grep -q "\*\*$f:\*\*" \
      || echo "$id: missing $f"
  done
done

# Every Measure carries a digit; a measure with no number is an aspiration
grep -n '\*\*Measure:\*\*' "$DESIGN" | grep -v '[0-9]'

# Adjectives with no figure anywhere in the section
awk '/^## Quality attributes/,0' "$DESIGN" \
  | grep -nE '\b(fast|quick|scalable|robust|reliable|responsive|highly available|maintainable)\b'

# Every Measure opens with an AC-### that exists in the change's spec
grep -oE '\*\*Measure:\*\* *AC-[0-9]{3,}' "$DESIGN" | grep -oE 'AC-[0-9]{3,}' | sort -u \
  | while read -r ac; do
      grep -rq "$ac" delivery/changes/<name>/specs/ || echo "Measure cites unknown $ac"
    done
grep -nE '\*\*Measure:\*\*' "$DESIGN" | grep -v 'AC-'

# Every REQ a scenario serves exists in the change's spec
for req in $(grep -o 'REQ-[0-9]\{3,\}' "$DESIGN" | sort -u); do
  grep -rq "$req" delivery/changes/<name>/specs/ || echo "serves unknown $req"
done
```

Each command prints nothing when the rule holds. Run
`python3 scripts/validate_traceability.py delivery/` as well: a threshold written as an
`AC-###` is covered by rule T2 only when it sits under its requirement's heading.
