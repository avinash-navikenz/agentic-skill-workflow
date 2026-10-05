# Product Owner

`navi-agent-product-owner` · agent · discipline `product-management` · ADLC phases 1, 9 · owns G1, G9 · model `opus` · draft v0.1.0

Make sure the thing being built is worth building, is bounded, and will be measurable as a result rather than as an activity.

## When it fires

Use when deciding whether a change is worth making, what it commits to, and what it deliberately will not do — and later, whether the shipped change moved the measure it promised. Owns ADLC Phases 1 and 9 and the G1-INTENT and G9-FEEDBACK gates.

## What it produces

Writes `proposal.md`, `ops/postmortems/<name>.md`, `handoffs.md`.

Reads `project.md`, `specs/<capability>/spec.md`, `ops/slo.md`, `ops/postmortems/`.

## Phases and gates it owns

- ADLC phases: 1, 9
- Gates: `G1`, `G9`

## Skills it holds (13)

It loads these rather than working from memory, and records which it used in the handoff envelope:

- [Change proposal](../../skills/spec-driven-development/navi-skill-change-proposal/README.md) — `spec-driven-development`
- [Lane selection](../../skills/lifecycle-method/navi-skill-lane-selection/README.md) — `lifecycle-method`
- [Spec authoring](../../skills/spec-driven-development/navi-skill-spec-authoring/README.md) — `spec-driven-development`
- [Acceptance criteria](../../skills/spec-driven-development/navi-skill-acceptance-criteria/README.md) — `spec-driven-development`
- [Traceability](../../skills/lifecycle-method/navi-skill-traceability/README.md) — `lifecycle-method`
- [Phase gate protocol](../../skills/lifecycle-method/navi-skill-phase-gate-protocol/README.md) — `lifecycle-method`
- [Waivers and deferrals](../../skills/lifecycle-method/navi-skill-waivers-and-deferrals/README.md) — `lifecycle-method`
- [Human checkpoints](../../skills/lifecycle-method/navi-skill-human-checkpoints/README.md) — `lifecycle-method`
- [Handoff protocol](../../skills/lifecycle-method/navi-skill-handoff-protocol/README.md) — `lifecycle-method`
- [Outcome and KPI definition](../../skills/product-management/navi-skill-outcome-and-kpi-definition/README.md) — `product-management`
- [Backlog prioritisation](../../skills/product-management/navi-skill-backlog-prioritisation/README.md) — `product-management`
- [Work item sync](../../skills/integration/navi-skill-work-item-sync/README.md) — `integration`
- [Requirements elicitation](../../skills/business-analysis/navi-skill-requirements-elicitation/README.md) — `business-analysis`

## When it stops and asks a human

- The outcome a stakeholder wants has no measure anyone will commit to owning
- A change's value case depends on a claim nobody in the room can source
- Two committed outcomes are in direct conflict and both have sponsors
- A shipped change moved its KPI the wrong way and the decision is whether to revert or persevere
- A non-goal is being quietly re-admitted as scope

## Hands off to

Business Analyst, Orchestrator, Architect.

## Install

### This agent and the 13 skills it holds

```sh
git clone https://github.com/avinash-navikenz/agentic-skill-workflow.git
cd agentic-skill-workflow
./install.sh --agent navi-agent-product-owner
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

This README is a summary and carries no rules. [navi-agent-product-owner.agent.md](navi-agent-product-owner.agent.md) is the authority — it holds its mission, mental model, how it decides, its definition of good, its working agreement and its skill-invocation plan. Nothing from it is repeated here, so the two cannot disagree.

## Notes

<!-- BEGIN NOTES -->

_Nothing hand-written yet. Anything between the NOTES markers survives regeneration; everything outside them is overwritten._

<!-- END NOTES -->

---

Generated by `python3 scripts/build_catalogue.py . --readmes` from this item's frontmatter and section headings. Edit the source file, not this one — except inside the NOTES block, which regeneration preserves.
