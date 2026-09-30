# Contributing — adding a skill or an agent

The content is the product, so it is tested like product. A new skill does not land until
six checks pass, and one of them runs the skill's own validation logic against a deliberately
broken fixture.

Read [CONCEPTS.md](CONCEPTS.md) §1 first. The single most common rejection is judgment in a
skill or a procedure in an agent, and the rule that governs it is not the obvious one.

---

## Before you write anything

```bash
git checkout -b feat/navi-skill-<name>
npm test && python3 -m unittest discover -s tests/lint
```

Start from green. A pre-existing failure you did not cause will waste an hour.

---

## Adding a skill

### 1. The directory

```
skills/<discipline>/navi-skill-<name>/
├── SKILL.md
├── evals/evals.json
└── references/           # only if the skill genuinely needs one
```

The directory name and the `name:` in the frontmatter must match exactly (`M3`), and the
name must start with `navi-skill-` (`M3`). The discipline folder must be one of the twelve
that exist, or you are also adding a discipline — see below.

### 2. The frontmatter

```yaml
---
name: navi-skill-<name>
description: >
  Use when <the situation that should load this>. Defines <what it settles>.
  Trigger phrases include: <phrase>, <phrase>, <phrase>.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: <folder name>
  lifecycle_phases: [<phase numbers>]
  used_by_agents: [navi-agent-<a>, navi-agent-<b>]
  owner: avinash.negi@navikenz.com
  tags: "comma, separated"
  model: sonnet
---
```

Four rules bite here:

- **`Trigger phrases include:` must appear literally** in the description (`M6`). It is what
  makes the skill discoverable.
- **`used_by_agents` must equal exactly the set of agents whose `skills:` list names this
  skill** (`M7`), in both directions. Adding a skill means editing at least one agent too.
- **`version` stays `0.1.0`.** No version changes until the framework is stable.
- **`owner` is `avinash.negi@navikenz.com`.** There is no `OWNER_TBD` any more.

### 3. The body

Sections, in this order: `## When to use` · `## Rules` · `## Decision table` ·
`## Template` · `## Checklist` · `## Anti-patterns` · `## Validation`.

Write it **impersonal and imperative**. No "I", no "as the Architect" — `SEP3` and `SEP4`
fail the build on either. If you find yourself wanting to explain *why* a rule is worth
following in the persona's voice, that sentence belongs in the agent.

`## Rules` are numbered and mechanical. `## Decision table` maps an observable condition to
a required action — observable, not inferred. `## Anti-patterns` name the failure and what
it costs, not just "don't do this".

### 4. The Validation block

This is the part that makes the skill testable, and it is not optional. The `## Validation`
heading is followed by a fenced `bash` block that checks the skill's own rules against
artifacts on disk. The block's contents look like this:

```bash
CHANGE=<name>
EV=delivery/changes/$CHANGE/evidence

# Every finding row carries one of the four dispositions
grep -nE '^\| (GHSA|CVE|OSV)-' "$EV/g6-dependencies.md" \
  | grep -vE 'fixed|mitigated|not-applicable|waived'
```

It must **fail loudly on a violation.** `scripts/validate_skill_checks.py` runs your block
twice: once against your own `## Template`, where it must stay silent, and once against a
mutation that violates a rule the block claims to check, where it must speak. A check that
stays silent on the violation fails the harness — that is the entire point of the second
run.

### 5. Register it with the harness

Add an entry to `scripts/skill_harness.yaml`. **A skill with no entry fails the harness**, so
a new skill cannot arrive with unexercised checks. If the skill genuinely cannot be exercised
from a fixture, declare `unharnessable:` with the reason — and expect the reason to be read.
Exactly one skill uses this today.

### 6. The evals

`evals/evals.json`, in the house format, so `/skill-creator`, `/eai-eng-skills-evaluator` and
`skill-batch-creator` all work on this repo unchanged:

```json
{
  "skill": "navi-skill-<name>",
  "cases": [
    {
      "id": "pos-1",
      "type": "positive",
      "prompt": "<a situation that should load this skill>",
      "expect": ["<a string the answer must contain>", "..."]
    },
    { "id": "neg-1", "type": "negative", "prompt": "...", "expect": [] }
  ]
}
```

Positive, negative and edge cases. A skill with only positive cases has not been tested for
the thing that actually goes wrong, which is firing when it should not.

### 7. Wire it to an agent

Add the skill's name to the `skills:` list of every agent that uses it, and make sure
`used_by_agents` names exactly those agents. `M4` fails on a reference to a skill that does
not exist; `M5` fails on a skill no agent names; `M7` fails on any disagreement between the
two lists.

The agent's `## Skill invocation plan` should say **when** the skill loads and **why** — not
what it does. What it does is the skill's job.

### 8. Regenerate the adapters

```bash
python3 scripts/build_adapters.py .
```

CI regenerates and diffs, so skipping this fails the build. Never hand-edit anything under
`adapters/` or `templates/delivery/AGENTS.md`.

---

## Adding an agent

```
agents/navi-agent-<persona>/navi-agent-<persona>.agent.md
```

Frontmatter carries everything a skill's does, plus `owns_gates`, `skills`, `capabilities`,
`consumes`, `produces`, `handoff_to` and `escalate_to_human_when` — all required (`M2`).

Body sections: `## Mission` · `## Mental model` · `## How I decide` · `## Definition of good`
· `## Working agreement` · `## Skill invocation plan`.

Write it in **first person**, as the persona. What must not appear:

- **A numbered procedure** (`SEP1`). If you are writing steps, you are writing a skill.
- **A `## Template` or `## Checklist` section** (`SEP2`). Same reason.

Three fields deserve more thought than they usually get:

- **`escalate_to_human_when`** — the conditions under which this persona stops rather than
  advises. An agent with no stopping conditions has no boundary, and a boundary is the most
  useful thing a persona carries.
- **`capabilities`** — neutral names from `registry/capabilities.json` only. Never `Read` or
  `Bash`; those are one harness's spelling.
- **`owns_gates`** — bare `G1`–`G9`. The `-SPEC` and `-DESIGN` suffixes are descriptive
  mnemonics, and no tool matches them.

`metadata.lifecycle_phases` records the phases the agent **owns**, not the ones it is
consulted at. Consultation is recorded as a handoff with `kind: review`.

---

## Adding a discipline

Only when an agent's `discipline` field would otherwise name somebody else's folder. That is
the reason `security/` exists: an eleventh agent arrived, and a Security Engineer whose
discipline pointed at `architecture/` would have been the first lie in the manifest.

A discipline with one skill is fine. A discipline with no owning agent is not — `M5` will
fail on every skill in it.

---

## Before you open the PR

Every one of these, from the repo root:

```bash
npm test                                       # expect 91 pass / 0 fail
python3 -m unittest discover -s tests/lint     # expect OK (77 tests)
python3 scripts/validate_manifests.py .        # expect 0 finding(s)
python3 scripts/lint_separation.py .           # expect 0 separation finding(s)
python3 scripts/validate_skill_checks.py .     # expect 0 failing
python3 scripts/golden_path.py                 # expect golden path: OK
python3 scripts/build_adapters.py .            # then: git diff --exit-code adapters
```

CI runs exactly these, in this order, on Ubuntu with Node 20 and Python 3.11. The adapter
diff is last and catches the most common omission.

**Never run a `navi-delivery` command with the repo root as its working directory.** It
writes a `delivery/` tree there. Use a temp directory.

---

## Where a change to a skill should come from

The best source of a skill amendment is an `INSIGHT-###` from a real change's archive,
routed to `skill amendment` with this skill as its target. That is the loop the framework
exists to close: a postmortem that reveals a wrong standard should change the standard, in
the file the next team will load.

An amendment arriving that way should say so in the PR description, and name the change it
came from.
