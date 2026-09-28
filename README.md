# navi-delivery

**An agentic SDLC framework — plan to monitor, in any harness.**
Agents hold the judgment. Skills hold the rules.

> Status: design approved, implementation not started.
> Full design: [`docs/superpowers/specs/2026-09-28-navi-delivery-framework-design.md`](docs/superpowers/specs/2026-09-28-navi-delivery-framework-design.md)
> Slides: [`docs/navi-delivery-overview.pptx`](docs/navi-delivery-overview.pptx)

---

## The problem

Coding assistants land in the middle of the lifecycle and leave both ends untouched.

- **Judgment is re-invented every time.** Each prompt re-derives what a Business Analyst or
  Architect already knows. Nothing accumulates.
- **Standards live in people's heads.** Best practices sit in wikis nobody opens, detached
  from the moment the work actually happens.
- **The loop never closes.** Incidents rarely change the standard that allowed them, so the
  same defect returns.

## The idea

A team drops one framework into any repo and gets a complete, governed lifecycle — driven by
**ten persona agents** carrying each discipline's judgment, backed by **fifty-six skills**
carrying each discipline's rules.

| | Agents — the thinking | Skills — the rules |
|---|---|---|
| Contain | mission · mental model · trade-off framing · escalation triggers · definition of good | standards · decision tables · templates · checklists · anti-patterns · validators |
| Answer | what, why, when | how |
| Voice | first person, persona | impersonal, imperative |

**The falsifiable test:** delete every agent and the skills still fully specify *how* work is
done; delete every skill and the agents still specify *what, why and when*. A sentence that
appears in both belongs in the skill.

This is enforced, not aspirational — `lint_separation.py` fails the build on a numbered
procedure inside an agent, or persona voice inside a skill. Without a mechanical check, the
two halves merge within months.

## The personas

`orchestrator` · `product-owner` · `business-analyst` · `architect` · `fullstack-developer`
· `data-engineer` · `machine-learning-engineer` · `mlops-engineer` · `devops-engineer` ·
`qa-engineer`

## The lifecycle

Nine ADLC phases, nine binding gates, closing the loop back to Plan:

`Plan → Specify → Architect → Data & Model → Build → Verify → Release → Operate → Learn ↺`

Each gate needs **evidence** — a file, a command output, a test result. Not an assertion.
A phase that emits no telemetry did not happen.

### Four lanes, so nobody routes around it

Forcing nine gates on a config flag guarantees the framework is abandoned by week two.

| Lane | When | Gates |
|---|---|---|
| `express` | copy · config · flag flip | G2 · G6 · G7 |
| `standard` | most features and bugs | all but G4 unless data or ML is touched |
| `full` | new capability · regulated · any ML | all nine |
| `hotfix` | production incident | G6 · G7 now; spec retroactive within 48h |

A skipped gate is always **recorded**, never silent.

### Spec-driven, end to end

`REQ → AC → ADR → TASK → TEST → SLI → INSIGHT`

Every artifact declares its upstream IDs. Orphans fail `validate --strict`: code with no
task, a task with no requirement, a shipped capability with no telemetry. Specs change
first, code second — a code change that outruns its spec is a defect, not a shortcut.

## What a team sees

```
my-app/
└── delivery/
    ├── project.md        stack & conventions
    ├── AGENTS.md         harness entry point (generated)
    ├── specs/            current truth
    ├── changes/          in flight
    ├── decisions/        ADRs
    ├── ops/              SLOs · runbooks · postmortems
    └── .adlc/            state · events · waivers
```

```bash
navi-delivery init                             # scaffold, generate AGENTS.md, detect harness
navi-delivery propose <name> --lane standard   # open a change
navi-delivery status                           # phase, gate verdicts, stale artifacts
navi-delivery validate --strict                # frontmatter, schema, orphans
navi-delivery gate G6 --pass --evidence <path> # record a decision
navi-delivery archive <name>                   # fold deltas in, emit insights
```

`ops/` is the deliberate extension beyond OpenSpec, which stops at archive. Phases 8–9 need
a home in the repo or the loop cannot close.

## Runs anywhere

Agents declare neutral capabilities; every capability has a mandatory fallback.

| Capability | Claude Code | Codex / Cursor | Bare chat fallback |
|---|---|---|---|
| `read_file` | Read | file read | ask the human to paste |
| `write_file` | Write | file write | emit in a fenced block |
| `run_command` | Bash | shell | human runs it, pastes output |
| `search` | Grep / Glob | search | ask for the relevant paths |
| `ask_human` | AskUserQuestion | prompt | plain question, then wait |
| `spawn_subagent` | Agent | — | adopt the persona sequentially |

A persona is a **subagent** where subagents exist, and a **role the model steps into** where
they don't — same agent file, same skills, degraded isolation only.

## How we prove it works

The content is the product, so it's tested like product:

- **`evals/evals.json` per skill** in the house format — `/skill-creator`,
  `/eai-eng-skills-evaluator` and `skill-batch-creator` all work on this repo unchanged.
- **`lint_separation.py`** — the separation law, mechanically.
- **`validate_manifests.py`** — frontmatter, naming, referential integrity.
- **`golden_path.py`** — a toy project through all nine phases and all four lanes in CI.

## v1 scope

10 agents · 37 skills (56 at full catalogue) · 4 lanes · CLI · 3 validators · golden-path CI.
A complete vertical slice — every discipline represented, nothing half-wired.

## Open decisions

1. `owner` email stamped into agent and skill metadata
2. Whether Security Engineer becomes an eleventh agent (today it exists only as skills)
3. Stack opinionation — neutral rules with a `project.md` override, or house defaults
4. Pilot repo to run the golden path against
