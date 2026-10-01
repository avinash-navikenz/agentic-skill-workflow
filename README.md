# navi-delivery

**An agentic SDLC framework — Plan to Monitor, in any harness.**
Agents hold the judgment. Skills hold the rules.

The framework ships 11 persona agents carrying each discipline's judgment, and 50
skills across 13 disciplines carrying each discipline's rules. An eight-verb CLI
scaffolds the lifecycle into your repo and records what actually happened at each of
nine gates.

| Doc | What it covers |
|---|---|
| [`ADLC.md`](ADLC.md) | Nine phases, nine gates, four lanes, rework, and the loop back to Plan |
| [`SDD.md`](SDD.md) | `REQ → AC → ADR → TASK → TEST → SLI → INSIGHT`, numbering, `Implements:` |
| [`docs/WALKTHROUGH.md`](docs/WALKTHROUGH.md) | One change carried end to end, as a real transcript |
| [`docs/CONCEPTS.md`](docs/CONCEPTS.md) | Why agents and skills are separate, and what that buys |
| [`docs/CLI.md`](docs/CLI.md) | Every verb, every validator rule, every known limitation |
| [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) | Adding a skill or an agent, and the gates it must clear |
| [`docs/TELEMETRY.md`](docs/TELEMETRY.md) | Exporting the gate ledger to AgentObs, Opik or LangSmith |
| [`config/mcp/README.md`](config/mcp/README.md) | MCP connections for Jira, Azure DevOps, Confluence and GitHub |
| [`automation/cron/README.md`](automation/cron/README.md) | The optional runner from tracker item to proposed branch |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Every ruling made while building v1, and what each one cost |
| [`docs/deck/README.md`](docs/deck/README.md) | The 19-slide overview deck, and how to rebuild it |
| [`docs/HOSTING.md`](docs/HOSTING.md) | Reading the field guide from a clone, and publishing it if you want to |

---

## The field guide

`docs/index.html` is the whole framework as one browsable page — every agent, every skill,
a worked demo, and the install paths. It needs no web server:

```bash
open docs/index.html          # macOS;  xdg-open on Linux,  start on Windows
```

It is one self-contained file, and its "on disk at …" links open the real `SKILL.md` and
`README.md` files beside it. See [`docs/HOSTING.md`](docs/HOSTING.md) to publish it.

---

## Quickstart — install to first proposal

Prerequisites: **Node ≥ 20** and **Python 3**. Nothing else; the framework has no runtime
dependencies.

**1. Install the agents and skills.** This repository is a Claude Code plugin marketplace
publishing one plugin. From inside Claude Code:

```
/plugin marketplace add avinash-navikenz/agentic-skill-workflow
/plugin install navi-delivery@navi-delivery
```

That is the preferred route — no clone to install, and `/plugin update navi-delivery`
refreshes it later. What lands is `adapters/claude-code/`: the generated flat layout
carrying every agent and every skill. [`install.sh`](#other-ways-to-install) and the
single-item copy remain supported alternatives.

**2. Put the CLI on your PATH.** The eight-verb CLI is a Node script in this repository
and is *not* part of the plugin, so this step wants the clone either way:

```bash
git clone <this-repo> navi-delivery
cd navi-delivery
npm install --global .
# => added 1 package
```

**3. Scaffold the framework into the repo you actually work in.**

```bash
cd /path/to/your-repo
navi-delivery init
# => Initialised delivery/ (harness: claude-code)
# => Next: navi-delivery propose <name> --lane standard
```

**4. Open your first change.**

```bash
navi-delivery propose add-csv-export --lane standard
# => Created delivery/changes/add-csv-export (lane: standard; gates: G1 · G2 · G3 · G5 · G6 · G7 · G8)

navi-delivery status
# => change: add-csv-export
# => lane:   standard
# =>
# =>   G1  pending
# =>   ...
```

That is the five minutes. What to do next — write the spec, record the gates, archive —
is [`docs/WALKTHROUGH.md`](docs/WALKTHROUGH.md), which follows this exact change all the
way through and shows the output of every step.

### Other ways to install

`install.sh` installs the same `adapters/claude-code/` tree straight into your Claude
directory. It symlinks by default, so an edit to the repo takes effect live — which is
what you want when you are changing the framework rather than using it, and it is the
form CI runs.

```bash
./install.sh              # interactive, symlinks (edits to the repo take effect live)
./install.sh --yes        # no prompt — this is the CI form
./install.sh --copy       # copy instead of symlink, for a frozen install
./install.sh --uninstall  # remove exactly what it installed
./install.sh --help
```

`CLAUDE_SKILLS_DIR` and `CLAUDE_AGENTS_DIR` override the destinations, which default to
`$HOME/.claude/skills` and `$HOME/.claude/agents`.

A single skill or agent, without the rest, is a copy out of that same tree — every skill
and agent README carries the exact command and the caveat that comes with it: a skill
installed alone has no agent holding it, and nothing will invoke it.

The CLI runs fine by path from any working directory if you would rather not install it
globally:

```bash
node /path/to/navi-delivery/cli/index.js init
```

---

## Which artefact to install

**Install `adapters/claude-code/`.** That is what the marketplace publishes and what
`install.sh` installs: the generated Claude Code plugin, a flat `skills/<name>/SKILL.md`
and `agents/<name>.md` layout plus its own `.claude-plugin/plugin.json`, so the directory
is a complete installable plugin on its own.

The repository root carries two manifests. `.claude-plugin/marketplace.json` is the
marketplace, and its single plugin entry sources `./adapters/claude-code` — so installing
through `/plugin install` never installs the root. `.claude-plugin/plugin.json` describes
the root itself as a plugin, but the root's skills are nested one level deeper —
`skills/<discipline>/<name>/SKILL.md`. That nesting is how the *source* is organised, by
discipline, so a reader can find things. **Whether a harness loads a nested layout
correctly is unverified.** Do not install the repo root and assume it works.

`adapters/` is generated output. Never hand-edit it; change the source under `agents/` or
`skills/` and regenerate:

```bash
python3 scripts/build_adapters.py .
```

CI regenerates and diffs, so a hand edit fails the build.

### Other harnesses, honestly

- **Claude Code** — supported and exercised. `adapters/claude-code/`, installed as a
  plugin from the marketplace this repository publishes, or by `install.sh`.
- **Any harness with no plugin support** — `adapters/generic/RUNBOOK.md` is generated for
  exactly this: a single paste-in file carrying the capability fallback table, every agent,
  and the skills each holds.
- **Codex and Cursor** — `.codex-plugin/plugin.json` and `.cursor-plugin/plugin.json`
  exist at the repo root as sibling manifests, and `navi-delivery doctor` detects both
  harnesses and maps their capabilities. **No adapter tree is built for either in v1**, and
  neither has been loaded in its harness. Use `adapters/generic/RUNBOOK.md` there today.
- **LangGraph and other SDK harnesses** — named in the original design, not built for v1.

---

## The eight verbs

```bash
navi-delivery init                             # scaffold delivery/, copy in AGENTS.md, detect harness
navi-delivery propose <name> --lane <lane>     # open a change from templates
navi-delivery status                           # change, lane, gate verdicts, stale artifacts
navi-delivery validate [--strict]              # frontmatter, separation, traceability
navi-delivery gate <G#> --pass --evidence <p>  # record a gate decision
navi-delivery archive <name>                   # fold the delta into specs/, emit the insight stub
                                               # (refuses on unsettled gates, stale artifacts or traceability findings)
navi-delivery doctor                           # harness detection, native vs fallback capabilities
navi-delivery telemetry export --backend <b>   # send the delivery record to AgentObs, Opik or LangSmith
```

Full reference, including flags and exit codes, in [`docs/CLI.md`](docs/CLI.md).
`telemetry` is off until you run it, exports the gate ledger rather than any model call,
and has its own page: [`docs/TELEMETRY.md`](docs/TELEMETRY.md).

---

## What the framework puts in your repo

```
your-repo/
└── delivery/
    ├── project.md        your stack and conventions
    ├── AGENTS.md         harness entry point (copied from a generated template)
    ├── specs/            current truth
    ├── changes/          in flight, and archive/
    ├── decisions/        ADRs
    ├── ops/              slo.md · runbooks/ · postmortems/ · models/
    └── .adlc/            state.json · events.jsonl · waivers.md
```

`ops/` is the deliberate extension past where change-proposal tooling usually stops.
Phases 8 and 9 need a home in the repo, or the loop from an incident back to a changed
standard cannot close.

---

## Connecting Jira, Azure DevOps and Confluence

Two skills reach outside the repository — `navi-skill-work-item-sync` reads and writes
work items, `navi-skill-knowledge-publishing` publishes pages. Both prefer an MCP server
when the session has one connected, because the server holds the credential and no token
reaches the shell or the transcript.

[`config/mcp/`](config/mcp/README.md) holds ready-to-install connection files for
Atlassian, Azure DevOps and GitHub, hosted and local routes for each, with every secret
written as a `${NAME}` the harness expands. The CLI never reads them; your harness does.

```bash
cp config/mcp/github.mcp.json .mcp.json     # or: claude mcp add --transport http ...
```

`scripts/validate_mcp_configs.py` runs in CI and fails on a credential written into one
of those files, so a pasted token is caught before it is committed, not after.

---

## Proposing changes from the tracker, on a schedule

Optional, and off unless you install it. [`automation/cron/`](automation/cron/README.md)
holds a runner that asks Jira or Azure Boards for tagged work items and, for each new
one, branches off the base, proposes a change, seeds the proposal from the item, pushes
and opens a pull request.

```bash
node automation/cron/navi-cron.js --config automation/cron/navi-cron.jira.example.json
./automation/cron/install-cron.sh --config /abs/path/to/config.json   # prints the crontab line
```

It never touches the checkout it runs in — every change happens in a worktree it creates
and removes — it does nothing irreversible without `--push`, and tracker text never
reaches a shell as code, which the tests assert with a hostile title. What it opens is a
scaffolded branch, not a proposal: a person still writes the why.

---

## The two halves

| | Agents — the thinking | Skills — the rules |
|---|---|---|
| Contain | mission · mental model · trade-off framing · escalation triggers · definition of good | standards · decision tables · templates · checklists · anti-patterns · validators |
| Answer | what, why, when | how |
| Voice | first person, persona | impersonal, imperative |

**The falsifiable test:** delete every agent and the skills still fully specify *how* work
is done; delete every skill and the agents still specify *what, why and when*.

This is enforced, not aspirational. `scripts/lint_separation.py` fails the build on a
numbered procedure or a template inside an agent (SEP1, SEP2), and on persona or
first-person voice inside a skill (SEP3, SEP4). Without a mechanical check the two halves
merge within months. The reasoning is in [`docs/CONCEPTS.md`](docs/CONCEPTS.md).

### The personas

`orchestrator` · `product-owner` · `business-analyst` · `architect` · `security-engineer` ·
`fullstack-developer` · `data-engineer` · `machine-learning-engineer` · `mlops-engineer` ·
`devops-engineer` · `qa-engineer`

### The disciplines

| Discipline | Skills |
|---|---|
| `lifecycle-method` | 6 |
| `spec-driven-development` | 4 |
| `architecture` | 4 |
| `software-development` | 5 |
| `platform-devops` | 4 |
| `data-engineering` | 3 |
| `machine-learning` | 3 |
| `quality-engineering` | 3 |
| `business-analysis` | 2 |
| `product-management` | 2 |
| `mlops` | 2 |
| `security` | 1 |

---

## Lanes, so nobody routes around it

Forcing nine gates onto a flag flip guarantees the framework is abandoned by week two.

| Lane | When | Gates enforced |
|---|---|---|
| `express` | copy · config · flag flip | G2 · G6 · G7 |
| `standard` | most features and bugs | G1 · G2 · G3 · G5 · G6 · G7 · G8 |
| `full` | new capability · regulated · anything touching data or a model | all nine |
| `hotfix` | production incident | G2 (deferred, retroactive) · G6 · G7 · G9 |

A gate outside the lane's set is skipped and recorded nowhere — `navi-delivery gate`
refuses it. A gate inside the set that cannot be met is **waived**, with a reason and a
real future expiry, into `delivery/.adlc/waivers.md`. See [`ADLC.md`](ADLC.md).

---

## Known limitations in v1

These are real, recorded, and worth knowing before you meet them:

- **`gate --evidence` checks shape, not content.** Evidence must be a regular, non-empty
  file — a directory, a device and a zero-byte file are each refused — but a file
  containing one space passes. The gate records *that* evidence was named, not that it
  says anything.
- **`gate --waive` waives the whole gate.** One reason and one expiry attach to the gate,
  so a single unfixable finding waives every criterion the gate covers rather than itself.
- **Gate actors are derived, not proven.** Every gate event carries `actor` and
  `actor_source`, resolved from `--actor`, `$NAVI_DELIVERY_ACTOR`, `git config user.email`
  or the login, in that order. That is attribution, not authentication: nothing stops
  someone passing a name that is not theirs. `actor_source` records how the name was
  obtained so a reader can weigh it.
- **G4 is enforced only on the `full` lane.** `standard` cannot record it at all; the CLI
  refuses the gate outright. This is why `navi-skill-lane-selection` routes anything
  touching a dataset, schema, feature or model to `full`.
- **`navi-skill-code-review` is not exercised by the Validation harness.** Its substantive
  checks read a live authenticated pull request, which neither a fixture nor CI can supply.
  It is declared unharnessable, deliberately and visibly, rather than stubbed.
- **`validate` lints the framework tree, not only your repo.** `validate_manifests.py` and
  `lint_separation.py` always run against the installed framework; only the traceability
  check runs against your `delivery/`. So `validate` output mentions every framework file
  whichever repo you run it in.

---

## Verifying a checkout

Everything CI runs, runnable locally:

```bash
npm test                                       # the CLI — every verb, end to end
python3 -m unittest discover -s tests/lint     # the linters, the builders, traceability
python3 scripts/validate_manifests.py .        # frontmatter, naming, referential integrity
python3 scripts/lint_separation.py .           # the separation law
python3 scripts/validate_skill_checks.py .     # every skill's own Validation block
python3 scripts/golden_path.py                 # a toy change through all four lanes

# adapters/, docs/index.html and every README.md beside a SKILL.md are generated;
# regenerate them and nothing should have changed.
python3 scripts/build_adapters.py .
python3 scripts/build_catalogue.py . --readmes --inject
git diff --exit-code adapters templates/delivery/AGENTS.md docs/index.html skills agents
```

Expected: `0 fail`, `OK`, `0 finding(s)`, `0 separation finding(s)`,
`0 failing`, `golden path: OK`, and an empty diff.

No test total is quoted here on purpose. A figure that has to be hand-edited after
every test is a drift source — these two were thirty-four and twenty-two tests behind
by the time anyone noticed. The suites print their own totals; what a reader checking
out the repo needs to know is that nothing failed.

---

**Version 0.1.0.** The version stays put until the framework is stable in real use.
Owner: avinash.negi@navikenz.com.
