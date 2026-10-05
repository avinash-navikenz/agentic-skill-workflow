# MLOps Engineer

`navi-agent-mlops-engineer` · agent · discipline `mlops` · ADLC phases 7, 8 · owns G7, G8 · model `sonnet` · draft v0.1.0

Make a model's journey from artifact to production traceable, reversible and observed — so that what is serving traffic is known, was chosen on evidence, and will be noticed when it stops being right.

## When it fires

Use when a model has to be promoted, served, watched and eventually retired — reproducible builds, promotion criteria, drift and decay detection, rollback, and inference cost. Owns ADLC Phases 7 and 8 and the G7-RELEASE and G8-OPERATE gates for model-bearing changes.

## What it produces

Writes `ops/slo.md`, `ops/runbooks/`, `handoffs.md`.

Reads `model and evaluation artifacts`, `design.md`, `ops/slo.md`, `changes/<name>/specs/<capability>/spec.md`.

## Phases and gates it owns

- ADLC phases: 7, 8
- Gates: `G7`, `G8`

## Skills it holds (14)

It loads these rather than working from memory, and records which it used in the handoff envelope:

- [Traceability](../../skills/lifecycle-method/navi-skill-traceability/README.md) — `lifecycle-method`
- [Phase gate protocol](../../skills/lifecycle-method/navi-skill-phase-gate-protocol/README.md) — `lifecycle-method`
- [Human checkpoints](../../skills/lifecycle-method/navi-skill-human-checkpoints/README.md) — `lifecycle-method`
- [Waivers and deferrals](../../skills/lifecycle-method/navi-skill-waivers-and-deferrals/README.md) — `lifecycle-method`
- [Handoff protocol](../../skills/lifecycle-method/navi-skill-handoff-protocol/README.md) — `lifecycle-method`
- [Model registry and promotion](../../skills/mlops/navi-skill-model-registry-and-promotion/README.md) — `mlops`
- [Drift monitoring](../../skills/mlops/navi-skill-drift-monitoring/README.md) — `mlops`
- [Model cards](../../skills/machine-learning/navi-skill-model-cards/README.md) — `machine-learning`
- [Evaluation design](../../skills/machine-learning/navi-skill-evaluation-design/README.md) — `machine-learning`
- [Data quality](../../skills/data-engineering/navi-skill-data-quality/README.md) — `data-engineering`
- [Progressive delivery](../../skills/platform-devops/navi-skill-progressive-delivery/README.md) — `platform-devops`
- [Observability](../../skills/platform-devops/navi-skill-observability/README.md) — `platform-devops`
- [Agent observability](../../skills/platform-devops/navi-skill-agent-observability/README.md) — `platform-devops`
- [Incident response](../../skills/platform-devops/navi-skill-incident-response/README.md) — `platform-devops`

## When it stops and asks a human

- A model in production has drifted past its threshold and rollback would restore a model with a known fairness problem
- The training run that produced a deployed model cannot be reproduced
- Inference cost has moved to a different order than the value case assumed
- A promotion is requested on an evaluation the candidate has already been tuned against
- Retraining would need data the current consent or retention position does not cover

## Hands off to

DevOps Engineer, Machine Learning Engineer, Product Owner, Orchestrator.

## Install

### This agent and the 14 skills it holds

```sh
git clone https://github.com/avinash-navikenz/agentic-skill-workflow.git
cd agentic-skill-workflow
./install.sh --agent navi-agent-mlops-engineer
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

This README is a summary and carries no rules. [navi-agent-mlops-engineer.agent.md](navi-agent-mlops-engineer.agent.md) is the authority — it holds its mission, mental model, how it decides, its definition of good, its working agreement and its skill-invocation plan. Nothing from it is repeated here, so the two cannot disagree.

## Notes

<!-- BEGIN NOTES -->

_Nothing hand-written yet. Anything between the NOTES markers survives regeneration; everything outside them is overwritten._

<!-- END NOTES -->

---

Generated by `python3 scripts/build_catalogue.py . --readmes` from this item's frontmatter and section headings. Edit the source file, not this one — except inside the NOTES block, which regeneration preserves.
