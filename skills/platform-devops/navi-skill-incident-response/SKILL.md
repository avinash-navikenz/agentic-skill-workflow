---
name: navi-skill-incident-response
description: >
  Use when something is wrong in production right now, when a hotfix has to reach users before
  the normal gates could be recorded, or when G9 asks for a postmortem whose insights are routed
  somewhere. Defines the severity scale drawn from observable impact, the incident commander
  role, the timeline record, the hotfix lane's deferred G2, the postmortem file the gate reads,
  and the rule that every INSIGHT-### goes to exactly one destination.
  Trigger phrases include: incident, outage, production is down, sev1, severity, page,
  incident commander, declare an incident, hotfix, emergency fix, rollback decision, timeline,
  postmortem, post-mortem, blameless, root cause, contributing cause, corrective action,
  INSIGHT, G9 feedback.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: platform-devops
  lifecycle_phases: [8, 9]
  used_by_agents: [navi-agent-devops-engineer, navi-agent-mlops-engineer]
  owner: OWNER_TBD
  tags: "devops, incident, severity, hotfix, postmortem, insights, g9"
  model: sonnet
---

## When to use

An alert has fired and the impact is user-visible; a fix has to reach production before the
lane's normal gates could be recorded; an incident has ended and the postmortem is due; or G9
is about to be recorded and its insights have to go somewhere.

## Rules

1. Declare from observable impact, never from cause. Severity is set by what a user cannot do
   and how many are affected, both stated as numbers, before anybody knows why. A severity
   argued from the suspected cause is re-argued every time the suspicion changes, and the
   response stalls while it is being re-argued.
2. Use exactly four severities and record the two observations that set it — the affected
   count and what they cannot do. `SEV1` a core capability is unusable for any user;
   `SEV2` a core capability is degraded, or unusable for a named subset; `SEV3` a non-core
   capability is affected, or a workaround exists and is published; `SEV4` no user impact and
   a control has failed. Re-declare when the observations change, and record the re-declaration
   with its time.
3. Name one incident commander, a person, at declaration. The commander decides and records;
   everyone else investigates. Two people deciding is the failure mode that turns a ten-minute
   rollback into an hour of discussion.
4. Restore first, diagnose second. Preserving evidence is a task the commander assigns, not a
   reason to leave users broken; capture what would be lost — logs, a heap dump, the failing
   pod, the offending rows — and then restore.
5. Roll back to the last known-good rather than forward-fixing, unless rollback is itself
   unavailable or risky, and record which was chosen and why. `delivery/changes/<name>/
   rollout.md` states both routes and their propagation times; a forward fix is a change
   written under pressure with no gate behind it.
6. Record the decision to roll back before the action where the sequence permits, and within
   the same hour where it does not. `navi-skill-human-checkpoints` makes the rollback call one
   of the four human checkpoints and puts it with the commander.
7. Keep a timeline in UTC with one row per event: detection, declaration, each decision, each
   action, and resolution. Record the detection source — which `ALERT-###` fired, or that a
   user reported it. An incident detected by a customer is a finding about the monitoring, and
   it is only visible if the source is written down.
8. Take the `hotfix` lane for a change that exists to end an incident. `cli/lib/lanes.js` gives
   `hotfix` the fixed set `G2, G6, G7, G9`: G2 is deferred and recorded retroactively within 48
   hours under `navi-skill-waivers-and-deferrals`, G6 and G7 are recorded before the fix
   reaches users, and G9 is mandatory. `navi-delivery gate` refuses any gate outside that set,
   so a hotfix has no G3, G5 or G8 to record and the design and build evidence is written into
   the postmortem instead.
9. Branch a hotfix from what is actually running, not from the default branch — the running
   digest is recorded in `delivery/changes/<name>/evidence/g7-release.md`. See
   `navi-skill-version-control-workflow` for the branch and the merge back.
10. Write the postmortem at `delivery/ops/postmortems/<name>.md`. `navi-delivery archive`
    creates a stub there only if the file does not already exist, and it creates it **after**
    the gates are settled — so on `full` and `hotfix`, where G9 is enforced, the postmortem
    must be written before G9 is recorded and archive's stub is never the one the gate read.
11. Name contributing causes, plural, and the control that failed. A single root cause is
    almost always the last change in a chain that several controls let through; naming only the
    last one produces a corrective action that prevents this incident and no other.
12. Never name a person as a cause. A person acting reasonably on the information available is
    a fact about the information, and the corrective action is to change what the information
    shows. An incident that ends in a person's name teaches everybody present to say less next
    time.
13. Number every learning `INSIGHT-###` and route each to exactly **one** destination: the
    product backlog as a candidate requirement, or a skill amendment as a pull request against
    a `navi-skill-*` file. `references/gates.md`'s G9 exit criterion says exactly one, because
    an insight routed to both is owned by neither. Name the target: the candidate's id, or the
    skill file.
14. Give every corrective action an owner and a date, and do not close the incident on the
    promise of one. An action with no owner is a sentence in a document nobody reads twice.
15. Compare the predicted outcome with the measured one and name the gap — G9's first exit
    criterion. For an incident this is the impact estimated at declaration against the impact
    measured afterwards, from the SLI: an incident consistently declared two severities below
    its measured impact is a finding about the severity scale.
16. Record the error budget the incident spent, from `delivery/ops/slo.md`. A budget spent to
    exhaustion is a fact the next release decision needs, not a reproach.
17. Archive only after G9. `navi-delivery archive` refuses unless every gate the lane enforces
    is `pass` or `waived` and nothing is stale, and `hotfix` enforces G9 — so an unwritten
    postmortem leaves the change permanently open, which is the correct behaviour.

## Decision table

| Observed condition | Required action |
|---|---|
| The severity is being argued from the suspected cause | Set it from the affected count and what they cannot do |
| Nobody has been named commander | Name one person; two deciders is the failure mode |
| Evidence would be lost by restoring | Assign the capture as a task, then restore — not instead of restoring |
| Both rollback and a forward fix are available | Roll back and record why; a forward fix has no gate behind it |
| Rollback is unavailable because the new path wrote unreadable data | Say so, and treat the migration as the incident's first corrective action |
| The rollback happened before it was recorded | Write the record the same hour, naming the commander |
| A customer reported it before an alert did | Record the detection source; it is a finding about the monitoring |
| The fix must ship now | Take `hotfix`: G2 deferred to within 48 hours, G6 and G7 before users, G9 mandatory |
| The hotfix is branched from the default branch | Re-branch from the running digest in the G7 release record |
| The postmortem does not exist and G9 is being recorded | Write it first; archive's stub is created after the gates, not before |
| A single root cause is named | Name the contributing causes and the control that failed |
| A person is named as a cause | Rewrite as what the information showed, and change that |
| An insight is routed to both the backlog and a skill | Pick one; G9 requires exactly one destination |
| A corrective action has no owner or no date | Add both, or delete it |
| The measured impact is two severities above the declared one | Record the gap; it is a finding about the scale, not about the responder |
| The change cannot be archived | Check the outstanding gate — `archive` refuses until every lane gate is settled |

## Template

Copy into `delivery/ops/postmortems/<name>.md`. `navi-delivery archive` writes a stub at this
path only when the file is absent, and only after the gates are settled — on `full` and
`hotfix` this file exists first:

```markdown
# Postmortem — theme-persistence-hotfix

- **Severity:** SEV2 at declaration, re-declared SEV1 at 09:12 UTC
- **Incident commander:** Ana Costa
- **Detected by:** ALERT-001 at 08:47 UTC (`delivery/ops/slo.md`, SLI-001)
- **Duration:** 08:47 – 09:34 UTC, 47 minutes
- **Lane:** `hotfix` — G2 deferred, G6 and G7 recorded before the fix reached users, G9 here

## Impact

| Observation | At declaration | Measured afterwards |
|---|---|---|
| Users affected | ~40,000 (estimated from the 5% wave) | 213,000 — the flag had already widened to 50% |
| What they could not do | First render took over 4s | First render failed entirely for 31,000 of them |
| SLI-001 | — | 0.71 over the incident window, against a 0.985 objective |

**Predicted against measured:** declared SEV2 on an estimate of 40,000 affected; the measured
figure was 213,000 and the failure was total rather than slow, which is SEV1. The gap is the
whole of the re-declaration, and INSIGHT-002 addresses its cause.

**Error budget:** 31,000 failed renders against a 28-day budget of 344,400 — 9.0% of the
window's budget, spent in 47 minutes.

## Timeline (UTC)

| Time | Event |
|---|---|
| 08:47 | ALERT-001 pages Ana Costa — 1-hour SLI-001 failure ratio 0.29 |
| 08:49 | Incident declared SEV2. Ana Costa commanding. |
| 08:52 | Runbook check 1: `rollout.md` shows ROLL-003 widened to 50% at 08:30 |
| 08:55 | Runbook check 2: origin 5xx rate normal; the fault is in the flagged path |
| 09:01 | Heap dump and 200 failing request traces captured to `s3://incident/2026-09-30/` |
| 09:04 | Decision, Ana Costa commanding: kill switch rather than digest rollback — the fault is behavioural and inside the flag, and the switch propagates in 30s against 3m 41s |
| 09:05 | `./flags set theme_persistence_v2=false --env production` |
| 09:12 | Re-declared SEV1: the measured affected count is 213,000, not 40,000 |
| 09:34 | SLI-001 back within objective for 15 consecutive minutes. Incident resolved. |
| 09:40 | Hotfix branched from the running digest `sha256:9b2c41e0...`, not from `main` |

## Contributing causes

1. The theme resolver dereferenced a null `prefers-color-scheme` header. Unit tests covered the
   two defined values and not the absent one.
2. ROLL-003's halt condition watched SLI-001 on the aggregate and on SLICE-003 and SLICE-005.
   The absent-header population is SLICE-003, and it did halt — 22 minutes after the widening,
   because the halt window was 2 hours and the ramp widened on a schedule rather than on a
   completed soak.
3. The wave widened automatically at a fixed time rather than on the previous wave's soak
   completing, so the exposure grew while the earlier wave's signal was still accumulating.

**The control that failed:** the halt condition existed, was bound to the right slice and fired
correctly. What failed is that exposure widened on a clock rather than on the halt condition
having had time to evaluate the previous wave.

## Insights

- **INSIGHT-001** An absent optional header is a distinct input class, and a test suite that
  covers a field's defined values has not covered the field.
  - Destination: skill amendment
  - Target: `skills/quality-engineering/navi-skill-test-design/SKILL.md` — the absent-value case
    joins the boundary set as a required derivation
- **INSIGHT-002** A rollout wave that widens on a schedule can outrun its own halt condition's
  evaluation window.
  - Destination: skill amendment
  - Target: `skills/platform-devops/navi-skill-progressive-delivery/SKILL.md` — a wave promotes
    on the previous wave's soak completing, never on a clock
- **INSIGHT-003** The severity scale's affected-count input was read from the wave plan rather
  than from the live exposure, and the wave plan was 20 minutes out of date.
  - Destination: product backlog
  - Target: CAND-041, a live exposure figure surfaced beside the alert

## Corrective actions

| Action | Owner | By |
|---|---|---|
| Absent-header case added to the theme resolver suite | Sam Idowu | 2026-10-03 |
| Wave promotion gated on soak completion, not on a schedule | Ana Costa | 2026-10-10 |
| Live exposure figure added to the ALERT-001 runbook's first check | Ana Costa | 2026-10-07 |

No person is named as a cause. The decisions taken at 09:04 and 09:12 were correct on the
information visible at the time; INSIGHT-003 is about that information.
```

Recording the hotfix lane's gates, in order:

```bash
navi-delivery propose theme-persistence-hotfix --lane hotfix
# => Created delivery/changes/theme-persistence-hotfix (lane: hotfix; gates: G2 · G6 · G7 · G9)

# G6 and G7 before the fix reaches users
navi-delivery gate G6 --pass --evidence delivery/changes/theme-persistence-hotfix/evidence/g6-quality.md
navi-delivery gate G7 --pass --evidence delivery/changes/theme-persistence-hotfix/evidence/g7-release.md

# G2 deferred — recorded retroactively, within 48 hours, under navi-skill-waivers-and-deferrals
navi-delivery gate G2 --waive "Spec deferred during SEV1; the delta spec is due within 48h of 2026-09-30 09:34 UTC and is tracked as TASK-041." --expires 2026-10-02
# => G2 waived until 2026-10-02

# G9 is mandatory on hotfix and reads the postmortem, which must already exist
navi-delivery gate G9 --pass --evidence delivery/ops/postmortems/theme-persistence-hotfix.md

navi-delivery archive theme-persistence-hotfix
# archive refuses until every one of G2, G6, G7 and G9 is pass-or-waived and nothing is stale
```

## Checklist

- [ ] The severity is set from an affected count and what those users cannot do
- [ ] One person is named incident commander, at declaration
- [ ] Evidence capture is a task, and it did not delay restoration
- [ ] The rollback-or-forward-fix choice is recorded with its reason
- [ ] The rollback decision is recorded before the action, or within the same hour
- [ ] The timeline is in UTC, one row per event, and names the detection source
- [ ] A change that exists to end the incident is on the `hotfix` lane
- [ ] The hotfix branched from the running digest, not from the default branch
- [ ] The postmortem exists before G9 is recorded, not after archive writes a stub
- [ ] Contributing causes are plural, and the control that failed is named
- [ ] No person is named as a cause
- [ ] Every `INSIGHT-###` has exactly one destination and a named target
- [ ] Every corrective action has an owner and a date
- [ ] The predicted impact is compared with the measured impact and the gap is named
- [ ] The error budget the incident spent is recorded
- [ ] Every lane gate is settled before `archive` is attempted

## Anti-patterns

**Severity from the guess.** `Probably the cache, so SEV3.` Twenty minutes later it is the
database and the severity triples, and the response restarts from the beginning. Set severity
from what users cannot do, which is knowable immediately.

**Everyone commanding.** Four engineers in the channel, three plausible theories, and no one
deciding. The rollback that takes four minutes takes fifty. Name one commander at declaration.

**Evidence before users.** Restoration is held for 25 minutes while a heap dump is taken. The
dump was worth having and it was not worth 25 minutes of outage. Capture as an assigned task,
restore in parallel.

**The forward fix under pressure.** A one-line patch written at 03:00, no review, no test, no
gate. It ships, and the second incident is the patch. Roll back to the known state and write
the fix in the morning.

**The timeline written from memory.** The postmortem is written on Friday from what people
recall of Tuesday. The 20-minute gap between detection and declaration has vanished, and it was
the finding. Write the timeline as it happens, in UTC.

**The single root cause.** `Root cause: the null dereference.` Three controls let it through —
the test suite, the halt window and the scheduled ramp — and only the first gets a corrective
action. Name the contributing causes and the control that failed.

**The person as the cause.** `Ana widened the wave too early.` The wave widened on a schedule
the plan set, and the exposure figure she read was 20 minutes stale. The next incident will be
reported later and described less honestly. Name what the information showed.

**The insight routed twice.** `Destination: backlog and a skill amendment.` It appears in
neither the next planning session nor any pull request, because each destination assumes the
other took it. Exactly one.

**The postmortem archive wrote.** G9 is recorded, `archive` runs, and the stub it creates is
the only postmortem that exists — an empty `INSIGHT-001` placeholder. Archive's stub is a
fallback for the lanes that do not enforce G9; on `full` and `hotfix` the file is written
first.

## Validation

```bash
CHANGE=<name>
P=delivery/ops/postmortems/$CHANGE.md

test -f "$P" || echo "no postmortem at $P — G9 reads it by path"

# The header facts are present
for k in "Severity" "Incident commander" "Detected by"; do
  grep -q "^- \*\*$k:\*\*" "$P" || echo "$P: missing $k"
done

# The severity is one of the four
grep '^- \*\*Severity:\*\*' "$P" | grep -qE 'SEV[1-4]' || echo "$P: severity is not one of SEV1..SEV4"

# The commander is a person, not an alias
grep '^- \*\*Incident commander:\*\*' "$P" | grep -qE '#|@|team|rota' \
  && echo "$P: the commander is an alias rather than a person"

# The timeline is in UTC and names the detection source
grep -q '^## Timeline (UTC)$' "$P" || echo "$P: no '## Timeline (UTC)' section"
grep '^- \*\*Detected by:\*\*' "$P" | grep -qE 'ALERT-[0-9]{3,}|user|customer' \
  || echo "$P: the detection source is neither an ALERT-### nor a person reporting it"

# Contributing causes are plural, and the failed control is named
awk '/^## Contributing causes$/{on=1;next} /^## /{on=0} on' "$P" \
  | grep -cE '^[0-9]+\. ' | awk '$1 < 2 {print "fewer than two contributing causes recorded"}'
grep -q 'The control that failed' "$P" || echo "$P: no named control that failed"

# No person is named as a cause: no contributing-cause line opens with a capitalised name
awk '/^## Contributing causes$/{on=1;next} /^## /{on=0}
     on && /^[0-9]+\. [A-Z][a-z]+ [A-Z][a-z]+ /{print "a contributing cause opens with a person name: "$0}' "$P"

# Every insight has exactly one destination and a named target
awk '/^- \*\*INSIGHT-/{id=$2}
     /Destination:/{d=$0; n=gsub(/backlog|skill amendment/,"&");
                    if (n != 1) print "insight " id " has " n " destination(s): " d}
     /Target:/{t=1}
     END{}' "$P"
for id in $(grep -o 'INSIGHT-[0-9]\{3,\}' "$P" | sort -u); do
  awk -v id="$id" '$0 ~ id {on=1} on && /Target:/{found=1; exit} END{if(!found) print id ": no Target line"}' "$P"
done

# Every corrective action has an owner and a date
awk '/^## Corrective actions$/{on=1;next} /^## /{on=0}
     on && /^\| / && $0 !~ /^\| Action/ && $0 !~ /^\| *-/ {
       n=split($0, c, "|");
       if (c[3] ~ /^[[:space:]]*$/ || c[4] !~ /[0-9]{4}-[0-9]{2}-[0-9]{2}/)
         print "corrective action with no owner or no date: " c[2]
     }' "$P"

# The predicted-against-measured comparison exists
grep -qi 'Predicted against measured\|predicted .*measured' "$P" \
  || echo "$P: no comparison of predicted against measured impact"
grep -qi 'error budget' "$P" || echo "$P: the error budget spent is not recorded"

# On a hotfix, the lane is hotfix and G2 is deferred rather than skipped
LANE=$(python3 -c 'import json;print(json.load(open("delivery/.adlc/state.json"))["lane"])' 2>/dev/null)
if [ "$LANE" = hotfix ]; then
  grep -q '"gate":"G2"' delivery/.adlc/events.jsonl 2>/dev/null \
    || echo "lane is hotfix and no G2 decision has been recorded — it is deferred, not skipped"
  grep -q '"gate":"G9"' delivery/.adlc/events.jsonl 2>/dev/null \
    || echo "lane is hotfix and G9 is mandatory but has no recorded decision"
fi
```

Each command prints nothing when the rule holds. The insight-destination check is the one to
run before G9: it is the only mechanical guard against a learning that is recorded, agreed,
and then owned by nobody.
