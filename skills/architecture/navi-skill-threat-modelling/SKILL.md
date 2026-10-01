---
name: navi-skill-threat-modelling
description: >
  Use when a design draws or moves a trust boundary, when G3 asks for a threat model, or when
  G6 asks which threats were exercised against the build. Defines the threat-model file, the
  per-boundary elicitation pass, the THREAT-### entry, and the three dispositions a threat may
  end in.
  Trigger phrases include: threat model, STRIDE, trust boundary, attacker, abuse case, what
  could go wrong, security design review, accepted risk, mitigation, G3 security evidence.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: architecture
  lifecycle_phases: [3, 6]
  used_by_agents: [navi-agent-security-engineer, navi-agent-architect]
  owner: avinash.negi@navikenz.com
  tags: "security, threat-modelling, trust-boundaries, stride, risk-acceptance, g3, g6"
  model: opus
---

## When to use

A design is being chosen at Phase 3 and the boundaries are still cheap to move; G3 is about to
be recorded and needs a threat model as evidence; a change on a lane that does not enforce G3
still has to state its own reach for G6; or G6 is about to measure whether each threat was
exercised against the build.

## Rules

1. Write the model at `delivery/changes/<name>/threat-model.md`. Link it from the
   `## Threat model` heading that `templates/change/design.md` ships into every `design.md`,
   and add a row for it to that template's `## Linked artifacts` table. G3's exit criteria are
   read against the design; a model nothing links to is a file nobody opens.
2. Open with `## What is worth taking` — every asset this change creates, moves or exposes,
   each with the harm its loss causes, stated as what happens to a person or to the business
   rather than as a category. `Session tokens: an attacker reads any user's saved preferences
   and changes them` is an asset; `PII` is a category.
3. Follow with `## Who would want it` — each actor with the access they start from, chosen
   from exactly four levels: `anonymous` (reaches the system from the public internet),
   `authenticated` (any account the system will issue), `colleague` (an employee with ordinary
   access), `privileged` (production access or a deploy credential). These four levels are the
   reach vocabulary the rest of the file uses.
4. Enumerate threats per boundary, not per feature. Take every `CONTRACT-###` in the design
   plus every place data is stored or logged, and run all six STRIDE prompts against each:
   spoofing, tampering, repudiation, information disclosure, denial of service, elevation of
   privilege. Record the pass for every boundary, including the prompts that produced nothing,
   so a later reader can tell "considered and empty" from "never asked".
5. Number threats `THREAT-###` sequentially within the change, never reused. Give each one
   all seven fields: `Boundary`, `Prompt`, `Reach`, `Attacker gains`, `Disposition`,
   `Verify`, `Serves`.
6. Set `Reach` to one of the four access levels from rule 3 — the lowest level from which the
   threat is reachable. Reach is observable and arguable from the design; likelihood is not,
   so do not record one.
7. Write `Attacker gains` as what the attacker comes away with, not as a severity word and not
   as a score. Do not assign CVSS, High/Medium/Low, or any numeric rating unless the team has
   already agreed one and it is written down somewhere this file can cite.
8. End every threat in exactly one of three dispositions, and nothing else:
   `designed out` (the boundary or the data no longer exists — name what was removed),
   `mitigated` (name the control, the component that enforces it, and the test that fails when
   the control is gone), or `accepted` (name the `ADR-###`, which carries `Accepted-risk:` and
   `Accepted-by:` with a person). `Monitor it`, `low risk`, `tracked in the backlog` and
   `TBD` are not dispositions, and a threat carrying one blocks G3.
9. Give every threat a `Verify` line naming how it will be exercised against the build at
   Phase 6 — the test, the script, the manual procedure, or the scan. A `designed out` threat
   verifies the absence: the test asserts the removed path is gone. G6 requires every threat
   exercised against the build, and a threat with no `Verify` makes that criterion
   unsatisfiable before Phase 6 even starts.
10. Prefer designing a threat out to mitigating it, and record which was chosen. Where a
    boundary was removed rather than defended, say so in the disposition: a later reader
    otherwise cannot tell a threat that was solved from one that was never real.
11. Bind every threat to what motivated it with `Serves: REQ-###`, the `CONTRACT-###` it sits
    on, or both.
12. On a lane that does not enforce G3 (`express`, `hotfix`), rename the shipped
    `## Threat model` heading to `## Reach` and write the reach statement there instead of a
    full model: what this change newly lets someone see or do, and from which of the four
    access levels. Renaming the shipped heading rather than adding a section is what keeps a
    `design.md` to one home for this; that statement is the threat set G6 exercises against.
    Never skip it — G6 is enforced by every lane.
13. Reopen the model when a boundary moves. A change that alters a `CONTRACT-###`, adds a
    store, or changes who can reach a component rewrites the affected boundary's pass and
    renumbers nothing. Inheriting an earlier model by reference is permitted only for
    boundaries this change does not touch, and the reference names the file and the threat ids.
14. Record the model before G3 is recorded, and re-run the `Verify` lines before G6 is
    recorded. A model produced after either verdict documents a decision that was never open.

## Decision table

| Observed condition | Required action |
|---|---|
| The design adds a `CONTRACT-###` | Run all six STRIDE prompts against it; record the pass |
| The change stores or logs a new field | Treat the store and the log as boundaries; run the pass against both |
| A STRIDE prompt produces nothing for a boundary | Record it as `none` — silence is indistinguishable from omission |
| A threat can be removed by deleting the path | `Disposition: designed out`, naming what was removed |
| A control exists and a test can prove it | `Disposition: mitigated`, naming control, component and test |
| The threat is real and will not be fixed | `Disposition: accepted` with an `ADR-###` and a named person |
| The proposed disposition is "monitor it" | Not a disposition — mitigate with a named alert and its test, or accept it |
| Nobody will sign the acceptance | Not accepted — it is unresolved; G3 is `--fail` until it is one of the three |
| The team has no agreed severity scale | Record `Reach` and `Attacker gains`; do not invent a rating |
| A threat has no `Verify` line | Write one before G3; G6 cannot exercise what nobody described |
| Lane is `express` or `hotfix` | Rename `design.md`'s `## Threat model` heading to `## Reach` and write the statement there; G6 still exercises it |
| A boundary is unchanged since the last model | Inherit by reference, naming the file and threat ids |
| A boundary moved since the last model | Re-run that boundary's pass; do not inherit |
| G3 is being recorded with an open threat | Record `--fail`; dispose of the threat, then re-record |

## Template

Copy into `delivery/changes/<name>/threat-model.md`:

```markdown
# Threat model — theme-persistence

Boundaries covered: CONTRACT-001, CONTRACT-002, CONTRACT-003, CONTRACT-004 (design.md), plus
the `user_preferences` store and the shell's request log.
Inherited unchanged: none.

## What is worth taking

| Asset | Harm if taken, changed or lost |
|---|---|
| Session payload | An attacker who forges one renders as any user and reads their account state |
| `user_preferences` rows | An attacker who writes them changes what 2.1M users see; the row names the user |
| Deployment ids on `/status` | An attacker learns release cadence and the window when a rollback is in flight |
| Shell request log | A log line carrying a user id turns a log read into a list of who signed in when |

## Who would want it

| Actor | Starts from | Wants |
|---|---|---|
| Credential-stuffing bot | `anonymous` | Any account it can hold; preferences are incidental |
| Curious signed-in user | `authenticated` | Another user's account state, reached by changing an id |
| Support engineer | `colleague` | Ordinary work, with more read access than the task needs |
| Compromised deploy token | `privileged` | Anything; assume the store and the logs both |

## Boundary pass — CONTRACT-001 (GET /v1/session)

| STRIDE prompt | Threat |
|---|---|
| Spoofing | THREAT-001 |
| Tampering | THREAT-002 |
| Repudiation | none — the read changes no state, and the access log already carries the caller |
| Information disclosure | THREAT-003 |
| Denial of service | none — the route is behind the existing per-IP limit, unchanged by this change |
| Elevation of privilege | none — the payload grants no capability the session did not already carry |

### THREAT-001 — Session forged from a guessable identifier

- **Boundary:** CONTRACT-001
- **Prompt:** Spoofing
- **Reach:** anonymous
- **Attacker gains:** Renders as a chosen user and reads and writes their stored preference
- **Disposition:** mitigated — session identifiers are 128-bit random, signed with the
  existing session key, and verified in `identity-service/session/verify.ts`. Enforced by
  `test/security/session-forgery.spec.ts`, which fails if verification is removed or the
  identifier length drops below 128 bits.
- **Verify:** `npm run test:security -- --grep "session-forgery"` at Phase 6, plus a manual
  replay of a truncated identifier against the staging shell
- **Serves:** REQ-001, CONTRACT-001

### THREAT-002 — Preference written for another user id

- **Boundary:** CONTRACT-001
- **Prompt:** Tampering
- **Reach:** authenticated
- **Attacker gains:** Changes any user's rendered theme, and proves the user id exists
- **Disposition:** designed out — the write takes no user id from the request. The handler
  derives it from the verified session only, so there is no parameter to tamper with.
  `identity-service/preferences/write.ts` has no `user_id` input.
- **Verify:** `test/security/preference-write-ignores-body-userid.spec.ts` asserts a request
  carrying `user_id` writes the session's own row and returns 400
- **Serves:** REQ-004, CONTRACT-001

### THREAT-003 — User id appears in the shell request log

- **Boundary:** shell request log
- **Prompt:** Information disclosure
- **Reach:** colleague
- **Attacker gains:** A list of which users signed in and when, from a log anyone on support
  can already read
- **Disposition:** mitigated — the fallback warning in AC-003 logs the failure code only.
  The log formatter redacts `user_id` in `web-shell/log/redact.ts`; enforced by
  `test/security/log-redaction.spec.ts`.
- **Verify:** `npm run test:security -- --grep "log-redaction"`, plus a grep of a staging log
  sample for uuid-shaped strings at Phase 6
- **Serves:** REQ-001

## Boundary pass — CONTRACT-002 (theme.changed event)

| STRIDE prompt | Threat |
|---|---|
| Spoofing | none — the event is published on an internal topic the shell alone can write, under the existing workload identity |
| Tampering | THREAT-002 — the same write path carries the user id, and the control is the same one |
| Repudiation | none — the broker records producer and offset for every message |
| Information disclosure | none — the payload carries the user id and the theme name, both of which the consumer already holds |
| Denial of service | none — the topic is bounded by the same per-user write limit as the preference write |
| Elevation of privilege | none — no consumer gains a capability from the event |

## Boundary pass — CONTRACT-003 (user_preferences table, read by reporting)

| STRIDE prompt | Threat |
|---|---|
| Spoofing | none — reporting reads through a role with no write grant, issued by the existing warehouse identity |
| Tampering | none — the grant is `SELECT` only; a write would fail at the database |
| Repudiation | none — the warehouse audit log records every query with its role |
| Information disclosure | THREAT-003 — the same user-id exposure, reached through the reporting copy rather than the log |
| Denial of service | none — reporting reads a nightly snapshot, never the live table |
| Elevation of privilege | none — the role grants nothing beyond this table |

### THREAT-004 — Anonymous enumeration of deployment ids via /status

- **Boundary:** CONTRACT-004
- **Prompt:** Information disclosure
- **Reach:** anonymous
- **Attacker gains:** Release cadence, and the window during which a rollback is running
- **Disposition:** accepted — ADR-009, `Accepted-by: Priya Raman, Head of Platform
  (2026-09-28)`. The same ids are already published in the release-notes feed.
- **Verify:** `test/security/status-payload-fields.spec.ts` asserts `/status` carries only the
  three fields ADR-009 accepted, so a fourth field reopens the decision rather than inheriting
  the acceptance
- **Serves:** REQ-011, CONTRACT-004
```

## Checklist

- [ ] `threat-model.md` exists, `design.md`'s `## Threat model` section links it by path, and `## Linked artifacts` carries a row for it
- [ ] Every asset names the harm, not a category
- [ ] Every actor carries one of the four access levels
- [ ] Every `CONTRACT-###`, store and log has a recorded six-prompt pass
- [ ] Every prompt that produced nothing is recorded as `none`, with the reason
- [ ] Every threat has all seven fields
- [ ] Every `Reach` is one of the four levels; no likelihood and no invented severity is recorded
- [ ] Every threat ends in `designed out`, `mitigated` or `accepted` — nothing else
- [ ] Every `mitigated` names the control, the component and the failing test
- [ ] Every `accepted` names an `ADR-###` carrying `Accepted-by:` with a person
- [ ] Every threat has a `Verify` line runnable at Phase 6
- [ ] On `express` or `hotfix`, `design.md`'s `## Threat model` heading is renamed `## Reach` and carries the statement
- [ ] The model predates the G3 verdict, and every `Verify` was re-run before G6

## Anti-patterns

**The category asset.** `Assets: PII, credentials, config.` Nothing follows from this, because
no harm is named and no actor wants a category. Write what the attacker comes away with and
what it does to someone: `the row names the user, so reading the table is reading who uses the
product`.

**Feature-shaped enumeration.** Threats listed under "theme toggle", "settings page",
"sign-in". Features overlap and boundaries do not, so this both repeats and misses. Enumerate
per `CONTRACT-###`, store and log.

**The invented severity.** `THREAT-002 — severity: Medium (CVSS 5.3).` The number was produced
by the person writing the model, and the disposition then follows from a number nobody agreed.
Record `Reach: authenticated` and `Attacker gains: changes any user's rendered theme`, and let
the person accepting it decide.

**"Monitor it."** `Disposition: we'll watch the logs.` Nobody is named, nothing fails when the
control is gone, and G3 cannot read it as any of the three dispositions. Either mitigate it
with an alert that has an owner and a test, or accept it in an ADR with a name on it.

**Acceptance without a name.** `Disposition: accepted — agreed at the design review.` In
eighteen months there is nobody to ask what was known at the time. Write the `ADR-###` with
`Accepted-by: <person>, <role> (<date>)`.

**Silence that reads as absence.** A boundary with three threats listed and three STRIDE
prompts not mentioned. A reader cannot tell whether elevation of privilege was considered and
dismissed or never asked. Record `none` with the reason.

**The model with no verification.** Twelve threats, twelve mitigations, no `Verify` lines. At
G6 the criterion "every threat exercised against the build" has nothing to run, and the gate
gets recorded on the strength of the design document. Write the `Verify` line with the threat.

**Inheriting a moved boundary.** `Inherited from the 2026-06 model` for a contract this change
just versioned. The inherited pass was run against a different boundary. Re-run the pass for
every boundary the change touches.

**Express means skip.** A `hotfix` change with no threat work because G3 is not enforced. G6
is enforced by every lane and requires the change's own reach. Rename the shipped
`## Threat model` heading to `## Reach` and write the statement under it.

## Validation

```bash
CHANGE=<name>
TM=delivery/changes/$CHANGE/threat-model.md

# The design links the model, from the shipped section and from the link table
grep -q 'threat-model.md' delivery/changes/$CHANGE/design.md || echo "design.md does not link the threat model"
# and it is one section, not a second one appended beside the shipped heading
[ "$(grep -c '^## Threat model$' delivery/changes/$CHANGE/design.md)" -le 1 ] \
  || echo "design.md has more than one '## Threat model' heading"

# Every threat has all seven fields
for id in $(grep -o 'THREAT-[0-9]\{3,\}' "$TM" | sort -u); do
  for f in Boundary Prompt Reach "Attacker gains" Disposition Verify Serves; do
    awk -v id="$id" '$0 ~ "^### " id " " {on=1; next} /^### /{on=0} on' "$TM" | grep -q "\*\*$f:\*\*" \
      || echo "$id: missing $f"
  done
done

# Every disposition is one of the three permitted words
grep -n '\*\*Disposition:\*\*' "$TM" | grep -vE 'designed out|mitigated|accepted'

# No invented rating
grep -nE '\b(CVSS|severity: *(high|medium|low)|likelihood)\b' "$TM"

# Every accepted threat names an ADR that exists and carries an acceptor
for adr in $(awk '/\*\*Disposition:\*\* accepted/{print}' "$TM" | grep -o 'ADR-[0-9]\{3,\}'); do
  test -f "delivery/decisions/$adr.md" || echo "missing $adr"
  grep -q '^## Accepted-by$' "delivery/decisions/$adr.md" || echo "$adr has no Accepted-by"
done

# Every boundary in the design has a recorded pass
for c in $(grep -o 'CONTRACT-[0-9]\{3,\}' delivery/changes/$CHANGE/design.md | sort -u); do
  grep -q "Boundary pass — $c" "$TM" || echo "no STRIDE pass recorded for $c"
done
```

Each command prints nothing when the rule holds. Before G6, re-run every `Verify` line and
write what each produced into the security verification record — see
`navi-skill-dependency-vulnerabilities` for the record's shape, which carries threat
verification and dependency findings together.

**Known gap: one gate, several artifacts.** G3's evidence list in `references/gates.md` names
three artifacts — `design.md`, the ADRs, and the threat model — but `navi-delivery gate`
accepts exactly one `--evidence` path and refuses a path that does not resolve. Until that is
reconciled, write an index at `delivery/changes/<name>/evidence/g3-design.md` linking the
design, each `ADR-###` and the threat model, and pass that file. Passing the threat model
alone records a verdict whose evidence omits the ADRs that carry the accepted risks, and
passing the directory satisfies the existence check while pointing at nothing a reader opens.
