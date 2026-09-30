---
name: navi-skill-waivers-and-deferrals
description: >
  Use when an enforced gate cannot be met and delivery must proceed anyway, or when a hotfix
  defers G2. Defines the waiver row format, the mandatory reason and future expiry, what a
  waiver may and may not cover, and how an expired waiver is settled.
  Trigger phrases include: waiver, waive a gate, waivers.md, defer a gate, deferral, expiry,
  --waive, --expires, temporary exception, retroactive spec, hotfix G2, ship without.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: lifecycle-method
  lifecycle_phases: [1, 2, 3, 4, 5, 6, 7, 8, 9]
  used_by_agents: [navi-agent-orchestrator, navi-agent-devops-engineer, navi-agent-mlops-engineer, navi-agent-product-owner, navi-agent-qa-engineer, navi-agent-security-engineer]
  owner: OWNER_TBD
  tags: "adlc, waivers, governance, risk"
  model: sonnet
---

## When to use

An enforced gate's exit criteria are not met and the change must still move, or a `hotfix`
change needs its deferred G2 recorded.

## Rules

1. Record every waiver through `navi-delivery gate <G#> --waive "<reason>" --expires <YYYY-MM-DD>`.
   The command writes the `waivers.md` row, sets the gate to `waived`, clears that gate's own
   stale entry, and appends the event. Hand-editing `waivers.md` does none of those things.
2. A waiver always carries a reason. `--waive` with no value is refused, and a value that
   looks like a flag is refused with it.
3. A waiver always carries an expiry. `--expires` must be a real calendar date in `YYYY-MM-DD`
   form, strictly after today in UTC. `2026-02-30` is refused as not a real date; today's date
   is refused as not in the future.
4. Set the expiry to the date by which the gate will genuinely be met, not to the furthest
   date that will be accepted. An expiry chosen for convenience is how a temporary exception
   becomes permanent.
5. Write the reason as the specific shortfall and the specific risk accepted. `Deadline` is
   not a reason. `AC-011 empty-state path is untested; risk is a blank settings panel for
   users with no saved preference` is a reason.
6. Keep the reason on one line. A newline is refused outright, because the reason becomes a
   single `waivers.md` table row. A literal `|` is escaped automatically and is safe to use.
7. Waive only a gate the active lane enforces. A gate outside the lane's set is refused by the
   CLI — that gate is skipped, and a skipped gate is not waived.
8. Never waive a human checkpoint. Spec sign-off, architecture sign-off, release approval and
   the incident/rollback decision are human decisions; a waiver is not a substitute for one.
   See `navi-skill-human-checkpoints`.
9. A `hotfix` defers G2. Record it as a waiver with a reason naming the incident and an expiry
   no more than two days out, and write the retroactive spec before that date.
10. Settle a waiver before its expiry by re-recording the gate: `gate <G#> --pass --evidence <path>`.
    The event carries `previous: waived`, so the log shows the exception closing.
11. Treat an expired, unsettled waiver as a blocking defect. Stop new work on the change and
    settle the gate. A second waiver for the same gate is legal only when its reason names,
    in its own text, the specific fact that changed since the first — the new blocker, the new
    date's cause. A reason that repeats the first waiver's, or that says only that more time is
    needed, is a renewal, and a renewal removes the one control a waiver has. Two waivers for
    one gate whose reasons do not differ on their face is a defect a reviewer can catch by
    reading `waivers.md`, and the Validation script below flags it.
12. Fill the `Approved by` column by hand after the CLI writes the row. The CLI leaves it
    empty; a waiver nobody owns is a waiver nobody will settle.

## Decision table

| Observed condition | Required action |
|---|---|
| Exit criteria unmet, risk understood and accepted, date known | `gate <G#> --waive "<shortfall + risk>" --expires <date>` |
| Exit criteria unmet and the risk is not yet understood | Record `--fail`; rework, do not waive |
| Reason would be "deadline", "no time", "later" | Not a reason — name the shortfall and the risk accepted |
| No date by which the gate will be met is known | Do not waive; the waiver has no exit and will not close |
| Gate is a human checkpoint | Block and escalate; never waive |
| Gate is outside the lane's set | Nothing to waive — the gate is skipped |
| `hotfix` G2 | Waive naming the incident, expiry within two days, write the retroactive spec |
| Waiver expiry is today or in the past | Refused by the CLI — pick a real future date |
| Waiver has expired and the gate is still unmet | Blocking defect — settle the gate before any new work |
| Waiver reason contains a newline | Refused — rewrite as one line |
| Gate now genuinely passes | `gate <G#> --pass --evidence <path>`; the event records `previous: waived` |

## Template

Recording a waiver:

```bash
navi-delivery gate G6 --waive \
  "AC-011 empty-state path has no automated test; risk accepted is a blank settings panel for users with no saved preference, affecting new sign-ups only" \
  --expires 2026-10-10
# => G6 waived until 2026-10-10
```

The row the CLI appends to `delivery/.adlc/waivers.md`:

```markdown
| Date | Change | Gate | Reason | Expires | Approved by |
|------|--------|------|--------|---------|-------------|
| 2026-09-28 | theme-persistence | G6 | AC-011 empty-state path has no automated test; risk accepted is a blank settings panel for users with no saved preference, affecting new sign-ups only | 2026-10-10 | |
```

Fill `Approved by` by hand with the name of the person who accepted the risk.

The deferred G2 on a hotfix, on an incident opened 2026-09-28:

```bash
navi-delivery propose checkout-500s --lane hotfix
navi-delivery gate G2 --waive \
  "INC-2031: checkout returning 500 for all card payments; spec written retroactively within 48h" \
  --expires 2026-09-30
navi-delivery gate G6 --pass --evidence delivery/changes/checkout-500s/evidence/g6-tests.tap
navi-delivery gate G7 --pass --evidence delivery/changes/checkout-500s/evidence/g7-deploy.json
```

Settling it before the expiry:

```bash
navi-delivery gate G2 --pass --evidence delivery/changes/checkout-500s/specs/checkout/spec.md
# => G2 re-recorded: waived -> pass (evidence: ...)
```

The event log then shows the exception opening and closing:

```json
{"ts":"2026-09-28T09:14:02.110Z","change":"checkout-500s","gate":"G2","verdict":"waived","reason":"INC-2031: ...","expires":"2026-09-30"}
{"ts":"2026-09-29T16:40:55.804Z","change":"checkout-500s","gate":"G2","verdict":"pass","evidence":"delivery/changes/checkout-500s/specs/checkout/spec.md","previous":"waived"}
```

## Checklist

- [ ] The waiver was recorded through the CLI, not written into `waivers.md` by hand
- [ ] The reason names the specific shortfall and the specific risk accepted
- [ ] The reason is one line and is not "deadline" in longer words
- [ ] The expiry is a real calendar date, strictly in the future, and is the date the gate
      will actually be met
- [ ] The gate is enforced by the active lane
- [ ] The gate is not a human checkpoint
- [ ] `Approved by` has been filled in with a named person
- [ ] A hotfix G2 waiver expires within two days and names the incident
- [ ] Every waiver on this change is either settled or unexpired

## Anti-patterns

**Waiver as a synonym for pass.** `gate G6 --waive "tested manually" --expires 2027-12-31`.
An expiry fifteen months out with no plan to settle it is a permanent exception wearing a
temporary label. If the manual test is the verification, record `--pass` with the manual test
report as evidence. If it is not, pick the date the automated test lands.

**Reason that names no risk.** `--waive "not enough time"`. Somebody reading `waivers.md` in
six weeks cannot tell what is unprotected. Name the shortfall and what could go wrong.

**Hand-written row.** Adding a line to `waivers.md` directly. `state.gates` still shows the
gate pending, `archive` still refuses, the stale entry is never cleared, and `events.jsonl`
has no record. Use the CLI.

**Rolling expiry.** Re-waiving the same gate with a later date each time it comes due, with
the same reason. The expiry is the entire control on a waiver; renewing it unchanged removes
the control. Settle the gate, or escalate the fact that it is not being settled.

**Waived human checkpoint.** `gate G7 --waive "approver on leave" --expires ...`. Release
approval is a human decision and the framework blocks on it by design. Find another named
approver or wait; do not route around the person.

**Waiving a skipped gate.** `gate G4 --waive ...` on an `express` change. The CLI refuses with
`G4 is not in lane 'express'`. A gate the lane does not enforce is absent, not excepted.

**Expiry chosen to be accepted.** `--expires` set to tomorrow because the command demanded a
future date, with no intention of settling by then. The date is a commitment. Pick one the
change can keep.

## Validation

```bash
navi-delivery status                     # shows each gate as pass / fail / waived / pending
cat delivery/.adlc/waivers.md   # every waiver, its reason, expiry and approver
```

List every waiver that is still live and has a problem. A waiver whose gate has since been
re-recorded as `pass` is history, not a finding, so the script reads `events.jsonl` to learn
each gate's current verdict and reports only the ones still in force:

```bash
python3 - <<'PY'
import datetime, json, pathlib, sys

today = datetime.date.today()
adlc = pathlib.Path("delivery/.adlc")

# Current verdict per (change, gate) is the last event recorded for it. A
# waiver whose gate was later re-recorded as pass is settled: it stays in
# waivers.md as the record of the exception, and is not a live finding.
current = {}
events = adlc / "events.jsonl"
if events.exists():
    for line in events.read_text().splitlines():
        if line.strip():
            e = json.loads(line)
            if e.get("gate"):
                current[(e.get("change"), e["gate"])] = e.get("verdict")

# Parse the table by position, never by looking for header words: the first
# two table lines are the header and its separator, whatever they contain.
table = [l for l in (adlc / "waivers.md").read_text().splitlines() if l.lstrip().startswith("|")]
rows = table[2:]

problems, seen_reasons = [], {}
for line in rows:
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    if len(cells) < 6:
        problems.append("malformed waiver row: " + line.strip())
        continue
    _date, change, gate, reason, expires, approver = cells[:6]

    key = (change, gate)
    if current.get(key) != "waived":
        continue  # settled or superseded: historical record, not a live finding

    if not approver:
        problems.append(f"{change} {gate}: no approver recorded")
    try:
        if datetime.date.fromisoformat(expires) < today:
            problems.append(f"{change} {gate}: expired {expires}, still unsettled")
    except ValueError:
        problems.append(f"{change} {gate}: unparseable expiry {expires!r}")

    prior = seen_reasons.setdefault(key, [])
    if reason in prior:
        problems.append(f"{change} {gate}: re-waived with an unchanged reason (a renewal, not a new waiver)")
    prior.append(reason)

for problem in problems:
    print(problem)
print(f"{len(problems)} live waiver problem(s)")
sys.exit(1 if problems else 0)
PY
```

A waiver whose gate has since been settled still shows in `waivers.md` — that is the record of
the exception, not a live finding. Confirm the current verdict with `navi-delivery status` and
the closing event in `delivery/.adlc/events.jsonl`.
