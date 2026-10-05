# Incident response

`navi-skill-incident-response` · skill · discipline `platform-devops` · ADLC phases 8, 9 · model `sonnet` · draft v0.1.0

Defines the severity scale drawn from observable impact, the incident commander role, the timeline record, the hotfix lane's deferred G2, the postmortem file the gate reads, and the rule that every INSIGHT-### goes to exactly one destination.

## When it fires

An alert has fired and the impact is user-visible; a fix has to reach production before the lane's normal gates could be recorded; an incident has ended and the postmortem is due; or G9 is about to be recorded and its insights have to go somewhere.

It is written to trigger on: `incident`, `outage`, `production is down`, `sev1`, `severity`, `page`, `incident commander`, `declare an incident`, `hotfix`, `emergency fix`, `rollback decision`, `timeline`, `postmortem`, `post-mortem`, `blameless`, `root cause`, `contributing cause`, `corrective action`, `INSIGHT`, `G9 feedback`.

## How to use it

Usually you do not have to. DevOps Engineer and MLOps Engineer load it when its trigger fires, which is what the trigger phrases above are for — describe the work and the skill arrives with it.

```
/navi-skill-incident-response
/navi-delivery:navi-skill-incident-response
```

The first form is an install into `~/.claude/skills`; the second is the plugin install, where skills are namespaced by the plugin they came from. Name it this way when the trigger did not fire, or when you want its rules applied to work that is already done.

It brings its rules and the checklist it is graded against. Ask it to run its own **Validation block** on the result — that is the part no style guide has: the rules arrive with something that can check them.

## What it produces

Copy into `delivery/ops/postmortems/<name>.md`. `navi-delivery archive` writes a stub at this path only when the file is absent, and only after the gates are settled — on `full` and `hotfix` this file exists first.

## What it rules out

The named failures the rules exist to prevent:

- Severity from the guess.
- Everyone commanding.
- Evidence before users.
- The forward fix under pressure.
- The timeline written from memory.
- The single root cause.
- The person as the cause.
- The insight routed twice.
- The postmortem archive wrote.

## Which agents hold it (2)

A skill is never invoked on its own — an agent loads it. These hold it:

- [DevOps Engineer](../../../agents/navi-agent-devops-engineer/README.md) — owns G7, G8
- [MLOps Engineer](../../../agents/navi-agent-mlops-engineer/README.md) — owns G7, G8

Through them it is reachable from gates `G7`, `G8`.

## Install

### This skill on its own

```sh
git clone https://github.com/avinash-navikenz/agentic-skill-workflow.git
cd agentic-skill-workflow
./install.sh --skill navi-skill-incident-response
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

This README is a summary and carries no rules. [SKILL.md](SKILL.md) is the authority — it holds 17 numbered rules, a decision table, a template, a checklist, an anti-pattern list, and a validation block a reader can run. Nothing from it is repeated here, so the two cannot disagree.

## Notes

<!-- BEGIN NOTES -->

_Nothing hand-written yet. Anything between the NOTES markers survives regeneration; everything outside them is overwritten._

<!-- END NOTES -->

---

Generated by `python3 scripts/build_catalogue.py . --readmes` from this item's frontmatter and section headings. Edit the source file, not this one — except inside the NOTES block, which regeneration preserves.
