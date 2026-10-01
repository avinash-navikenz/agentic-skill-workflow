# Fullstack Developer

`navi-agent-fullstack-developer` · agent · discipline `software-development` · ADLC phase 5 · owns G5 · model `sonnet` · draft v0.1.0

Turn a signed-off spec and design into working, reviewable, reversible increments — each one traceable to the requirement it serves and provable by something other than my own assertion.

## When it fires

Use when implementing a specified and designed change — decomposing it into tasks, choosing contracts and seams, and deciding what to refactor versus leave alone. Owns ADLC Phase 5 and the G5-BUILD gate, which it co-owns with the Data and ML Engineers on a change that touches data or a model.

## What it produces

Writes `tasks.md`, `source changes`, `handoffs.md`.

Reads `changes/<name>/specs/<capability>/spec.md`, `design.md`, `decisions/ADR-###.md`, `tasks.md`.

## Phases and gates it owns

- ADLC phases: 5
- Gates: `G5`

## Skills it holds (18)

It loads these rather than working from memory, and records which it used in the handoff envelope:

- [Task decomposition](../../skills/spec-driven-development/navi-skill-task-decomposition/README.md) — `spec-driven-development`
- [Traceability](../../skills/lifecycle-method/navi-skill-traceability/README.md) — `lifecycle-method`
- [Phase gate protocol](../../skills/lifecycle-method/navi-skill-phase-gate-protocol/README.md) — `lifecycle-method`
- [Handoff protocol](../../skills/lifecycle-method/navi-skill-handoff-protocol/README.md) — `lifecycle-method`
- [Test driven development](../../skills/software-development/navi-skill-test-driven-development/README.md) — `software-development`
- [Interface contracts](../../skills/architecture/navi-skill-interface-contracts/README.md) — `architecture`
- [API design](../../skills/software-development/navi-skill-api-design/README.md) — `software-development`
- [Secure coding](../../skills/software-development/navi-skill-secure-coding/README.md) — `software-development`
- [Code review](../../skills/software-development/navi-skill-code-review/README.md) — `software-development`
- [Pull requests](../../skills/software-development/navi-skill-pull-requests/README.md) — `software-development`
- [Version control workflow](../../skills/software-development/navi-skill-version-control-workflow/README.md) — `software-development`
- [Commit craft](../../skills/software-development/navi-skill-commit-craft/README.md) — `software-development`
- [Branching](../../skills/software-development/navi-skill-branching/README.md) — `software-development`
- [Merge conflicts](../../skills/software-development/navi-skill-merge-conflicts/README.md) — `software-development`
- [Dependency vulnerabilities](../../skills/security/navi-skill-dependency-vulnerabilities/README.md) — `security`
- [Pipeline automation](../../skills/platform-devops/navi-skill-pipeline-automation/README.md) — `platform-devops`
- [Test strategy](../../skills/quality-engineering/navi-skill-test-strategy/README.md) — `quality-engineering`
- [Test design](../../skills/quality-engineering/navi-skill-test-design/README.md) — `quality-engineering`

## When it stops and asks a human

- A requirement cannot be implemented as specified without changing observable behaviour the spec did not mention
- The design's contract and an existing consumer of that interface cannot both be satisfied
- Implementing the change requires touching code with no tests and no owner
- A task that was sized in hours has been open for days and the reason is not yet understood
- Delivering on the date requires shipping a path the tests do not cover

## Hands off to

QA Engineer, Architect, DevOps Engineer, Orchestrator.

## Install

### This agent on its own

```sh
python3 scripts/build_adapters.py .
cp adapters/claude-code/agents/navi-agent-fullstack-developer.md ~/.claude/agents/
```

Installed on its own, this agent arrives **without the skills it holds**. It is written to load them rather than work from memory, so on its own it will reach for files that are not there. Useful for reading its judgment — not how the framework is meant to run.

### The whole framework

`adapters/claude-code/` is the installable artefact: generated output in the flat layout the convention uses (`skills/<name>/SKILL.md`, `agents/<name>.md`) with its own `.claude-plugin/plugin.json`, so the directory is a complete plugin on its own. The repository root also carries a plugin manifest, but its skills are nested a level deeper and that layout has not been verified to load in any harness — do not install the repo root.

```sh
python3 scripts/build_adapters.py .   # adapters/ is generated; refresh it first
./install.sh --yes                    # symlinks 50 skills + 11 agents into ~/.claude
```

`--copy` installs copies instead of symlinks; `--uninstall` removes exactly what it installed; `CLAUDE_SKILLS_DIR` and `CLAUDE_AGENTS_DIR` override the destinations (which default to `$HOME/.claude/skills` and `$HOME/.claude/agents`). Prerequisites are Node 20 or newer and Python 3, and nothing else.

## Where the rules live

This README is a summary and carries no rules. [navi-agent-fullstack-developer.agent.md](navi-agent-fullstack-developer.agent.md) is the authority — it holds its mission, mental model, how it decides, its definition of good, its working agreement and its skill-invocation plan. Nothing from it is repeated here, so the two cannot disagree.

## Notes

<!-- BEGIN NOTES -->

_Nothing hand-written yet. Anything between the NOTES markers survives regeneration; everything outside them is overwritten._

<!-- END NOTES -->

---

Generated by `python3 scripts/build_catalogue.py . --readmes` from this item's frontmatter and section headings. Edit the source file, not this one — except inside the NOTES block, which regeneration preserves.
