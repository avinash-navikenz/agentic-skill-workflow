# Azure landing zone

`navi-skill-azure-landing-zone` · skill · discipline `platform-devops` · ADLC phases 5, 7 · model `sonnet` · draft v0.1.0

Defines the landing-zone register, the management-group tree a new subscription inherits from, the SUB-### row with its budget, the naming patterns, the required tag set, and the POL-### assignment recorded as code rather than created in the portal.

## When it fires

A workload is about to be given somewhere in Azure to live; production and staging share a subscription and the quota they also share is about to run out; a policy was assigned on one subscription and the subscription created last week does not have it; resources are being named by whoever created them; a cost report cannot be split by workload because nothing is tagged; or a deployment is being denied by a rule nobody can find because it was created in the portal.

It is written to trigger on: `Azure landing zone`, `management group`, `subscription topology`, `resource group layout`, `Azure Policy`, `policy as code`, `policy assignment`, `initiative`, `enforcementMode`, `DoNotEnforce`, `naming convention`, `tagging standard`, `required tags`, `Azure budget`, `blast radius of a subscription`, `Bicep subscription scope`, `CAF`, `enterprise scale`.

## How to use it

Usually you do not have to. DevOps Engineer loads it when its trigger fires, which is what the trigger phrases above are for — describe the work and the skill arrives with it.

```
/navi-skill-azure-landing-zone
/navi-delivery:navi-skill-azure-landing-zone
```

The first form is an install into `~/.claude/skills`; the second is the plugin install, where skills are namespaced by the plugin they came from. Name it this way when the trigger did not fire, or when you want its rules applied to work that is already done.

It brings its rules and the checklist it is graded against. Ask it to run its own **Validation block** on the result — that is the part no style guide has: the rules arrive with something that can check them.

## What it produces

Three files. Copy the first into `delivery/ops/azure/landing-zone.md`.

## What it rules out

The named failures the rules exist to prevent:

- The policy on one subscription.
- Production as a resource group.
- The name nobody can follow.
- Tags by remediation.
- The GUID in the template.
- Audit mode that was going to be temporary.
- The remediation that never ran.
- The portal policy.

## Which agents hold it (1)

A skill is never invoked on its own — an agent loads it. These hold it:

- [DevOps Engineer](../../../agents/navi-agent-devops-engineer/README.md) — owns G7, G8

Through them it is reachable from gates `G7`, `G8`.

## Install

### This skill on its own

```sh
git clone https://github.com/avinash-navikenz/agentic-skill-workflow.git
cd agentic-skill-workflow
./install.sh --skill navi-skill-azure-landing-zone
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

This README is a summary and carries no rules. [SKILL.md](SKILL.md) is the authority — it holds 16 numbered rules, a decision table, a template, a checklist, an anti-pattern list, and a validation block a reader can run. Nothing from it is repeated here, so the two cannot disagree.

## Notes

<!-- BEGIN NOTES -->

_Nothing hand-written yet. Anything between the NOTES markers survives regeneration; everything outside them is overwritten._

<!-- END NOTES -->

---

Generated by `python3 scripts/build_catalogue.py . --readmes` from this item's frontmatter and section headings. Edit the source file, not this one — except inside the NOTES block, which regeneration preserves.
