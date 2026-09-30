---
name: navi-skill-requirements-elicitation
description: >
  Use when turning a request into what is actually wanted, before any requirement is written —
  or when a spec is being reviewed and nobody can say who asked for a clause. Defines the
  elicitation record, the ACTOR-### entry including the actors who are not users, the six-prompt
  pass recorded even where it yields nothing, the ASSUM-### that states what would falsify it,
  the Q-### that is never closed by assumption, and the provenance line every requirement carries.
  Trigger phrases include: requirements elicitation, gather requirements, stakeholder interview,
  ambiguity, open question, assumption, actors, user journey, edge cases nobody mentioned,
  empty state, what did they actually ask for, workshop, discovery, G2 spec.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: business-analysis
  lifecycle_phases: [1, 2]
  used_by_agents: [navi-agent-business-analyst, navi-agent-product-owner]
  owner: OWNER_TBD
  tags: "business-analysis, requirements, elicitation, actors, assumptions, questions, g2"
  model: opus
---

## When to use

A request has arrived as a solution; a spec is about to be written and nobody has asked the
operator, the support agent or the auditor; an ambiguity has been found late and the question is
who decides; or G2 is about to be recorded and the open questions have to be `Q-###` rather than
guesses.

## Rules

1. Write the record at `delivery/changes/<name>/specs/<capability>/elicitation.md`, beside that
   capability's `spec.md`. `navi-delivery archive` folds `changes/<name>/specs/` into
   `delivery/specs/`, so the record of who was asked and what was assumed stays current truth
   alongside the spec it produced. `validate_traceability.py` globs only `**/spec.md`, so this
   file produces no spurious T-findings.
2. Number actors `ACTOR-###` and give each four fields: `Reaches the system by`, `Wants`,
   `Consulted`, `Harmed by getting it wrong`. `Consulted` names a person and a date, or reads
   `not consulted — <reason>`. An actor list with no consultation dates is a list of guesses
   about people who were available to ask.
3. Include the actors who are not users. The operator who is paged, the support agent who
   receives the complaint, the auditor who reads the record, the downstream system that consumes
   the output, and the person who has to undo it are five actors who appear in no user journey
   and produce most of the requirements that were missing at G6.
4. Run the six-prompt pass per capability and record every prompt, including those that yield
   nothing, as `none` with the reason: **empty state** (nothing exists yet), **concurrent
   action** (two actors at once), **partial failure** (one half succeeded), **permission and
   visibility** (who must not see it), **volume and growth** (what happens at ten times the
   size), and **exit** (deletion, export, off-boarding, the end of the record's life). A prompt
   left unmentioned cannot be told apart from a prompt nobody asked.
5. Never close a gap by assumption. An unanswered question becomes a `Q-###` with the person who
   can answer it and a by-when. `references/gates.md`'s G2 exit criterion requires open
   questions recorded as `Q-###` rather than resolved by assumption — recorded is the bar, not
   answered.
6. Number every assumption `ASSUM-###` and state what would falsify it, as an observation
   somebody could go and make. An assumption with nothing that would disprove it is a belief,
   and it will be defended rather than checked.
7. Record a solution a stakeholder states as an `ASSUM-###`, never as a requirement, and work
   back to the outcome it was meant to produce. The solution survives as one option under that
   outcome; writing it in as the requirement makes every later alternative a change request.
8. Give every statement a provenance: who said it and when. A spec clause that cannot be traced
   to a person cannot be re-checked with them when it turns out to be wrong, and the clause that
   turns out to be wrong is always the one nobody remembers agreeing to.
9. Record both sides of a conflict and escalate it. Reconciling two stakeholders' requirements
   silently makes a product decision inside a specification, where nobody is looking for one.
10. Quantify every word that admits a range — `quickly`, `most`, `large`, `regularly`, `secure`,
    `soon` — by asking what number is meant. Where the number cannot be obtained, the word
    becomes a `Q-###`, not a criterion. Two readers of `quickly` build different systems and
    both believe they complied.
11. Elicit the negative as well as the positive: what must not happen, and who must not see
    what. These become acceptance criteria and, at Phase 3, the assets in the threat model.
12. Hand the non-functional categories to `navi-skill-non-functional-requirements` rather than
    improvising them here. That skill runs the nine-category pass; this one finds out who to ask
    and records what they said.
13. Carry a `**Source:**` line into the spec for every `REQ-###`, directly under
    `navi-skill-spec-authoring`'s `**Priority:**` line: `Elicited from ACTOR-###, <date>` or
    `Inferred — ASSUM-###`. A requirement nobody stated is legitimate and must be
    visibly inferred, so a reader can tell a decision that was taken from one that was made by
    default.
14. Keep a requirement that depends on an unanswered question out of the delta spec, or write it
    against a named `ASSUM-###` with the criterion stated in the assumption's terms. Both are
    honest; a requirement quietly written as though the question were answered is not.
15. Close every `Q-###` in place, recording the answer, the answerer and the date, and revisit
    what it blocked. A question answered in a meeting and nowhere else is an open question with
    a false memory attached.
16. Re-elicit when the proposal's committed outcome changes. The actors who matter follow the
    outcome, and a record assembled for a different outcome consulted a different set of people.
17. Write the record on every lane. `cli/lib/lanes.js` enforces G2 on all four lanes; on
    `hotfix` it is deferred and recorded retroactively within 48 hours under
    `navi-skill-waivers-and-deferrals`, which means the record is written after the fix and
    before the waiver expires, not never.

## Decision table

| Observed condition | Required action |
|---|---|
| The request names a solution | Record it as `ASSUM-###` and work back to the outcome it was for |
| The actor list is only end users | Add the operator, support, the auditor, the downstream consumer and whoever undoes it |
| An actor has no consultation date | Consult them, or write `not consulted — <reason>` |
| A prompt in the six-prompt pass was not asked | Ask it, and record `none` with a reason where it yields nothing |
| A gap is about to be filled with a sensible guess | Make it a `Q-###` with a person and a by-when |
| An assumption has nothing that would disprove it | Rewrite it as an observation somebody could make, or drop it |
| A clause has no stated source | Attach who said it and when, or mark it inferred |
| Two stakeholders want opposite things | Record both and escalate; never reconcile inside the spec |
| A requirement says `quickly`, `most` or `secure` | Ask for the number; where none is available it is a `Q-###` |
| Nobody has been asked what must not happen | Elicit the negative; it becomes criteria and, at Phase 3, threats |
| A non-functional category is being invented here | Hand it to `navi-skill-non-functional-requirements` |
| A `REQ-###` has no provenance line | Add `**Source:** Elicited from ACTOR-###, <date>` or `Inferred — ASSUM-###` |
| A requirement depends on an open question | Keep it out of the delta, or write it against a named `ASSUM-###` |
| A `Q-###` was answered in a meeting | Record the answer, the answerer and the date, and revisit what it blocked |
| The proposal's outcome changed | Re-elicit; a different outcome has a different set of actors |
| The lane is `hotfix` | The record is written retroactively within 48 hours, not skipped |

## Template

Copy into `delivery/changes/<name>/specs/<capability>/elicitation.md`:

```markdown
# Elicitation — theme

Capability: `theme`. Spec: `./spec.md`. Proposal outcome: KPI-001 in
`delivery/changes/theme-persistence/proposal.md`.

## Actors

### ACTOR-001 — Returning end user

- **Reaches the system by:** the web shell, any browser, unauthenticated first render then
  authenticated
- **Wants:** the appearance they last chose, without choosing it again
- **Consulted:** Priya Raman on their behalf from 214 support contacts tagged
  `theme/appearance`, 2026-09-18. Not interviewed directly.
- **Harmed by getting it wrong:** a flash of the wrong theme on every visit; for
  light-sensitive users this is the reason the preference exists

### ACTOR-004 — On-call operator

- **Reaches the system by:** alerts and runbooks; never the UI
- **Wants:** to be able to tell a theme fault from a store outage without reading source
- **Consulted:** Ana Costa, 2026-09-19
- **Harmed by getting it wrong:** paged at 04:00 for a cosmetic fault, or not paged for a
  render failure. Produced REQ-015 (the fallback must be observable in the response) — which no
  end-user journey would have produced.

### ACTOR-005 — Support agent

- **Reaches the system by:** the support console, reading a user's stored preference
- **Wants:** to see what the user's stored preference actually is, to answer "it forgot again"
- **Consulted:** Dan Okafor, 2026-09-19
- **Harmed by getting it wrong:** every contact escalates to engineering. Produced REQ-016.

### ACTOR-006 — Data protection reviewer

- **Reaches the system by:** the retention register and the data contract
- **Wants:** to know whether a theme preference is personal data and how long it is kept
- **Consulted:** not consulted — the reviewer is on leave until 2026-10-06. Q-009 records the
  question; REQ-017 is written against ASSUM-003 rather than as though the answer were known.
- **Harmed by getting it wrong:** an unregistered retention of an attribute tied to a user id

### ACTOR-007 — `mobile-shell`, downstream consumer

- **Reaches the system by:** CONTRACT-001, the session payload
- **Wants:** not to break when a field is added
- **Consulted:** Dan Okafor, 2026-09-26
- **Harmed by getting it wrong:** a shipped mobile release that cannot parse the session

## Six-prompt pass

| Prompt | What it produced | If none, why |
|---|---|---|
| Empty state | REQ-013 — no stored preference and no header | — |
| Concurrent action | REQ-014 — two tabs writing; last write wins, and the user is the same person | — |
| Partial failure | REQ-015 — store unreachable at render; fall back to the header, and make the fallback visible to ACTOR-004 | — |
| Permission and visibility | REQ-016 — a support agent may read a preference and may not write one | — |
| Volume and growth | none — the preference is one row per user and the user table's growth is already contracted in DC-001. Asked of Dan Okafor 2026-09-19; there is no threshold at which this changes shape. |
| Exit | Q-009 — what happens to the preference when the account is deleted, and is it personal data at all | — |

## Assumptions

### ASSUM-001 — The stored preference is the user's current intent

- **States:** a preference stored more than twelve months ago still reflects what the user wants
- **Falsified by:** a measurable rate of users who change the theme within one session of a
  first render that used a preference older than twelve months. If that rate exceeds the
  baseline switch rate of 0.071, the assumption is wrong.
- **Source:** inferred; nobody stated it. Recorded because REQ-011 depends on it.

### ASSUM-003 — A theme preference is not personal data on its own

- **States:** `theme` tied to a user id is a preference attribute rather than a special category
- **Falsified by:** the data protection reviewer's answer to Q-009. This is an assumption with a
  known answerer and a date, not a judgement.
- **Source:** inferred, pending Q-009. REQ-017's criterion is written in this assumption's
  terms and is revisited when Q-009 closes.

### ASSUM-005 — Preference-store growth follows the user table's

- **States:** the preference store grows at the user table's contracted rate and not faster,
  because the row count is one per user
- **Falsified by:** a measured ratio of preference rows to user rows above 1.0 over any month.
  A per-device override would break it, which is why REQ-028 records that as a `Won't`.
- **Source:** inferred; Dan Okafor confirmed the contracted growth rate on 2026-09-19 but not
  the one-row-per-user assumption, which is this change's own. REQ-022 cites it.

### ASSUM-004 — "Instant" means within first paint

- **States:** the stakeholder's word `instantly` means before the first paint, not merely
  sub-second
- **Falsified by:** Priya Raman saying otherwise. Asked 2026-09-18; answered as first paint, so
  this assumption is now closed and REQ-011's criterion carries the number rather than the word.
- **Source:** Priya Raman's phrasing on 2026-09-18, quantified on the same call

## Open questions

| Id | Question | Who can answer | By | Blocks |
|---|---|---|---|---|
| Q-009 | Is a theme preference personal data, and what is its retention on account deletion? | the data protection reviewer | 2026-10-09 | REQ-017, which is written against ASSUM-003 until it closes |

## Answered questions

| Id | Question | Answer | Answered by | Date |
|---|---|---|---|---|
| Q-007 | Does "instantly" mean before first paint? | Yes — before first paint; a sub-second correction is the defect being reported | Priya Raman | 2026-09-18 |

Q-007's answer is what turned `instantly` into REQ-011's `AC-011`. The word is not in the spec.

## What must not happen

- A user's preference must not be readable by another user — elicited from ACTOR-005, becomes
  AC-018 and, at Phase 3, an asset in the threat model
- A support agent must not be able to change a preference — ACTOR-005, becomes AC-019
- The mobile shell must not break on an added field — ACTOR-007, becomes CONTRACT-001's
  compatibility clause

## Conflicts escalated

| Between | The conflict | Escalated to | Outcome |
|---|---|---|---|
| ACTOR-005 and ACTOR-006 | Support wants to read any user's preference; the reviewer's position may make that a disclosure | Priya Raman, 2026-09-19 | Held pending Q-009; REQ-016 is written for read-only access by an authenticated agent with an audit record, which both positions permit |
```

The provenance line each requirement carries in `spec.md`:

```markdown
### REQ-015 — The theme resolver's fallback is visible in the response
**Priority:** Must
**Source:** Elicited from ACTOR-004, 2026-09-19

Where the preference store cannot be read within its budget, the resolver uses the request's
`Sec-CH-Prefers-Color-Scheme` header and the response states that it did so.

#### AC-015
Given the preference store is unavailable,
when a first render is requested with `Sec-CH-Prefers-Color-Scheme: dark`,
then the document renders with `data-theme="dark"` and the response carries
`x-theme-source: header`.
Implements: REQ-015

### REQ-017 — A stored preference is removed when the account is removed
**Priority:** Should
**Source:** Inferred — ASSUM-003

#### AC-017
Given a user account has been deleted,
when the preference store is read for that user id,
then no row is returned.
Implements: REQ-017
```

`**Source:**` is the provenance line. `navi-skill-spec-authoring` owns the rest of the shape —
the heading, `**Priority:**`, the Given/When/Then criterion and `Implements:` — and this skill
adds only the one line that says where the requirement came from.

## Checklist

- [ ] `elicitation.md` sits beside `spec.md` under `changes/<name>/specs/<capability>/`
- [ ] Every `ACTOR-###` carries all four fields
- [ ] The actors who are not end users are present: operator, support, auditor, consumer, undoer
- [ ] Every actor is consulted with a date, or says `not consulted — <reason>`
- [ ] All six prompts appear in the pass, with `none` and a reason where empty
- [ ] Every gap is a `Q-###` with a person and a by-when, not a guess
- [ ] Every `ASSUM-###` states what would falsify it, as an observation someone could make
- [ ] Every stakeholder-stated solution is an `ASSUM-###`, not a requirement
- [ ] Every statement has a source: who said it and when
- [ ] Both sides of every conflict are recorded and escalated
- [ ] No range word survives into a criterion; each is a number or a `Q-###`
- [ ] What must not happen is elicited and recorded
- [ ] Every `REQ-###` in the spec carries a `**Source:**` line — `Elicited from ACTOR-###` or `Inferred — ASSUM-###`
- [ ] No requirement is written as though an open question were answered
- [ ] Every closed `Q-###` records its answer, answerer and date
- [ ] On `hotfix`, the record is written retroactively within 48 hours

## Anti-patterns

**The solution written in as the requirement.** `REQ-004: add a dropdown to the settings page.`
Every later alternative is now a change request, and the outcome the dropdown was for was never
written down. Record the dropdown as an assumption under the outcome.

**End users only.** Four actors, all of them people using the product. The operator's fallback
visibility, the support agent's read access and the downstream consumer's compatibility clause
are all missing, and all three surface at G6. Ask the five who are not users.

**The sensible guess.** Nobody knew what happens on account deletion, so the spec says the
preference is deleted with the account, which sounds right. It contradicts the retention
register. Make it a `Q-###`.

**The unfalsifiable assumption.** `ASSUM-002: users value consistency.` Nothing would disprove
it, so it is never checked and is quoted in every later argument. State the observation that
would settle it.

**`Quickly`.** The spec says the preference applies quickly. The developer reads sub-second, the
stakeholder meant before first paint, and the difference is the entire defect being fixed.
Quantify it, or make it a question.

**The clause from nowhere.** A requirement everyone assumes came from the customer. It came from
a whiteboard, nobody can confirm it, and it costs three weeks. Attach a `**Source:**` line with
a name and a date.

**The silent reconciliation.** Support wants read access and the privacy position may forbid it,
so the analyst writes something in between. A product decision has been made inside a spec, by
the person least placed to make it. Record both and escalate.

**The question answered in a meeting.** Q-009 was resolved verbally in October. In January
nobody can say what was decided, and the requirement it blocked shipped on a memory. Record the
answer in place, with the answerer.

## Validation

```bash
CHANGE=<name>
for E in $(find delivery/changes/$CHANGE/specs -name elicitation.md 2>/dev/null); do
  D=$(dirname "$E"); S="$D/spec.md"

  # Every actor carries all four fields
  for id in $(grep -o 'ACTOR-[0-9]\{3,\}' "$E" | sort -u); do
    body=$(awk -v id="$id" '$0 ~ "^### " id " " {on=1; next} /^### /{on=0} on' "$E")
    [ -n "$body" ] || { echo "$id: named in the file but has no '### $id — …' entry"; continue; }
    for k in "Reaches the system by" Wants Consulted "Harmed by getting it wrong"; do
      printf '%s\n' "$body" | grep -q "\*\*$k:\*\*" || echo "$id: missing $k"
    done
    # Read the whole Consulted field, not its first line: these values wrap, and a
    # single-line grep silently reports a dated consultation as undated.
    printf '%s\n' "$body" \
      | awk '/^- \*\*Consulted:\*\*/{on=1;print;next} /^- \*\*/{on=0} on' \
      | grep -qE '[0-9]{4}-[0-9]{2}-[0-9]{2}|not consulted' \
      || echo "$id: Consulted names neither a date nor 'not consulted — <reason>'"
  done

  # All six prompts appear in the pass
  for p in "Empty state" "Concurrent action" "Partial failure" "Permission and visibility" \
           "Volume and growth" "Exit"; do
    awk '/^## Six-prompt pass$/{on=1;next} /^## /{on=0} on' "$E" | grep -q "^| $p " \
      || echo "$E: prompt '$p' is not in the pass"
  done

  # Every assumption states what would falsify it
  for id in $(grep -o 'ASSUM-[0-9]\{3,\}' "$E" | sort -u); do
    body=$(awk -v id="$id" '$0 ~ "^### " id " " {on=1; next} /^### /{on=0} on' "$E")
    [ -n "$body" ] || continue
    printf '%s\n' "$body" | grep -q '\*\*Falsified by:\*\*' || echo "$id: no 'Falsified by' line"
  done

  # Every open question has an answerer and a by-when
  awk '/^## Open questions$/{on=1;next} /^## /{on=0}
       on && /^\| Q-/ { split($0,c,"|");
         if (c[4] ~ /^[[:space:]]*$/) print "open question with nobody to answer it: " c[2];
         if (c[5] !~ /[0-9]{4}-[0-9]{2}-[0-9]{2}/) print "open question with no by-when: " c[2] }' "$E"

  # Every answered question records its answerer and date
  awk '/^## Answered questions$/{on=1;next} /^## /{on=0}
       on && /^\| Q-/ { split($0,c,"|");
         if (c[5] ~ /^[[:space:]]*$/ || c[6] !~ /[0-9]{4}-[0-9]{2}-[0-9]{2}/)
           print "answered question with no answerer or date: " c[2] }' "$E"

  # Every REQ in the spec carries a provenance line
  [ -f "$S" ] && for r in $(grep -o 'REQ-[0-9]\{3,\}' "$S" | sort -u); do
    awk -v id="$r" '$0 ~ "^### " id " " {on=1; next} /^### /{on=0} on' "$S" \
      | grep -qE '\*\*Source:\*\* *(Elicited from ACTOR-[0-9]{3,}|Inferred — ASSUM-[0-9]{3,})' \
      || echo "$r: no '**Source:** Elicited from ACTOR-###' or 'Inferred — ASSUM-###' line"
  done

  # No range word survived into a criterion. The boundary is written as a padded
  # non-alphanumeric class, not as \< \> — those are a GNU extension that the awk shipped
  # with macOS matches never, so the check would pass silently on every input.
  [ -f "$S" ] && awk '/^#### AC-/{on=1} /^### /{on=0}
       on { p = " " $0 " ";
         if (p ~ /[^[:alnum:]](quickly|fast|slow|most|large|small|regularly|soon|secure|reliable)[^[:alnum:]]/)
           print "an acceptance criterion contains an unquantified range word: " $0 }' "$S"

  # Every open question that blocks a requirement is reflected in the spec
  awk '/^## Open questions$/{on=1;next} /^## /{on=0}
       on && /^\| Q-/ { split($0,c,"|"); if (c[6] ~ /REQ-/) { print c[2] "|" c[6] } }' "$E" \
  | while IFS='|' read -r q blocks; do
      for r in $(printf '%s' "$blocks" | grep -o 'REQ-[0-9]\{3,\}'); do
        [ -f "$S" ] || continue
        awk -v id="$r" '$0 ~ "^### " id " " {on=1; next} /^### /{on=0} on' "$S" \
          | grep -qE 'ASSUM-[0-9]{3,}' \
          || echo "$r is blocked by$q but is written in the spec with no ASSUM-### named"
      done
    done
done
```

Each command prints nothing when the rule holds. The provenance loop is the one to run before
G2: it is the only mechanical difference between a spec whose clauses can be re-checked with the
people who asked for them and one that has to be re-derived from scratch.
