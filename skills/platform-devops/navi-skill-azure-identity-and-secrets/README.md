# Azure identity and secrets

`navi-skill-azure-identity-and-secrets` · skill · discipline `platform-devops` · ADLC phases 5, 7 · model `sonnet` · draft v0.1.0

Defines the identity register, workload identity federation for Azure DevOps service connections so no client secret exists to rotate, the managed identity a workload uses to read its own secrets, role assignments scoped to a resource group with the reason for that scope written down, the Key Vault settings, and the list of what must never reach an Azure DevOps variable group.

## When it fires

An Azure DevOps service connection is being created and the dialogue is offering a client secret; a workload needs to read a secret and someone is about to pass it in from the pipeline; a role assignment is being made and the quickest scope is the subscription; a Key Vault is being created and the defaults are being accepted; a connection string is about to be added to a variable group; or a secret has to be rotated and nobody knows which of fourteen places holds a copy.

It is written to trigger on: `managed identity`, `user-assigned identity`, `system-assigned identity`, `workload identity federation`, `federated credential`, `OIDC to Azure`, `service principal`, `client secret`, `app registration`, `Key Vault`, `RBAC authorization`, `purge protection`, `role assignment`, `least privilege`, `Azure RBAC scope`, `variable group secret`, `secret rotation`, `listKeys`, `connection string`, `shared key access`, `Entra ID`.

## How to use it

Usually you do not have to. DevOps Engineer and Security Engineer load it when its trigger fires, which is what the trigger phrases above are for — describe the work and the skill arrives with it.

```
/navi-skill-azure-identity-and-secrets
/navi-delivery:navi-skill-azure-identity-and-secrets
```

The first form is an install into `~/.claude/skills`; the second is the plugin install, where skills are namespaced by the plugin they came from. Name it this way when the trigger did not fire, or when you want its rules applied to work that is already done.

It brings its rules and the checklist it is graded against. Ask it to run its own **Validation block** on the result — that is the part no style guide has: the rules arrive with something that can check them.

## What it produces

Three files. Copy the first into `delivery/ops/azure/identity.md`.

## What it rules out

The named failures the rules exist to prevent:

- The connection with an expiry.
- The wildcard subject.
- Contributor on the subscription.
- Owner, because something was failing.
- The vault with access policies.
- The pipeline that fetches the secret.
- The connection string in the variable group.
- `listKeys()` because it was quicker.
- The pinned secret version.

## Which agents hold it (2)

A skill is never invoked on its own — an agent loads it. These hold it:

- [DevOps Engineer](../../../agents/navi-agent-devops-engineer/README.md) — owns G7, G8
- [Security Engineer](../../../agents/navi-agent-security-engineer/README.md) — owns G3, G6

Through them it is reachable from gates `G3`, `G6`, `G7`, `G8`.

## Install

### This skill on its own

```sh
git clone https://github.com/avinash-navikenz/agentic-skill-workflow.git
cd agentic-skill-workflow
./install.sh --skill navi-skill-azure-identity-and-secrets
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
