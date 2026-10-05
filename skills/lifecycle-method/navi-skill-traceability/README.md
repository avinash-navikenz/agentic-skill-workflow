# Traceability

`navi-skill-traceability` · skill · discipline `lifecycle-method` · ADLC phases 2, 3, 5, 6, 8, 9 · model `sonnet` · draft v0.1.0

Defines the ID chain, the numbering rules, the `Implements:` convention, and the orphan classes T0 through T4 that the validator reports.

## When it fires

An artifact with an ID is being written or reviewed, or `validate` is reporting an orphan.

It is written to trigger on: `traceability`, `Implements`, `REQ-`, `AC-`, `TASK-`, `ADR-`, `SLI-`, `INSIGHT-`, `orphan`, `orphaned requirement`, `T1`, `T2`, `T3`, `T4`, `validate --strict`, `ID chain`.

## How to use it

Usually you do not have to. Orchestrator, Product Owner and Business Analyst, and 8 more, load it when its trigger fires, which is what the trigger phrases above are for — describe the work and the skill arrives with it.

```
/navi-skill-traceability
/navi-delivery:navi-skill-traceability
```

The first form is an install into `~/.claude/skills`; the second is the plugin install, where skills are namespaced by the plugin they came from. Name it this way when the trigger did not fire, or when you want its rules applied to work that is already done.

It brings its rules and the checklist it is graded against. Ask it to run its own **Validation block** on the result — that is the part no style guide has: the rules arrive with something that can check them.

## What it produces

A spec that traces cleanly.

## What it rules out

The named failures the rules exist to prevent:

- Unbolded task.
- `Implements:` too far from the task.
- Requirement in a paragraph.
- Criterion under the wrong requirement.
- Renaming to silence T3.
- Reused number.
- Insight with no destination.

## Which agents hold it (11)

A skill is never invoked on its own — an agent loads it. These hold it:

- [Orchestrator](../../../agents/navi-agent-orchestrator/README.md)
- [Product Owner](../../../agents/navi-agent-product-owner/README.md) — owns G1, G9
- [Business Analyst](../../../agents/navi-agent-business-analyst/README.md) — owns G2
- [Architect](../../../agents/navi-agent-architect/README.md) — owns G3, G9
- [Fullstack Developer](../../../agents/navi-agent-fullstack-developer/README.md) — owns G5
- [Data Engineer](../../../agents/navi-agent-data-engineer/README.md) — owns G4, G5
- [Machine Learning Engineer](../../../agents/navi-agent-machine-learning-engineer/README.md) — owns G4, G5
- [QA Engineer](../../../agents/navi-agent-qa-engineer/README.md) — owns G6
- [DevOps Engineer](../../../agents/navi-agent-devops-engineer/README.md) — owns G7, G8
- [MLOps Engineer](../../../agents/navi-agent-mlops-engineer/README.md) — owns G7, G8
- [Security Engineer](../../../agents/navi-agent-security-engineer/README.md) — owns G3, G6

Through them it is reachable from gates `G1`, `G2`, `G3`, `G4`, `G5`, `G6`, `G7`, `G8`, `G9`.

## Install

### This skill on its own

```sh
git clone https://github.com/avinash-navikenz/agentic-skill-workflow.git
cd agentic-skill-workflow
./install.sh --skill navi-skill-traceability
```

This installs the one skill. Nothing in the lifecycle will invoke it on its own — no phase loads it and no gate depends on it, because it is an agent that decides when a skill applies — but you can name it directly in a session. To get it loaded automatically, install one of the agents that hold it instead.

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

This README is a summary and carries no rules. [SKILL.md](SKILL.md) is the authority — it holds 12 numbered rules, a decision table, a template, a checklist, an anti-pattern list, and a validation block a reader can run. Nothing from it is repeated here, so the two cannot disagree.

## Notes

<!-- BEGIN NOTES -->

_Nothing hand-written yet. Anything between the NOTES markers survives regeneration; everything outside them is overwritten._

<!-- END NOTES -->

---

Generated by `python3 scripts/build_catalogue.py . --readmes` from this item's frontmatter and section headings. Edit the source file, not this one — except inside the NOTES block, which regeneration preserves.
