# Agent observability

`navi-skill-agent-observability` · skill · discipline `platform-devops` · ADLC phases 7, 8 · model `sonnet` · draft v0.1.0

Defines delivery/ops/agent-telemetry.md, the SPAN-### register, the derived ids that keep a retry on one trace, the attributes that make cost and latency attributable, the content capture decision, how an evaluation result attaches, and the dated proof that spans arrived and rendered.

## When it fires

An agent is about to serve users and no span register exists; a trace is being read and the question it was opened for cannot be answered from it; a cost pivot shows thousands of one-off identities; a dashboard is empty and the argument is whether the exporter ran; a retried run has turned into two unrelated traces; or prompts are being captured because the SDK captures them by default and nobody has been asked whether that is allowed. `navi-skill-observability` owns what the product promises — the SLI, the objective, the error budget, the alert and the runbook. This skill owns what the agents emit, so that a run that has already happened can be taken apart. `navi-delivery telemetry` exports the delivery ledger and nothing else: it makes no model calls, so the agents' own spans are this file's job and no command in this repository will produce them.

It is written to trigger on: `agent observability`, `LLM tracing`, `trace an agent run`, `span`, `OpenTelemetry`, `OTLP`, `GenAI semantic conventions`, `gen_ai attributes`, `token usage`, `LLM cost attribution`, `prompt capture`, `tool call span`, `llm.span.kind`, `service.name`, `AgentObs`, `Opik`, `LangSmith`, `trace id`, `span id`, `eval attached to a span`, `empty dashboard`.

## How to use it

Usually you do not have to. MLOps Engineer loads it when its trigger fires, which is what the trigger phrases above are for — describe the work and the skill arrives with it.

```
/navi-skill-agent-observability
/navi-delivery:navi-skill-agent-observability
```

The first form is an install into `~/.claude/skills`; the second is the plugin install, where skills are namespaced by the plugin they came from. Name it this way when the trigger did not fire, or when you want its rules applied to work that is already done.

It brings its rules and the checklist it is graded against. Ask it to run its own **Validation block** on the result — that is the part no style guide has: the rules arrive with something that can check them.

## What it produces

The register, at `delivery/ops/agent-telemetry.md`.

## What it rules out

The named failures the rules exist to prevent:

- The kind that renders nowhere.
- One identity per run.
- The forked retry.
- Cost that is quietly short.
- The failure that was never emitted.
- Prompts by default.
- The batch lost to one field.
- The offline label.
- Nanoseconds as numbers.
- Configured, not arrived.

## Which agents hold it (1)

A skill is never invoked on its own — an agent loads it. These hold it:

- [MLOps Engineer](../../../agents/navi-agent-mlops-engineer/README.md) — owns G7, G8

Through them it is reachable from gates `G7`, `G8`.

## Install

### This skill on its own

```sh
git clone https://github.com/avinash-navikenz/agentic-skill-workflow.git
cd agentic-skill-workflow
./install.sh --skill navi-skill-agent-observability
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

This README is a summary and carries no rules. [SKILL.md](SKILL.md) is the authority — it holds 18 numbered rules, a decision table, a template, a checklist, an anti-pattern list, and a validation block a reader can run. Nothing from it is repeated here, so the two cannot disagree.

## Notes

<!-- BEGIN NOTES -->

_Nothing hand-written yet. Anything between the NOTES markers survives regeneration; everything outside them is overwritten._

<!-- END NOTES -->

---

Generated by `python3 scripts/build_catalogue.py . --readmes` from this item's frontmatter and section headings. Edit the source file, not this one — except inside the NOTES block, which regeneration preserves.
