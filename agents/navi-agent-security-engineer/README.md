# Security Engineer

`navi-agent-security-engineer` · agent · discipline `security` · ADLC phases 3, 6 · owns G3, G6 · model `opus` · draft v0.1.0

Find out how this change could be turned against us while the answer is still cheap to act on, and put what I find in front of the people who carry the loss while they still have options other than accepting it.

## When it fires

Use when a change could be turned against us — who can reach what, where data crosses a trust boundary, what an attacker would gain, and whether a known weakness is one we can live with. Owns ADLC Phases 3 and 6 alongside the Architect and the QA Engineer, and co-owns the G3-DESIGN and G6-QUALITY gates.

## What it produces

Writes `threat model`, `security findings`, `decisions/ADR-###.md`, `gate evidence`, `handoffs.md`, `.adlc/waivers.md`.

Reads `changes/<name>/specs/<capability>/spec.md`, `design.md`, `decisions/ADR-###.md`, `tasks.md`, `source changes`.

## Phases and gates it owns

- ADLC phases: 3, 6
- Gates: `G3`, `G6`

## Skills it holds (12)

It loads these rather than working from memory, and records which it used in the handoff envelope:

- [Spec authoring](../../skills/spec-driven-development/navi-skill-spec-authoring/README.md) — `spec-driven-development`
- [Lane selection](../../skills/lifecycle-method/navi-skill-lane-selection/README.md) — `lifecycle-method`
- [Traceability](../../skills/lifecycle-method/navi-skill-traceability/README.md) — `lifecycle-method`
- [Phase gate protocol](../../skills/lifecycle-method/navi-skill-phase-gate-protocol/README.md) — `lifecycle-method`
- [Human checkpoints](../../skills/lifecycle-method/navi-skill-human-checkpoints/README.md) — `lifecycle-method`
- [Waivers and deferrals](../../skills/lifecycle-method/navi-skill-waivers-and-deferrals/README.md) — `lifecycle-method`
- [Handoff protocol](../../skills/lifecycle-method/navi-skill-handoff-protocol/README.md) — `lifecycle-method`
- [Threat modelling](../../skills/architecture/navi-skill-threat-modelling/README.md) — `architecture`
- [Decision records](../../skills/architecture/navi-skill-decision-records/README.md) — `architecture`
- [Secure coding](../../skills/software-development/navi-skill-secure-coding/README.md) — `software-development`
- [Dependency vulnerabilities](../../skills/security/navi-skill-dependency-vulnerabilities/README.md) — `security`
- [Azure identity and secrets](../../skills/platform-devops/navi-skill-azure-identity-and-secrets/README.md) — `platform-devops`

## When it stops and asks a human

- A weakness is found in something already running, so fixing it and telling the people it exposes are the same decision
- The risk left after mitigation is being accepted by someone who does not carry the loss if it lands
- The change moves personal or regulated data somewhere the organisation has not agreed it may go
- A credential or key is exposed and the things depending on it cannot be rotated without an outage
- A finding's severity turns on whether an attacker is already inside, and nobody can say whether they are

## Hands off to

Architect, Fullstack Developer, Data Engineer, Machine Learning Engineer, QA Engineer, DevOps Engineer, Orchestrator.

## Install

### This agent and the 12 skills it holds

```sh
git clone https://github.com/avinash-navikenz/agentic-skill-workflow.git
cd agentic-skill-workflow
./install.sh --agent navi-agent-security-engineer
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

This README is a summary and carries no rules. [navi-agent-security-engineer.agent.md](navi-agent-security-engineer.agent.md) is the authority — it holds its mission, mental model, how it decides, its definition of good, its working agreement and its skill-invocation plan. Nothing from it is repeated here, so the two cannot disagree.

## Notes

<!-- BEGIN NOTES -->

_Nothing hand-written yet. Anything between the NOTES markers survives regeneration; everything outside them is overwritten._

<!-- END NOTES -->

---

Generated by `python3 scripts/build_catalogue.py . --readmes` from this item's frontmatter and section headings. Edit the source file, not this one — except inside the NOTES block, which regeneration preserves.
