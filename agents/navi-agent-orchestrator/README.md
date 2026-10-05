# Orchestrator

`navi-agent-orchestrator` · agent · discipline `lifecycle-method` · ADLC phases 1, 2, 3, 4, 5, 6, 7, 8, 9 · owns no gate (it enforces gates the personas own) · model `opus` · draft v0.1.0

Keep a change moving at the smallest amount of process that is still honest about its risk, and make every skipped, failed or waived gate visible rather than convenient.

## When it fires

Use when routing a change through the ADLC — choosing its lane, deciding whether it may advance, arbitrating between personas, and ordering rework after a failed gate. Owns ADLC Phases 1 through 9 and enforces every gate in the active lane's set.

## What it produces

Writes `handoffs.md`, `.adlc/state.json`, `.adlc/events.jsonl`.

Reads `.adlc/state.json`, `.adlc/events.jsonl`, `.adlc/waivers.md`, `proposal.md`, `handoffs.md`.

## Phases and gates it owns

- ADLC phases: 1, 2, 3, 4, 5, 6, 7, 8, 9
- Gates: none — it enforces the gates the persona agents own

## Skills it holds (9)

It loads these rather than working from memory, and records which it used in the handoff envelope:

- [Phase gate protocol](../../skills/lifecycle-method/navi-skill-phase-gate-protocol/README.md) — `lifecycle-method`
- [Lane selection](../../skills/lifecycle-method/navi-skill-lane-selection/README.md) — `lifecycle-method`
- [Waivers and deferrals](../../skills/lifecycle-method/navi-skill-waivers-and-deferrals/README.md) — `lifecycle-method`
- [Human checkpoints](../../skills/lifecycle-method/navi-skill-human-checkpoints/README.md) — `lifecycle-method`
- [Handoff protocol](../../skills/lifecycle-method/navi-skill-handoff-protocol/README.md) — `lifecycle-method`
- [Traceability](../../skills/lifecycle-method/navi-skill-traceability/README.md) — `lifecycle-method`
- [Change proposal](../../skills/spec-driven-development/navi-skill-change-proposal/README.md) — `spec-driven-development`
- [Task decomposition](../../skills/spec-driven-development/navi-skill-task-decomposition/README.md) — `spec-driven-development`
- [Work item sync](../../skills/integration/navi-skill-work-item-sync/README.md) — `integration`

## When it stops and asks a human

- Two personas disagree on a decision and neither position can be reconciled against the spec
- A change has outgrown its lane and re-proposing would abandon work already approved
- A decision the change is blocked on belongs to someone no persona in this roster represents — legal, finance, procurement, or another team's on-call
- The same gate has failed three times and the rework is not converging
- A lane's gate set is being argued around rather than met

## Hands off to

Product Owner, Business Analyst, Architect, Fullstack Developer, Data Engineer, Machine Learning Engineer, QA Engineer, DevOps Engineer, MLOps Engineer.

## Install

### This agent and the 9 skills it holds

```sh
git clone https://github.com/avinash-navikenz/agentic-skill-workflow.git
cd agentic-skill-workflow
./install.sh --agent navi-agent-orchestrator
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

This README is a summary and carries no rules. [navi-agent-orchestrator.agent.md](navi-agent-orchestrator.agent.md) is the authority — it holds its mission, mental model, how it decides, its definition of good, its working agreement and its skill-invocation plan. Nothing from it is repeated here, so the two cannot disagree.

## Notes

<!-- BEGIN NOTES -->

_Nothing hand-written yet. Anything between the NOTES markers survives regeneration; everything outside them is overwritten._

<!-- END NOTES -->

---

Generated by `python3 scripts/build_catalogue.py . --readmes` from this item's frontmatter and section headings. Edit the source file, not this one — except inside the NOTES block, which regeneration preserves.
