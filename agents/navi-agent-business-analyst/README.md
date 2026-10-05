# Business Analyst

`navi-agent-business-analyst` · agent · discipline `business-analysis` · ADLC phase 2 · owns G2 · model `opus` · draft v0.1.0

Turn an approved intent into a specification precise enough that two competent engineers building from it independently would produce the same behaviour.

## When it fires

Use when turning an approved intent into an unambiguous, testable specification. Owns ADLC Phase 2 and the G2-SPEC gate.

## How to use it

At Phase 2 the Orchestrator hands over to it, and that is the path the lifecycle takes on its own. To reach it directly, it ships a slash command of its own — an agent is called the same way a skill is.

```
/navi-agent-business-analyst <what you want decided>
/navi-delivery:navi-agent-business-analyst <what you want decided>
```

The command is generated from this agent and travels with it: `install.sh --agent navi-agent-business-analyst` puts it in `~/.claude/commands`, and the plugin install namespaces it under the plugin. Asking in prose works too — *use navi-agent-business-analyst to ...* — the command only saves you remembering the name.

It loads the skills listed below rather than working from memory, and the command asks it to say which it used. If it answers without naming one, the skill did not load.

## What it produces

Writes `changes/<name>/specs/<capability>/spec.md`, `handoffs.md`.

Reads `proposal.md`, `project.md`, `specs/<capability>/spec.md`.

## Phases and gates it owns

- ADLC phases: 2
- Gates: `G2`

## Skills it holds (10)

It loads these rather than working from memory, and records which it used in the handoff envelope:

- [Spec authoring](../../skills/spec-driven-development/navi-skill-spec-authoring/README.md) — `spec-driven-development`
- [Acceptance criteria](../../skills/spec-driven-development/navi-skill-acceptance-criteria/README.md) — `spec-driven-development`
- [Traceability](../../skills/lifecycle-method/navi-skill-traceability/README.md) — `lifecycle-method`
- [Change proposal](../../skills/spec-driven-development/navi-skill-change-proposal/README.md) — `spec-driven-development`
- [Phase gate protocol](../../skills/lifecycle-method/navi-skill-phase-gate-protocol/README.md) — `lifecycle-method`
- [Handoff protocol](../../skills/lifecycle-method/navi-skill-handoff-protocol/README.md) — `lifecycle-method`
- [Human checkpoints](../../skills/lifecycle-method/navi-skill-human-checkpoints/README.md) — `lifecycle-method`
- [Requirements elicitation](../../skills/business-analysis/navi-skill-requirements-elicitation/README.md) — `business-analysis`
- [Non functional requirements](../../skills/business-analysis/navi-skill-non-functional-requirements/README.md) — `business-analysis`
- [Outcome and KPI definition](../../skills/product-management/navi-skill-outcome-and-kpi-definition/README.md) — `product-management`

## When it stops and asks a human

- A requirement in the delta spec contradicts a requirement in the current capability spec
- An acceptance criterion cannot be made objectively testable after a genuine attempt
- A regulatory, privacy or data-residency constraint surfaces that the proposal did not anticipate
- The requirement owner named for spec sign-off does not exist or will not commit

## Hands off to

Architect, QA Engineer, Orchestrator.

## Install

### This agent and the 10 skills it holds

```sh
git clone https://github.com/avinash-navikenz/agentic-skill-workflow.git
cd agentic-skill-workflow
./install.sh --agent navi-agent-business-analyst
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

This README is a summary and carries no rules. [navi-agent-business-analyst.agent.md](navi-agent-business-analyst.agent.md) is the authority — it holds its mission, mental model, how it decides, its definition of good, its working agreement and its skill-invocation plan. Nothing from it is repeated here, so the two cannot disagree.

## Notes

<!-- BEGIN NOTES -->

_Nothing hand-written yet. Anything between the NOTES markers survives regeneration; everything outside them is overwritten._

<!-- END NOTES -->

---

Generated by `python3 scripts/build_catalogue.py . --readmes` from this item's frontmatter and section headings. Edit the source file, not this one — except inside the NOTES block, which regeneration preserves.
