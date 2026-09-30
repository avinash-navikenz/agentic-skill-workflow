---
name: navi-skill-interface-contracts
description: >
  Use when a design draws a boundary — a call, an event, a shared table, a file drop — and
  the two sides need something to build against, or when a change to an existing interface
  has to be classified as breaking or not. Defines the CONTRACT-### entry, its required
  fields, the breaking-change test, and the versioning and retirement rules.
  Trigger phrases include: interface contract, boundary, breaking change, backward
  compatible, consumer, producer, schema change, deprecate an interface, contract test.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: architecture
  lifecycle_phases: [3, 5]
  used_by_agents: [navi-agent-architect, navi-agent-fullstack-developer]
  owner: OWNER_TBD
  tags: "architecture, contracts, boundaries, compatibility, versioning"
  model: opus
---

## When to use

A design names a boundary between components, an existing interface is being changed, or a
consumer needs something to build against before the producer exists.

## Rules

1. Write one `CONTRACT-###` entry per boundary in `delivery/changes/<name>/design.md` under the
   `## Interface contracts` heading, numbered sequentially within the change.
   `templates/change/design.md` ships that heading, so fill it in place rather than appending a
   second one. G3 reads the design for a contract at each boundary it draws.
2. Treat as a boundary anything crossed by two components with different deploy cadences or
   different on-call owners: a synchronous call, a published event, a shared database table,
   a file drop, or a library whose callers are outside this change. A shared table read by
   another component is an interface whether or not anyone called it one.
3. Give every contract all nine fields: `Kind`, `Producer`, `Consumers`, `Shape`, `Errors`,
   `Timing`, `Compatibility`, `Owner`, `Serves`. A contract missing `Errors` specifies only
   the path that works.
4. List named consumers, or write `Consumers: none outside this change`. The list is what the
   blast radius at G7 is computed from, and what decides who is told before a merge.
5. Name one person in `Owner`. Not a team, not an agent, not a squad rotation.
6. State behaviour for all four failure classes in `Errors`: unavailable, slow past the
   timeout, malformed payload, and duplicate delivery. A contract silent on duplicates is one
   whose consumer will invent an answer under retry.
7. State a timeout and a retry policy in `Timing` for every synchronous contract, and state
   whether the operation is idempotent. Retries are forbidden on a non-idempotent operation:
   add an idempotency key to the contract, or state `Retries: none`.
8. Classify a change with the breaking-change test. A change is **breaking** when an existing
   consumer that was correct before the change can be incorrect after it without changing its
   own code. Removing an output field, adding a required input, narrowing a validation range,
   changing a type, adding a value to an enumeration a consumer switches on exhaustively, and
   changing the meaning of an existing value are all breaking. Adding an optional output
   field, adding a new operation, and widening a validation range are not.
9. Ship a breaking change as a new version alongside the old one. Never change the meaning of
   an existing field, operation or event type in place: the consumer has no way to notice.
10. Give every superseded version a retirement date and a named consumer list in
    `Compatibility`. A deprecation with no date is a second interface maintained forever.
11. Write the contract before the implementation on both sides. The point of the artifact is
    that the consumer can build against it while the producer is still being written.
12. Name in `Shape` the automated test that fails when the contract is broken, and write that
    test before G5. A contract no test enforces is documentation, and documentation does not
    fail a build.
13. Announce every contract change to each named consumer through a
    `navi-skill-handoff-protocol` envelope with `kind: review` before the merge, not after.
14. Route the wire-level shape of an HTTP or RPC surface — resources, verbs, status codes,
    pagination, error bodies — to `navi-skill-api-design`. This skill owns what must be true
    at the boundary; that skill owns what the surface looks like.

## Decision table

| Observed change to an interface | Classification and required action |
|---|---|
| Adding an optional field to a response | Not breaking — no new version |
| Adding a new operation or event type | Not breaking — no new version |
| Widening a validation range (max 128 → 255) | Not breaking — no new version |
| Removing a response field any consumer reads | Breaking — new version, retirement date, tell each consumer |
| Adding a required request field | Breaking — new version; an optional field with a default is not |
| Narrowing a validation range (max 255 → 128) | Breaking — new version; existing valid payloads now fail |
| Changing a field's type, even `"1"` to `1` | Breaking — new version |
| Adding a value to an enumeration consumers switch on | Breaking — new version, or state the default branch in `Errors` |
| Changing what an existing value means | Breaking, and undetectable by the consumer — new version, never in place |
| Two components read the same table, one writes it | Declare the table as a `CONTRACT-###` with the writer as producer |
| A synchronous contract with no stated timeout | Add `Timing` with a timeout before G3 |
| Retries configured on a non-idempotent write | Add an idempotency key to the contract, or set `Retries: none` |
| A deprecated version with no retirement date | Set the date, or delete the old version now |
| `Consumers` is unknown | Find them before G3; an unknown consumer list makes the G7 blast radius a guess |

## Template

Fill the `## Interface contracts` section that `templates/change/design.md` ships into every
`delivery/changes/<name>/design.md`:

```markdown
## Interface contracts

### CONTRACT-001 — Session payload carries the theme preference

- **Kind:** synchronous HTTP call, internal
- **Producer:** `identity-service` (`GET /v1/session`)
- **Consumers:** `web-shell` (this change), `mobile-shell` (owner: Dan Okafor, told 2026-09-26)
- **Shape:** `contracts/session-v1.schema.json`; enforced by
  `test/contract/session-v1.spec.ts`, which fails on any field removal or type change
- **Errors:**
  - unavailable → 503 with `{"code":"session_unavailable"}`; consumer renders the light theme
    per AC-003 and logs one warning with the user id omitted
  - slow → consumer abandons at the timeout and takes the same path as unavailable
  - malformed → consumer treats an unparseable `theme` value as absent; it never throws
  - duplicate → the call is a read; repeated calls return the same payload
- **Timing:** timeout 400ms; `Retries: 1` on connection failure only; idempotent (read-only)
- **Compatibility:** `v1` is current. `theme` is optional in `v1` and absent means "no stored
  preference" — that meaning does not change in `v1`. A required `theme` would ship as
  `GET /v2/session`, with `v1` retired 90 days after the last consumer migrates.
- **Owner:** Priya Raman
- **Serves:** REQ-001, REQ-004

### CONTRACT-002 — theme.changed event

- **Kind:** published event, `theme.changed`, topic `user-preferences`
- **Producer:** `identity-service`
- **Consumers:** `analytics-ingest` (owner: Lena Marsh, told 2026-09-26)
- **Shape:** `contracts/theme-changed-v1.schema.json`; enforced by
  `test/contract/theme-changed-v1.spec.ts`
- **Errors:**
  - unavailable → the publish is buffered for 24h, then dropped with an ERROR log; the write
    to the user record does not roll back
  - slow → same as unavailable; the publish is never on the request path
  - malformed → the consumer dead-letters the message and alerts; it never blocks the topic
  - duplicate → every event carries `event_id`; the consumer deduplicates on it for 48h
- **Timing:** publish is asynchronous; `Retries: 5` with exponential backoff; idempotent by
  `event_id`
- **Compatibility:** `v1`. New optional fields may be added to `v1`. Removing `previous_theme`
  or adding a third value to `theme` ships as `theme.changed.v2` with `v1` retired 2027-01-31.
- **Owner:** Priya Raman
- **Serves:** REQ-004

### CONTRACT-003 — user_preferences table, read by reporting

- **Kind:** shared database table, `public.user_preferences`
- **Producer:** `identity-service` (sole writer)
- **Consumers:** `reporting-etl` (owner: Sam Idris, told 2026-09-26)
- **Shape:** columns `user_id uuid not null`, `theme text not null`, `updated_at timestamptz
  not null`; enforced by `test/contract/user-preferences-columns.spec.sql`
- **Errors:**
  - unavailable → reporting skips the run and alerts; it does not fall back to stale data
  - slow → the read is batched nightly, so a slow read delays the run rather than failing it
  - malformed → an unrecognised `theme` value is loaded as-is and counted, never coerced
  - duplicate → `user_id` is the primary key; a second row cannot exist
- **Timing:** not applicable (batch read); idempotent
- **Compatibility:** columns may be added. Dropping or renaming a column, or changing
  `theme` from text to an enum, is breaking and ships as a new view `user_preferences_v2`
  with the old view retired 90 days after `reporting-etl` migrates.
- **Owner:** Priya Raman
- **Serves:** REQ-004
```

## Checklist

- [ ] Every boundary the design draws has a `CONTRACT-###`
- [ ] Every shared table with a second reader is declared as a contract
- [ ] Every contract has all nine fields
- [ ] `Consumers` is a named list or an explicit "none outside this change"
- [ ] `Owner` is one person
- [ ] All four failure classes are answered in `Errors`
- [ ] Every synchronous contract states timeout, retries and idempotency
- [ ] No retry policy sits on a non-idempotent operation without an idempotency key
- [ ] Every breaking change ships as a new version, never in place
- [ ] Every deprecated version has a retirement date and a named consumer list
- [ ] Every contract names the test that fails when it is broken, and that test exists by G5
- [ ] Each named consumer received a `kind: review` handoff before the merge

## Anti-patterns

**The undeclared table.** Reporting reads `user_preferences` nightly and nobody wrote it
down, so the column rename ships on a Tuesday and the Wednesday report is empty. Declare the
table as `CONTRACT-003` with the writer as producer and reporting as a named consumer.

**Meaning changed in place.** `status: "pending"` starts meaning "queued" instead of
"awaiting approval". Every consumer keeps parsing successfully and every one of them is now
wrong. A meaning change is breaking; ship it as a new version.

**The happy-path contract.** A contract with a schema and no `Errors`. The first timeout
produces three different behaviours in three consumers, all of them invented at 3am. Answer
unavailable, slow, malformed and duplicate.

**Retry on a non-idempotent write.** `Retries: 3` on `POST /charges`. A slow response that
eventually succeeds bills the customer three times. Add an idempotency key to the contract,
or write `Retries: none`.

**The deprecation with no date.** `v1 is deprecated, please migrate.` Two years later both
versions are in production and every change costs twice. Write the retirement date and the
consumer list at the moment the new version ships.

**Consumers listed as a team.** `Consumers: the mobile team`. At G7 the blast radius is
"unknown" and at merge time nobody is told. Name the component and the person who owns it.

**Contract after implementation.** The producer ships, then the shape is written down from
the code. Whatever the code does is now the contract, including the parts that are accidents.
Write the contract first; the consumer's build against it is the review.

**Contract with no test.** A schema file nothing runs. The field is dropped in a refactor and
the build stays green until the consumer breaks in production. Name the test in `Shape` and
have it in place by G5.

## Validation

```bash
DESIGN=delivery/changes/<name>/design.md

# Every contract carries all nine fields
for id in $(grep -o 'CONTRACT-[0-9]\{3,\}' "$DESIGN" | sort -u); do
  for f in Kind Producer Consumers Shape Errors Timing Compatibility Owner Serves; do
    awk -v id="$id" '$0 ~ "^### " id " " {on=1; next} /^### /{on=0} on' "$DESIGN" | grep -q "\*\*$f:\*\*" \
      || echo "$id: missing $f"
  done
done

# Every Errors block answers all four failure classes
for id in $(grep -o 'CONTRACT-[0-9]\{3,\}' "$DESIGN" | sort -u); do
  for c in unavailable slow malformed duplicate; do
    awk -v id="$id" '$0 ~ "^### " id " " {on=1; next} /^### /{on=0} on' "$DESIGN" | grep -q "$c" \
      || echo "$id: no behaviour stated for '$c'"
  done
done

# Retries stated without idempotency
grep -n 'Retries: [1-9]' "$DESIGN" | while read -r line; do
  echo "$line" | grep -q 'idempotent' || echo "check idempotency: $line"
done

# Every contract test named in Shape exists in the repo
grep -oE '[A-Za-z0-9_./-]+\.(spec|test)\.[a-z]+' "$DESIGN" | sort -u | while read -r t; do
  test -e "$t" || echo "contract test missing: $t"
done
```

Each command prints nothing when the rule holds. The last one is the check that matters at
G5: a contract whose test does not exist is a contract nothing enforces.
