---
name: navi-skill-human-checkpoints
description: >
  Use when a decision reaches a point the framework reserves for a person — spec sign-off,
  architecture sign-off, release approval, or an incident rollback call. Defines the four
  checkpoints, what each approver is attesting to, the record a decision leaves, and the rule
  that an unavailable human blocks the change rather than being simulated.
  Trigger phrases include: human checkpoint, sign-off, spec sign-off, architecture sign-off,
  release approval, approve the release, rollback decision, who approves, escalate to human,
  self-approve, blocked on approval.
allowed-tools: Read Write Edit Grep
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: lifecycle-method
  lifecycle_phases: [2, 3, 7, 8]
  used_by_agents: [navi-agent-orchestrator, navi-agent-product-owner, navi-agent-business-analyst, navi-agent-architect, navi-agent-devops-engineer, navi-agent-mlops-engineer, navi-agent-security-engineer]
  owner: avinash.negi@navikenz.com
  tags: "adlc, governance, approval, escalation"
  model: sonnet
---

## When to use

A change has reached spec sign-off, architecture sign-off, release approval, or an
incident rollback decision — or an agent is about to record any of those four outcomes.

## Rules

1. There are exactly four human checkpoints: **spec sign-off** (before G2 is recorded),
   **architecture sign-off** (before G3 is recorded), **release approval** (before G7 is
   recorded), and the **incident rollback decision** (during an incident, before G7 on a
   `hotfix`). No other gate requires a person; these four always do.
2. Never simulate a human decision. An agent may prepare the decision, state the
   recommendation, and name the trade-off — it may not record the outcome as if a person
   chose it.
3. Never self-approve. The agent that produced the artifact is never the approver of it, and
   no agent is ever an approver of anything.
4. An unavailable approver blocks the change. Waiting is the correct behaviour; a blocked
   change is a healthy state and is recorded as one.
5. Never waive a human checkpoint. A waiver substitutes an expiry for a decision, and these
   four are the decisions the framework refuses to automate. See
   `navi-skill-waivers-and-deferrals`.
6. Name the approver. A decision recorded as "approved by the team" identifies nobody and
   attests to nothing. Record the individual.
7. Present the approver with the decision, not the artifact. State what is being approved,
   what it commits to, what is unresolved, and what the alternative was.
8. Disclose every open question and every unsettled waiver before asking for approval. An
   approval given without them is void and is re-sought once they surface.
9. Record the decision as a handoff envelope with `kind: review`, carrying `blocked_on`,
   `escalated_to`, and once answered, `decision` and `decided_at`. The gate verdict is then
   recorded separately, per `navi-skill-phase-gate-protocol`.
10. A rejection is a `--fail` on the gate, not a pause. Record it, mark the rework, and
    re-enter the owning phase.
11. An approval expires when its subject changes. Material change to the spec after spec
    sign-off, or to the design after architecture sign-off, re-opens the checkpoint.
12. During an incident, the rollback decision is made by the incident commander and is
    recorded before the action, not after. If the action must precede the record, the record
    is written the same hour.

## Decision table

| Checkpoint | Approver role | Attests that | Precedes |
|---|---|---|---|
| Spec sign-off | Product Owner, or the named requirement owner | The specification describes the outcome wanted, and the named non-goals are genuinely out of scope | Recording G2 |
| Architecture sign-off | Architect of record, or the named technical owner | The approach is acceptable, its costs are understood, and the rejected alternatives were genuinely considered | Recording G3 |
| Release approval | The named release approver for the target environment | The change may reach real users now, at the stated blast radius, with the stated rollback path | Recording G7 |
| Incident rollback | The incident commander | Rolling back, or holding forward, is the right call for this incident | Recording G7 on a `hotfix` |

| Situation | Required action |
|---|---|
| Approver has not responded | Block; record `blocked_on` and `escalated_to`; do not proceed |
| Approver is on leave | Find the named deputy; if none, block. Never proceed unapproved |
| Approver says "looks fine, go ahead" in passing | Sufficient if it names the change and comes from the named approver; record verbatim |
| Approver rejects | Record the gate `--fail` with the rejection as evidence; re-enter the owning phase |
| An agent is asked to approve | Refuse; no agent is ever an approver |
| A waiver is offered in place of approval | Refuse; a human checkpoint is never waived |
| Spec materially changed after sign-off | Re-seek sign-off before recording G2 |
| Open question unresolved at sign-off time | Disclose it, then ask. An undisclosed question voids the approval |
| Incident under way and no commander is reachable | Escalate up the on-call chain; do not roll back unilaterally |

## Template

Requesting a decision — the envelope appended to `delivery/changes/<name>/handoffs.md`:

```yaml
- from: navi-agent-architect
  to: navi-agent-orchestrator
  phase: 3 → 3
  kind: review
  blocked_on: architecture-sign-off
  escalated_to: "<approver name>, Architect of record"
  artifacts: [ADR-004, ADR-005, design.md]
  skills_used: [navi-skill-human-checkpoints, navi-skill-decision-records]
  assumptions: ["Peak load assumed 500 rps — unconfirmed"]
  open_questions: [Q-012]
  confidence: medium
```

The request put to the approver:

```markdown
## Architecture sign-off requested — theme-persistence

**Decision:** approve the read-through cache in front of the preference store, or send it
back.

**Commits us to:** a second store to operate, a cache-invalidation path on preference write,
and a stale-read window of up to 30 seconds.

**Alternative rejected:** reading the store directly on every page load — ADR-004 records
the p95 measurement that ruled it out.

**Unresolved:** Q-012 — whether the 30-second stale window is acceptable for the
accessibility high-contrast theme.

**Unsettled waivers:** none.

**Approver:** <approver name>, Architect of record.
```

The answer, appended once given:

```yaml
- from: navi-agent-orchestrator
  to: navi-agent-architect
  phase: 3 → 3
  kind: review
  blocked_on: architecture-sign-off
  escalated_to: "<approver name>, Architect of record"
  decision: approved
  decided_at: 2026-09-29T10:22:00Z
  decision_note: "Approved; 30s stale window accepted, revisit if a11y complaints appear"
  artifacts: [ADR-004, ADR-005, design.md]
  skills_used: [navi-skill-human-checkpoints]
  assumptions: []
  open_questions: []
  confidence: high
```

Then, and only then:

```bash
navi-delivery gate G3 --pass --evidence delivery/changes/theme-persistence/design.md
```

A rejection:

```bash
navi-delivery gate G3 --fail --evidence delivery/changes/theme-persistence/handoffs.md
# => rework required — N artifact(s) marked stale
```

## Checklist

- [ ] The checkpoint is one of the four, and it applies to this change's lane
- [ ] The approver is a named individual in the correct role
- [ ] The approver is not the producer of the artifact, and is not an agent
- [ ] The request states the decision, what it commits to, and the rejected alternative
- [ ] Every open question and unsettled waiver was disclosed before asking
- [ ] The request was recorded as a `kind: review` envelope with `blocked_on`
- [ ] The answer was recorded with `decision`, `decided_at` and the approver's own words
- [ ] The gate verdict was recorded only after the decision, never alongside it
- [ ] Nothing was waived in place of the decision
- [ ] A rejection was recorded as `--fail` and the owning phase re-entered

## Anti-patterns

**Simulated approval.** `Architecture sign-off: approved (no objections raised).` Silence is
not approval. Block until the named approver answers.

**Self-approval.** The agent that wrote `design.md` recording architecture sign-off. The
checkpoint exists precisely to put a second party between the work and the commitment.

**Approval by absence of dissent.** Posting the design in a channel, waiting two days, and
treating the quiet as consent. The approver must say so.

**Approval without disclosure.** Asking for release approval without mentioning the G6 waiver
that expires in three days. The approval is void, because the approver was not approving what
is actually shipping.

**Waiver instead of a person.** `gate G7 --waive "approver unreachable" --expires ...`. The
approver being unreachable is the block, not an exception to it.

**Collective approver.** `Approved by: the platform team.` No individual attested to anything
and nobody can be asked what they understood. Record a person.

**Approval that outlived its subject.** Spec signed off, then two requirements added, then G2
recorded against the original approval. The approval covered a different spec. Re-seek it.

**Rollback recorded after the fact, days later.** The incident record then reflects a
reconstruction rather than a decision. Record the call as it is made, or within the hour.

## Validation

A checkpoint is satisfied only when both records exist: the request and the answer.

```bash
grep -n 'blocked_on\|decision:\|escalated_to' delivery/changes/*/handoffs.md
```

Every `blocked_on: <checkpoint>` must have a later envelope with the same `blocked_on` plus a
`decision`. A `blocked_on` with no answering `decision` is a change that is still blocked —
whatever `status` shows about its gates. The listing above is for reading; the check below
pairs them mechanically, and compares each `decided_at` against the gate event that followed
it. A gate recorded before its decision is a gate recorded without its checkpoint.

```bash
python3 - <<'CHECKPOINTS'
import json, pathlib, re, sys, yaml

def envelopes(path):
    out = []
    for block in re.findall(r"```yaml\n(.*?)```", path.read_text(encoding="utf-8"), re.S):
        out += (yaml.safe_load(block) or [])
    return out

problems, decisions = [], []
for path in sorted(pathlib.Path("delivery/changes").glob("*/handoffs.md")):
    asked, answered = {}, {}
    for env in envelopes(path):
        key = env.get("blocked_on")
        if not key:
            continue
        if "decision" in env:
            answered[key] = str(env.get("decided_at") or "")
        else:
            asked[key] = True
    for key in asked:
        if key not in answered:
            problems.append(f"{path}: checkpoint '{key}' was requested and never answered")
        elif not answered[key]:
            problems.append(f"{path}: checkpoint '{key}' was decided with no decided_at")
    for key, when in answered.items():
        if key not in asked:
            problems.append(f"{path}: checkpoint '{key}' carries a decision with no request before it")
        elif when:
            decisions.append(when)

events = pathlib.Path("delivery/.adlc/events.jsonl")
if events.exists() and decisions:
    latest = max(decisions)
    for line in events.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        event = json.loads(line)
        if event.get("gate") == "G3" and event.get("ts", "") < latest:
            problems.append(f"G3 was recorded at {event['ts']}, before the checkpoint decided at {latest}")

for problem in problems:
    print(problem)
sys.exit(1 if problems else 0)
CHECKPOINTS
```

Each command prints nothing when the rule holds.
