# Machine Learning Engineer

`navi-agent-machine-learning-engineer` · agent · discipline `machine-learning` · ADLC phases 4, 5 · owns G4, G5 · model `opus` · draft v0.1.0

Establish whether a learned model is the right instrument at all, and if it is, make its performance a measured claim about the world rather than a number from a notebook.

## When it fires

Use when a change proposes to solve something with a learned model — deciding whether ML is warranted, what the baseline is, how the model is evaluated, and where it will fail. Owns ADLC Phases 4 and 5: the G4-DATA-MODEL gate jointly with the Data Engineer, and the G5-BUILD gate jointly with the Data Engineer and the Full Stack Developer.

## What it produces

Writes `tasks.md`, `model and evaluation artifacts`, `handoffs.md`.

Reads `changes/<name>/specs/<capability>/spec.md`, `design.md`, `datasets`, `tasks.md`.

## Phases and gates it owns

- ADLC phases: 4, 5
- Gates: `G4`, `G5`

## Skills it holds (9)

It loads these rather than working from memory, and records which it used in the handoff envelope:

- [Task decomposition](../../skills/spec-driven-development/navi-skill-task-decomposition/README.md) — `spec-driven-development`
- [Traceability](../../skills/lifecycle-method/navi-skill-traceability/README.md) — `lifecycle-method`
- [Phase gate protocol](../../skills/lifecycle-method/navi-skill-phase-gate-protocol/README.md) — `lifecycle-method`
- [Handoff protocol](../../skills/lifecycle-method/navi-skill-handoff-protocol/README.md) — `lifecycle-method`
- [Problem framing](../../skills/machine-learning/navi-skill-problem-framing/README.md) — `machine-learning`
- [Evaluation design](../../skills/machine-learning/navi-skill-evaluation-design/README.md) — `machine-learning`
- [Model cards](../../skills/machine-learning/navi-skill-model-cards/README.md) — `machine-learning`
- [Data contracts](../../skills/data-engineering/navi-skill-data-contracts/README.md) — `data-engineering`
- [Drift monitoring](../../skills/mlops/navi-skill-drift-monitoring/README.md) — `mlops`

## When it stops and asks a human

- The model's errors fall unevenly across a group the organisation has a duty toward
- The evaluation the requirement implies cannot be run on data we are permitted to use
- A baseline that is not machine learning performs within noise of the proposed model
- Labels encode a past decision the business now says was wrong
- The cost of a wrong prediction has never been stated by anyone who owns the consequence

## Hands off to

MLOps Engineer, Data Engineer, QA Engineer, Architect, Orchestrator.

## Install

### This agent and the 9 skills it holds

```sh
git clone https://github.com/avinash-navikenz/agentic-skill-workflow.git
cd agentic-skill-workflow
./install.sh --agent navi-agent-machine-learning-engineer
```

This installs the agent **and the skills it holds**, and nothing else — the installer reads them from the agent's own file. It is a working unit: the agent loads its skills rather than working from memory, so the two travel together. The lifecycle CLI is not included; the whole framework below adds it.

### The whole framework

Two routes. The plugin is one command and no clone; installing from source gets you the same files plus the repository, which is what the `navi-delivery` CLI and the per-item installs above are run from.

**As a plugin — no clone**

```sh
/plugin marketplace add avinash-navikenz/agentic-skill-workflow
/plugin install navi-delivery@navi-delivery   # 50 skills + 11 agents
```

Typed in Claude Code, not a shell. This installs every agent and every skill — the plugin is the whole framework and cannot be narrowed, which is what the per-item install above is for. It does not install the `navi-delivery` CLI, so there are no gates and no delivery record until you add it from source.

**From source**

```sh
git clone https://github.com/avinash-navikenz/agentic-skill-workflow.git
cd agentic-skill-workflow
./install.sh --yes                    # symlinks 50 skills + 11 agents into ~/.claude
npm install --global .                # the navi-delivery CLI
```

`adapters/claude-code/` is the installable artefact and is committed, so no build step is needed. `--copy` installs copies instead of symlinks; `--uninstall` removes exactly what it installed; `CLAUDE_SKILLS_DIR` and `CLAUDE_AGENTS_DIR` override the destinations (which default to `$HOME/.claude/skills` and `$HOME/.claude/agents`). Prerequisites are Node 20 or newer and Python 3, and nothing else.

## Where the rules live

This README is a summary and carries no rules. [navi-agent-machine-learning-engineer.agent.md](navi-agent-machine-learning-engineer.agent.md) is the authority — it holds its mission, mental model, how it decides, its definition of good, its working agreement and its skill-invocation plan. Nothing from it is repeated here, so the two cannot disagree.

## Notes

<!-- BEGIN NOTES -->

_Nothing hand-written yet. Anything between the NOTES markers survives regeneration; everything outside them is overwritten._

<!-- END NOTES -->

---

Generated by `python3 scripts/build_catalogue.py . --readmes` from this item's frontmatter and section headings. Edit the source file, not this one — except inside the NOTES block, which regeneration preserves.
