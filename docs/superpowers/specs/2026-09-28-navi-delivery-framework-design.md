# navi-delivery — Agentic SDLC Framework (Design)

**Date:** 2026-09-28
**Status:** Draft for review
**Audience:** Navikenz internal

---

## 1. Intent

Teams doing day-to-day project work should be able to drop one framework into any repo and
get a complete, governed lifecycle from **Plan through Monitor** — driven by AI agents that
hold the *judgment* of each engineering persona, backed by skills that hold the *rules and
best practices* of each discipline.

`navi-delivery` is that framework. It is modelled on two existing things:

- **OpenSpec** — for the artifact model: a directory scaffolded into the consuming repo,
  specs as source of truth, changes as proposals, a validated lifecycle, tool-agnostic entry
  via a generated `AGENTS.md`.
- **Superpowers** — for the distribution model: a zero-dependency plugin carrying a skills
  library, loaded across many harnesses from one tree via sibling manifests.

The new contribution is the layer neither has: **persona agents over best-practice skills**,
covering the full lifecycle rather than the coding slice of it.

### Success criteria
1. A team runs `navi-delivery init` in an existing repo and ships a real change through the
   framework the same day, without reading more than the README.
2. The same agents and skills run unchanged in Claude Code, Codex, Cursor, and a bare chat
   loop with no plugin support.
3. A change of any size — a config flag or a regulated ML capability — has a proportionate
   path through the framework, so nobody routes around it.
4. Every shipped change is traceable from requirement to running telemetry.

### Non-goals (v1)
- Not a project-management tool. No ticket sync, no sprint mechanics, no estimation engine.
- Not a code generator. It governs how code is specified, reviewed, tested and operated.
- Not a package manager. Persona packs are folders, not independently versioned artifacts.
- No web UI, no server, no external service dependency.

---

## 2. Decisions taken

| Decision | Choice | Rationale |
|---|---|---|
| Audience | Navikenz internal | Can assume house conventions; reuses `/eai-eng-skills-evaluator` |
| Shape | Standalone plugin (Approach B) | Portable across repos *and* harnesses, unlike a pillar in `skills-eai-eng` |
| Naming | `navi-skill-*`, `navi-agent-*` | User-specified |
| Organisation | Descriptive discipline folders | Replaces pillar/group scaffolding |
| Persona packs | Folder convention only | Seam for later split without building versioning now |
| Methodology | ADLC (9 phases) + Spec-Driven Development | User-specified |

---

## 3. Architecture

### 3.1 Shipped tree

```
navi-delivery/
├── .claude-plugin/plugin.json      # Claude Code
├── .codex-plugin/plugin.json       # Codex
├── .cursor-plugin/plugin.json      # Cursor
├── .agents/plugins/                # cross-runtime alias (~/.agents/skills)
├── install.sh                      # house convention; --yes for CI
├── package.json                    # npx navi-delivery <cmd>
├── README.md                       # clone → first change in under 5 minutes
├── ADLC.md                         # the nine phases, gates, lanes
├── SDD.md                          # spec-driven rules, the ID chain
├── agents/
│   └── navi-agent-<persona>/
│       └── navi-agent-<persona>.agent.md
├── skills/
│   └── <discipline>/
│       └── navi-skill-<name>/
│           ├── SKILL.md
│           ├── references/ templates/ checklists/
│           └── evals/evals.json
├── cli/                            # init · propose · status · validate · gate · archive · doctor
├── templates/adlc/                 # scaffold payload
├── schemas/                        # JSON Schema per artifact type
└── scripts/
    ├── validate_manifests.py       # frontmatter, naming, referential integrity
    ├── lint_separation.py          # enforces the separation law (§4.1)
    ├── build_adapters.py           # projects agents/skills into harness manifests
    └── golden_path.py              # end-to-end CI fixture
```

### 3.2 Scaffolded tree (in the consuming repo)

```
<project>/delivery/
├── project.md                  # stack, conventions, team context — human-authored
├── AGENTS.md                   # GENERATED harness-agnostic entry point
├── specs/<capability>/spec.md  # current truth
├── changes/<change-name>/
│   ├── proposal.md             # why, what, lane
│   ├── design.md               # technical approach (optional by lane)
│   ├── tasks.md                # TASK-### checklist
│   ├── handoffs.md             # agent-to-agent envelopes (§4.5)
│   └── specs/<capability>/spec.md   # delta: future state
├── changes/archive/YYYY-MM-DD-<name>/
├── decisions/ADR-###.md
├── ops/
│   ├── slo.md                  # SLI-### definitions
│   ├── runbooks/
│   └── postmortems/            # → INSIGHT-###
└── .adlc/
    ├── state.json              # current change, lane, phase, gate verdicts
    ├── waivers.md              # waived gates: reason + expiry
    └── events.jsonl            # one record per gate decision
```

`ops/` is the deliberate extension beyond OpenSpec, which ends at archive. Phases 8–9 need a
home in the repo or the loop cannot close.

### 3.3 Conventions

Skills are `navi-skill-<descriptive-name>` inside a discipline folder. Agents are
`navi-agent-<persona>` as `*.agent.md`. Frontmatter follows the house shape but drops
`pillar`/`group` in favour of self-describing fields:

```yaml
---
name: navi-skill-acceptance-criteria
description: >
  Use when writing or reviewing acceptance criteria for a requirement. Defines the
  Given/When/Then form, objective-testability rules, and AC-### numbering.
  Trigger phrases include: acceptance criteria, AC, given when then, testable requirement,
  definition of done for a requirement.
allowed-tools: Read Write Edit Grep
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: spec-driven-development
  lifecycle_phases: [2, 6]
  used_by_agents: [navi-agent-business-analyst, navi-agent-qa-engineer]
  owner: <TBD §10>
  tags: "sdd, requirements, quality"
  model: sonnet
---
```

Agents use the same block with `kind: agent`, plus `owns_gates`, `skills`, `capabilities`,
`consumes`, `produces`, `handoff_to`, `escalate_to_human_when`.

---

## 4. The agent/skill contract

### 4.1 The separation law

- **Agents hold judgment** — mission, mental model, decision heuristics, trade-off framing,
  escalation triggers, definition of good, and a skill-invocation plan.
- **Skills hold rules** — standards, decision tables, templates, checklists, anti-patterns,
  and a mechanical validation step.

**Falsifiable test:** delete every agent and the skills still fully specify *how* work is
done; delete every skill and the agents still specify *what, why and when*.

**Operational test for a rule in disguise.** A sentence in an agent is misplaced when **both**
hold: (a) it tells the reader what to do, or what an artifact must contain, **and** (b) it adds
no reason the governing skill does not already carry. A sentence that names a boundary the
persona will not cross, or that gives a *reason* for choosing between permitted options, is
judgment — **even when a skill covers the same mechanics**. An agent may restate a constraint
when it says *why* that constraint binds it.

*This replaces an earlier formulation, "a sentence present in both belongs in the skill", which
was unsatisfiable: every escalation condition an agent states also lives in a skill, so the rule
forbade agents from stating their own boundaries while this same section requires exactly that.
Five review passes produced a rising count (2, then 9, then 14, then 15) — the signature of an
unsatisfiable definition rather than a defective codebase. A companion test, "could a reader
comply with this mechanically", was also withdrawn: a good reason is compliable, which is what
makes it useful, so that test deleted judgment along with rules.*

**Enforcement:** `lint_separation.py` fails the build on a numbered procedure or a template
inside an `.agent.md`, and on second-person persona voice ("as the Architect, weigh…")
inside a `SKILL.md`. Without a mechanical check the two halves merge within months.

**Corollary:** an agent may not produce a lifecycle artifact from memory. It loads the
governing skill and follows it, then records which skills it used in the handoff envelope.

### 4.2 Agent roster

| Agent | Persona | Owns phases | Holds judgment about |
|---|---|---|---|
| `navi-agent-orchestrator` | Delivery Lead | 1–9 | Lane selection, gate enforcement, routing, rework, escalation |
| `navi-agent-product-owner` | Product Owner / Manager | 1, 9 | Outcomes over output, value vs. effort, scope discipline, KPI choice |
| `navi-agent-business-analyst` | Business Analyst | 2 | Ambiguity hunting, actors and journeys, testable criteria, NFR elicitation |
| `navi-agent-architect` | Architect | 3, 9 | Quality attributes, boundaries, build-vs-buy, failure modes, debt economics |
| `navi-agent-fullstack-developer` | Full Stack Developer | 5 | Decomposition, contracts, testability, incremental delivery, refactor-vs-rewrite |
| `navi-agent-data-engineer` | Data Engineer | 4, 5 | Source fidelity, schema evolution, lineage, idempotency, pipeline cost |
| `navi-agent-machine-learning-engineer` | ML Engineer | 4, 5 | Is ML right, baselines, leakage, evaluation design, fairness, failure analysis |
| `navi-agent-mlops-engineer` | MLOps Engineer | 7, 8 | Reproducibility, promotion, drift and decay, model rollback, inference cost |
| `navi-agent-devops-engineer` | DevOps Engineer | 7, 8 | Environment parity, blast radius, SLOs and error budgets, secrets posture |
| `navi-agent-qa-engineer` | QA / Testing Engineer | 6 | Risk-based coverage, the pyramid, flakiness economics, release-blocking calls |

### 4.3 Skill catalogue

`[v1]` ships in the first release; the rest follow. v1 is a complete vertical slice — every
discipline represented, nothing half-wired.

**lifecycle-method/** — `phase-gate-protocol` [v1], `lane-selection` [v1], `traceability` [v1],
`handoff-protocol` [v1], `waivers-and-deferrals` [v1], `human-checkpoints` [v1]

**spec-driven-development/** — `spec-authoring` [v1], `acceptance-criteria` [v1],
`change-proposal` [v1], `task-decomposition` [v1], `spec-change-control`

**product-management/** — `outcome-and-kpi-definition` [v1], `backlog-prioritisation` [v1],
`scope-and-non-goals`, `release-notes-and-comms`

**business-analysis/** — `requirements-elicitation` [v1], `non-functional-requirements` [v1],
`process-modelling`, `glossary-and-domain-language`

**architecture/** — `decision-records` [v1], `quality-attributes` [v1],
`interface-contracts` [v1], `threat-modelling` [v1], `technical-debt-register`

**software-development/** — `test-driven-development` [v1], `code-review` [v1],
`api-design` [v1], `version-control-workflow` [v1], `secure-coding`, `frontend-standards`,
`documentation-standards`

**data-engineering/** — `data-contracts` [v1], `pipeline-design` [v1], `data-quality` [v1],
`data-modelling`, `data-governance-and-pii`

**machine-learning/** — `problem-framing` [v1], `evaluation-design` [v1], `model-cards` [v1],
`experiment-tracking`, `llm-and-agent-evaluation`

**mlops/** — `model-registry-and-promotion` [v1], `drift-monitoring` [v1],
`model-deployment-patterns`, `feature-store-parity`

**platform-devops/** — `pipeline-automation` [v1], `progressive-delivery` [v1],
`observability` [v1], `incident-response` [v1], `infrastructure-as-code`, `cost-management`

**quality-engineering/** — `test-strategy` [v1], `test-design` [v1],
`release-readiness` [v1], `automation-standards`, `non-functional-testing`

v1 = 37 skills, 10 agents. Full catalogue = 56 skills.

### 4.4 Capability portability

Agents declare neutral capabilities. Every capability has a mandatory fallback — that
requirement is what makes "runs in any harness" true rather than aspirational.

| Capability | Claude Code | Codex / Cursor | Bare chat loop fallback |
|---|---|---|---|
| `read_file` | Read | file read | ask the human to paste |
| `write_file` | Write | file write | emit in a fenced block |
| `run_command` | Bash | shell | ask the human to run and paste output |
| `search` | Grep/Glob | search | ask for the relevant paths |
| `ask_human` | AskUserQuestion | prompt | plain question, then wait |
| `spawn_subagent` | Agent | — | adopt the persona sequentially in one session |

A persona is a **subagent** where subagents exist and a **role the model steps into** where
they do not — same agent file, same skills, degraded isolation only.

`build_adapters.py` projects the agent and skill tree into each harness manifest. Adapters
are generated, never hand-edited; `navi-delivery doctor` detects the harness and reports which
capabilities are native versus falling back.

### 4.5 Handoff envelope

Each phase transition appends a block to `changes/<name>/handoffs.md`:

```yaml
- from: navi-agent-business-analyst
  to: navi-agent-architect
  phase: 2 → 3
  artifacts: [REQ-001..REQ-014, AC-001..AC-031]
  skills_used: [navi-skill-spec-authoring, navi-skill-acceptance-criteria]
  assumptions: ["Peak load assumed 500 rps — unconfirmed"]
  open_questions: [Q-003]
  confidence: medium
```

Handoffs are not purely linear: QA is consulted at phase 2 for testability, the Architect
reviews phase 5 output. Consultation is recorded as a handoff with `kind: review`.

---

## 5. Lifecycle model

### 5.1 Phases and gates

| # | Phase | Gate | Owner |
|---|---|---|---|
| 1 | Plan | G1-INTENT | Product Owner |
| 2 | Specify | G2-SPEC | Business Analyst |
| 3 | Architect | G3-DESIGN | Architect |
| 4 | Data & Model | G4-DATA-MODEL | Data + ML Engineer |
| 5 | Build | G5-BUILD | Developer / Data / ML |
| 6 | Verify | G6-QUALITY | QA Engineer |
| 7 | Release | G7-RELEASE | DevOps + MLOps |
| 8 | Operate & Monitor | G8-OPERATE | MLOps + DevOps |
| 9 | Learn & Evolve | G9-FEEDBACK | Product Owner + Architect |

Mapped onto the change lifecycle: `explore → propose → design → apply → verify → release →
operate → archive`.

### 5.2 Lanes

Proportionality is what keeps the framework in daily use. The lane is declared in
`proposal.md`; the orchestrator enforces the matching gate set.

| Lane | Trigger | Gates enforced |
|---|---|---|
| `express` | copy, config, flag flip | G2, G6, G7 |
| `standard` | most features and bugs | G1, G2, G3, G5, G6, G7, G8 (G4 only if data/ML touched; G9 batched) |
| `full` | new capability, regulated, or any ML | all nine |
| `hotfix` | production incident | G6, G7 immediately; G2 retroactive within 48h; G9 postmortem mandatory |

A skipped gate is always **recorded** in `events.jsonl`, never silent. Waivers require a
reason and an expiry in `.adlc/waivers.md` — enforced by `navi-skill-waivers-and-deferrals`.

### 5.3 Rework

A failed gate does not simply block. The orchestrator writes a rework record naming the
phase to re-enter and marks every downstream artifact `stale`. `navi-delivery validate` fails
while stale artifacts exist, so rework cannot be silently skipped. Specs change first, code
second — a code change that outruns its spec is a defect, not a shortcut.

### 5.4 Traceability

`REQ → AC → ADR → TASK → TEST → SLI → INSIGHT`. Each artifact declares upstream IDs.
`navi-delivery validate --strict` fails on orphans: code with no TASK, TASK with no REQ, REQ
with no AC, shipped capability with no SLI.

### 5.5 State and resumability

`.adlc/state.json` holds the current change, lane, phase, gate verdicts, and stale set. A
fresh session in any harness reads it and resumes mid-flight rather than re-deriving. Long
deliveries exceed any context window; without this the framework fails on its second day.

### 5.6 Loop closure

Archiving emits `INSIGHT-###` records. Each targets one of two destinations:

1. **Product backlog** — a candidate REQ for a future change.
2. **Skill amendment** — a PR against a `navi-skill-*` file.

The second path is how the framework improves from use instead of ossifying. A postmortem
that reveals a wrong standard should change the standard.

---

## 6. CLI surface

| Command | Purpose |
|---|---|
| `navi-delivery init` | Scaffold `delivery/`, generate `AGENTS.md`, detect harness |
| `navi-delivery propose <name> --lane <lane>` | Create a change folder from templates |
| `navi-delivery status` | Current change, phase, gate verdicts, stale artifacts |
| `navi-delivery validate [--strict]` | Frontmatter, schema, traceability, orphans |
| `navi-delivery gate <G#> --pass\|--fail --evidence <path>` | Record a gate decision |
| `navi-delivery archive <name>` | Fold deltas into specs, emit insights, date-stamp |
| `navi-delivery doctor` | Harness detection; native vs. fallback capabilities |

Zero runtime dependencies beyond Node (CLI) and Python 3 (validators), matching the
Superpowers zero-dependency posture.

---

## 7. Quality strategy

The framework's content *is* the product, so it is tested like product:

- **`evals/evals.json` per skill**, in the existing house format — so `/skill-creator`,
  `/eai-eng-skills-evaluator` and `skill-batch-creator` all work on this repo unchanged, and
  the long tail beyond v1 can be bulk-generated.
- **`lint_separation.py`** — the separation law, mechanically.
- **`validate_manifests.py`** — frontmatter, naming, and referential integrity: every
  `skills:` reference in every agent resolves, every skill is used by at least one agent.
- **`golden_path.py`** — a toy project carried through all nine phases in CI, asserting
  artifacts exist, gates recorded, zero orphans. The regression test for the whole system.
- **Harness matrix** — `doctor` runs in CI against each adapter to prove fallbacks hold.

---

## 8. Failure modes and handling

| Failure | Handling |
|---|---|
| Agent cannot complete a phase | Escalate per `escalate_to_human_when`; record blocked state; never fabricate an artifact |
| Gate fails | Rework record; downstream marked stale; validate blocks |
| Human checkpoint unavailable | Block. Never self-approve a human decision |
| Harness lacks a capability | Fall back per §4.4; `doctor` reports degradation |
| Context exhausted mid-change | Resume from `state.json` |
| Skill and agent conflict | Skill wins on *how*; agent wins on *whether* |
| Two agents disagree | Orchestrator arbitrates; unresolved → human checkpoint |

---

## 9. Acceptance criteria (v1)

- [ ] 10 agents and 37 v1 skills exist, all passing `/eai-eng-skills-evaluator`.
- [ ] `lint_separation.py` passes: no procedure in agents, no persona voice in skills.
- [ ] `validate_manifests.py` passes: every reference resolves, no unused skills.
- [ ] `navi-delivery init` in a fresh repo produces a working `delivery/` tree and `AGENTS.md`.
- [ ] All four lanes exercised in the golden path, with correct gate sets enforced.
- [ ] Traceability validates with zero orphans on the golden path.
- [ ] A change resumes correctly from `state.json` in a fresh session.
- [ ] Framework loads in Claude Code, Codex, Cursor, and bare-prompt mode; `doctor` proves it.
- [ ] Archiving emits insights, and at least one routes to a skill amendment.
- [ ] README takes a new user from clone to first proposal in under five minutes.

---

## 10. Open questions

1. **`owner` email** to stamp in agent and skill metadata.
2. **Orchestrator** — distinct agent, or collapsed into the CLI? Current design keeps it an
   agent because lane selection and rework arbitration are judgment, not control flow.
3. **Additional personas.** Security Engineer and UX/Product Designer are currently covered
   only as skills (`threat-modelling`, `secure-coding`, `frontend-standards`) with no owning
   agent. For regulated work the Security Engineer gap is the more material of the two.
4. **`prompts/agentic-sdlc-system.prompt.md`** — the earlier one-off generator prompt.
   Its seven laws, phase table and persona table are reusable source material for `ADLC.md`.
   Absorb and delete, or keep as a standalone?
5. **Stack opinionation.** `software-development` skills need a default stack to be concrete.
   Ship stack-neutral rules with a `project.md` override, or opinionated house defaults?
