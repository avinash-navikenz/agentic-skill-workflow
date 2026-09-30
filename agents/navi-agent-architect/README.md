# Architect

`navi-agent-architect` · agent · discipline `architecture` · ADLC phases 3, 9 · owns G3, G9 · model `opus` · draft v0.1.0

Choose the approach whose failure modes we can live with, write down why the rejected alternatives were rejected, and leave the next person able to change their mind cheaply.

## When it fires

Use when choosing the technical approach for a change — its boundaries, its quality attributes, its failure modes, and what we are buying versus building — and when reviewing whether what was built matches what was decided. Owns ADLC Phases 3 and 9 and the G3-DESIGN gate.

## What it produces

Writes `design.md`, `decisions/ADR-###.md`, `handoffs.md`.

Reads `changes/<name>/specs/<capability>/spec.md`, `proposal.md`, `project.md`, `decisions/ADR-###.md`.

## Phases and gates it owns

- ADLC phases: 3, 9
- Gates: `G3`, `G9`

## Skills it holds (15)

It loads these rather than working from memory, and records which it used in the handoff envelope:

- [Spec authoring](../../skills/spec-driven-development/navi-skill-spec-authoring/README.md) — `spec-driven-development`
- [Change proposal](../../skills/spec-driven-development/navi-skill-change-proposal/README.md) — `spec-driven-development`
- [Task decomposition](../../skills/spec-driven-development/navi-skill-task-decomposition/README.md) — `spec-driven-development`
- [Traceability](../../skills/lifecycle-method/navi-skill-traceability/README.md) — `lifecycle-method`
- [Lane selection](../../skills/lifecycle-method/navi-skill-lane-selection/README.md) — `lifecycle-method`
- [Phase gate protocol](../../skills/lifecycle-method/navi-skill-phase-gate-protocol/README.md) — `lifecycle-method`
- [Human checkpoints](../../skills/lifecycle-method/navi-skill-human-checkpoints/README.md) — `lifecycle-method`
- [Handoff protocol](../../skills/lifecycle-method/navi-skill-handoff-protocol/README.md) — `lifecycle-method`
- [Quality attributes](../../skills/architecture/navi-skill-quality-attributes/README.md) — `architecture`
- [Non functional requirements](../../skills/business-analysis/navi-skill-non-functional-requirements/README.md) — `business-analysis`
- [Interface contracts](../../skills/architecture/navi-skill-interface-contracts/README.md) — `architecture`
- [API design](../../skills/software-development/navi-skill-api-design/README.md) — `software-development`
- [Threat modelling](../../skills/architecture/navi-skill-threat-modelling/README.md) — `architecture`
- [Decision records](../../skills/architecture/navi-skill-decision-records/README.md) — `architecture`
- [Code review](../../skills/software-development/navi-skill-code-review/README.md) — `software-development`

## When it stops and asks a human

- The approach that meets the specified quality attributes costs materially more than the change was funded for
- A quality attribute in the spec is unachievable on the current platform
- The decision commits the organisation to a vendor, licence or data location beyond this change
- Two viable approaches differ mainly in who carries the operational burden afterwards
- A deliberate debt is being taken with no named owner or no repayment trigger

## Hands off to

Fullstack Developer, Data Engineer, Machine Learning Engineer, DevOps Engineer, QA Engineer, Orchestrator.

## Install

### This agent on its own

```sh
python3 scripts/build_adapters.py .
cp adapters/claude-code/agents/navi-agent-architect.md ~/.claude/agents/
```

Installed on its own, this agent arrives **without the skills it holds**. It is written to load them rather than work from memory, so on its own it will reach for files that are not there. Useful for reading its judgment — not how the framework is meant to run.

### The whole framework

`adapters/claude-code/` is the installable artefact: generated output in the flat layout the convention uses (`skills/<name>/SKILL.md`, `agents/<name>.md`) with its own `.claude-plugin/plugin.json`, so the directory is a complete plugin on its own. The repository root also carries a plugin manifest, but its skills are nested a level deeper and that layout has not been verified to load in any harness — do not install the repo root.

```sh
python3 scripts/build_adapters.py .   # adapters/ is generated; refresh it first
./install.sh --yes                    # symlinks 39 skills + 11 agents into ~/.claude
```

`--copy` installs copies instead of symlinks; `--uninstall` removes exactly what it installed; `CLAUDE_SKILLS_DIR` and `CLAUDE_AGENTS_DIR` override the destinations (which default to `$HOME/.claude/skills` and `$HOME/.claude/agents`). Prerequisites are Node 20 or newer and Python 3, and nothing else.

## Where the rules live

This README is a summary and carries no rules. [navi-agent-architect.agent.md](navi-agent-architect.agent.md) is the authority — it holds its mission, mental model, how it decides, its definition of good, its working agreement and its skill-invocation plan. Nothing from it is repeated here, so the two cannot disagree.

## Notes

<!-- BEGIN NOTES -->

_Nothing hand-written yet. Anything between the NOTES markers survives regeneration; everything outside them is overwritten._

<!-- END NOTES -->

---

Generated by `python3 scripts/build_catalogue.py . --readmes` from this item's frontmatter and section headings. Edit the source file, not this one — except inside the NOTES block, which regeneration preserves.
