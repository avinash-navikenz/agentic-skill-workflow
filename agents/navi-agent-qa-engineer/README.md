# QA Engineer

`navi-agent-qa-engineer` · agent · discipline `quality-engineering` · ADLC phase 6 · owns G6 · model `sonnet` · draft v0.1.0

Find out where this change is most likely to hurt someone, spend the testing effort there, and give the release decision an honest statement of what is proven and what is merely untested.

## When it fires

Use when deciding what to test, how much, and whether a change is safe to release — risk-based coverage, test design, flakiness, and the release-blocking call. Owns ADLC Phase 6 and the G6-QUALITY gate, and is consulted at Phase 2 for testability.

## How to use it

At Phase 6 the Orchestrator hands over to it, and that is the path the lifecycle takes on its own. To reach it directly, it ships a slash command of its own — an agent is called the same way a skill is.

```
/navi-agent-qa-engineer <what you want decided>
/navi-delivery:navi-agent-qa-engineer <what you want decided>
```

The command is generated from this agent and travels with it: `install.sh --agent navi-agent-qa-engineer` puts it in `~/.claude/commands`, and the plugin install namespaces it under the plugin. Asking in prose works too — *use navi-agent-qa-engineer to ...* — the command only saves you remembering the name.

It loads the skills listed below rather than working from memory, and the command asks it to say which it used. If it answers without naming one, the skill did not load.

## What it produces

Writes `test artifacts`, `gate evidence`, `handoffs.md`.

Reads `changes/<name>/specs/<capability>/spec.md`, `design.md`, `tasks.md`, `source changes`.

## Phases and gates it owns

- ADLC phases: 6
- Gates: `G6`

## Skills it holds (10)

It loads these rather than working from memory, and records which it used in the handoff envelope:

- [Acceptance criteria](../../skills/spec-driven-development/navi-skill-acceptance-criteria/README.md) — `spec-driven-development`
- [Spec authoring](../../skills/spec-driven-development/navi-skill-spec-authoring/README.md) — `spec-driven-development`
- [Traceability](../../skills/lifecycle-method/navi-skill-traceability/README.md) — `lifecycle-method`
- [Phase gate protocol](../../skills/lifecycle-method/navi-skill-phase-gate-protocol/README.md) — `lifecycle-method`
- [Waivers and deferrals](../../skills/lifecycle-method/navi-skill-waivers-and-deferrals/README.md) — `lifecycle-method`
- [Handoff protocol](../../skills/lifecycle-method/navi-skill-handoff-protocol/README.md) — `lifecycle-method`
- [Quality attributes](../../skills/architecture/navi-skill-quality-attributes/README.md) — `architecture`
- [Test strategy](../../skills/quality-engineering/navi-skill-test-strategy/README.md) — `quality-engineering`
- [Test design](../../skills/quality-engineering/navi-skill-test-design/README.md) — `quality-engineering`
- [Release readiness](../../skills/quality-engineering/navi-skill-release-readiness/README.md) — `quality-engineering`

## When it stops and asks a human

- A release-blocking defect is disputed by the person who owns the date
- An acceptance criterion cannot be tested without access, data or an environment we do not have
- The same test has been quarantined twice and the underlying behaviour is still unknown
- A defect's severity depends on a business consequence nobody has quantified
- Shipping is requested with a known failure in a path the spec says must work

## Hands off to

Fullstack Developer, Data Engineer, Machine Learning Engineer, DevOps Engineer, Orchestrator.

## Install

### This agent and the 10 skills it holds

```sh
git clone https://github.com/avinash-navikenz/agentic-skill-workflow.git
cd agentic-skill-workflow
./install.sh --agent navi-agent-qa-engineer
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

This README is a summary and carries no rules. [navi-agent-qa-engineer.agent.md](navi-agent-qa-engineer.agent.md) is the authority — it holds its mission, mental model, how it decides, its definition of good, its working agreement and its skill-invocation plan. Nothing from it is repeated here, so the two cannot disagree.

## Notes

<!-- BEGIN NOTES -->

_Nothing hand-written yet. Anything between the NOTES markers survives regeneration; everything outside them is overwritten._

<!-- END NOTES -->

---

Generated by `python3 scripts/build_catalogue.py . --readmes` from this item's frontmatter and section headings. Edit the source file, not this one — except inside the NOTES block, which regeneration preserves.
