# CLI reference

Eight verbs. Zero runtime dependencies beyond Node ≥ 20 and Python 3.

```bash
navi-delivery <init|propose|status|gate|validate|archive|doctor|telemetry>
navi-delivery --version     # 0.1.0
```

An unknown verb prints the usage line and exits `1`.

Reached either as the globally installed `navi-delivery` binary (`npm install --global .`)
or as `node /path/to/navi-delivery/cli/index.js`. **`npx navi-delivery` does not work** — the
package is `private: true` and unpublished, so there is no registry entry to fetch.

Every command runs against the current working directory. All of them except `doctor` expect
a `delivery/` tree there.

---

## `init`

Scaffolds `delivery/` into the current repo, copies `delivery/AGENTS.md` in from
`templates/delivery/AGENTS.md`, and detects the harness. `init` generates nothing: that
template is itself generated, but by `scripts/build_adapters.py` at build time, from the
agents and skills in this repository — not here, and not from your repo.

```bash
navi-delivery init
```

```text
Initialised delivery/ (harness: claude-code)
Next: navi-delivery propose <name> --lane standard
```

Creates:

```
delivery/
├── project.md              your stack and conventions — human-authored, fill this in
├── AGENTS.md               harness entry point, copied from a generated template
├── specs/                  current truth
├── changes/archive/
├── decisions/
├── ops/                    slo.md · runbooks/ · postmortems/ · models/
└── .adlc/                  state.json · waivers.md
```

`events.jsonl` appears on the first gate decision.

**Refuses to overwrite.** Run twice and it stops:

```text
delivery/ already exists at <path> — refusing to overwrite. Remove it or run elsewhere.
```

If a template is missing or unreadable it reports which one and creates nothing.

---

## `propose <name> --lane <lane>`

Opens a change. The lane is fixed here and for the life of the change.

```bash
navi-delivery propose add-csv-export --lane standard
```

```text
Created delivery/changes/add-csv-export (lane: standard; gates: G1 · G2 · G3 · G5 · G6 · G7 · G8)
```

Creates `proposal.md`, `design.md`, `tasks.md` and `handoffs.md` from templates. Your delta
spec goes at `changes/<name>/specs/<capability>/spec.md` — write it yourself; there is no
template for it because its shape depends on the capability.

Lanes: `express` · `standard` · `full` · `hotfix`. See [ADLC.md](../ADLC.md) §3.

| Refusal | Message |
|---|---|
| No name, or no `--lane` | `usage: navi-delivery propose <name> --lane <lane>` |
| Unknown lane | `unknown lane 'turbo' — valid lanes: express, standard, full, hotfix` |
| A change is already active | `change 'a' is already active — archive it first (navi-delivery archive a) before proposing another change` |

One change is in flight at a time, by design: `state.json` holds one change's gate verdicts
and stale set, so a second concurrent change would have nowhere to record them.

---

## `status`

The current change, its lane, its gate verdicts, and anything stale.

```bash
navi-delivery status
```

```text
change: add-csv-export
lane:   standard

  G1  pass
  G2  pass
  G3  fail
  G5  pending
  G6  pending
  G7  pending
  G8  pending

stale artifacts (3) — rework required before validate passes:
  gate:G3
  gate:G5
  gate:G6
```

Only the gates the lane enforces are listed. With no change open:

```text
no active change — run: navi-delivery propose <name> --lane <lane>
```

Exits `0` in that case — no change open is a state, not an error.

> **There is no `phase:` line.** `state.phase` exists in `state.json`, where `propose` and
> `archive` both set it to `1` and nothing advances it. `status` used to print it, which made
> every change look like it was in phase 1 forever. The gate verdicts are the progression
> signal, and they are what `status` shows.

---

## `validate [--strict]`

Runs three checks and exits non-zero if any fails.

```bash
navi-delivery validate --strict
```

```text
0 finding(s) across 61 file(s)

0 separation finding(s)

0 traceability finding(s)
validate: OK
```

| Check | Script | Runs against |
|---|---|---|
| Frontmatter, naming, referential integrity (M1–M7) | `validate_manifests.py` | **the framework tree** |
| The separation law (SEP1–SEP4) | `lint_separation.py` | **the framework tree** |
| The ID chain (T0–T4) | `validate_traceability.py` | **your `delivery/`** |

The first two always lint the installed framework, not your repo — which is why the file
count is the same whichever repo you run it in. Only traceability is about your change.

`--strict` adds **T4**: a requirement that no task implements. Run it before G5.

It also refuses while rework is outstanding, before running anything:

```text
3 stale artifact(s) — resolve rework before validating
```

A validator that cannot start is not a validator that passed — a missing `python3` is
reported as `failed to run <script>: ...`, not swallowed.

### Traceability findings

| Rule | Meaning |
|---|---|
| `T0` | File not readable — not valid UTF-8, or a broken path |
| `T1` | `TASK-###` has no `Implements: REQ-###` line |
| `T2` | `REQ-###` has no acceptance criteria |
| `T3` | `TASK-###` implements an unknown `REQ-###` |
| `T4` | `REQ-###` implemented by no task — `--strict` only |

What the validator **silently does not see**: an unbolded `TASK-###`, a `REQ-###` not on a
heading line, an ID numbered with fewer than three digits, an `Implements:` line more than
three lines below its task. Each of those produces no finding at all. See
[SDD.md](../SDD.md) §3.

---

## `gate <G#> --pass|--fail --evidence <path> [--actor <name>]`

## `gate <G#> --waive <reason> --expires <YYYY-MM-DD> [--actor <name>]`

Records a gate decision into `state.json` and appends an event to `events.jsonl`.

```bash
navi-delivery gate G6 --pass --evidence delivery/changes/x/evidence/g6-tests.tap
```

```text
G6 pass (evidence: delivery/changes/x/evidence/g6-tests.tap, by: dev@navikenz.com)
```

A failure marks the gate and every later gate **in the same lane** stale:

```text
G6 fail (evidence: .../g6-failures.md)
rework required — 3 artifact(s) marked stale
```

Re-recording is supported and visible:

```text
G6 re-recorded: fail -> pass (evidence: .../g6-tests.tap, by: dev@navikenz.com)
```

The new event carries `previous: "fail"`. Nothing is overwritten. **Recording a gate clears
its own stale entry and no other** — each stale gate is re-recorded individually.

### Waiving

```bash
navi-delivery gate G8 --waive "SLI lands with the next platform release" --expires 2026-12-31
```

```text
G8 waived until 2026-12-31 (approved by: dev@navikenz.com)
```

Appends a row to `.adlc/waivers.md` with the date, change, gate, reason, expiry and
approver. The `Approved by` column the template header promises is populated with the
resolved actor: this CLI has no second-party approval step, so the person who records a
waiver is the person accepting the debt.

> **A waiver's scope is the whole gate.** One reason and one expiry cover every criterion
> that gate checks. Write the reason so a reader can tell which criterion was in question.

### Refusals

| Situation | Message |
|---|---|
| Not a gate | `unknown gate 'G12' — valid: G1, G2, G3, G4, G5, G6, G7, G8, G9` |
| Gate outside the lane | `G4 is not in lane 'standard' — this lane enforces: G1, G2, G3, G5, G6, G7, G8` |
| No change open | `no active change` |
| Both or neither verdict flag | `specify exactly one of --pass or --fail` |
| No `--evidence` | `--evidence is required to record a gate decision` |
| Evidence path missing | `evidence file not found: nope.md` |
| Evidence is a directory | `evidence must be a file, not a directory: . — name the file inside it that records the decision` |
| Evidence is not a regular file | `evidence must be a regular file: /dev/null is a character device` |
| Evidence is empty | `evidence file is empty (0 bytes): zero.md — a gate verdict must point at something a later reader can open` |
| `--actor` with no value | `--actor requires a name — got none (or the next token looks like a flag)` |
| No name derivable at all | `cannot determine who is recording this decision — pass --actor <name> or set NAVI_DELIVERY_ACTOR` |
| `--waive` with no reason | `--waive requires a reason — got none (or the next token looks like a flag)` |
| Reason containing a newline | `waiver reason must not contain a newline — it becomes a single waivers.md table row` |
| No `--expires` | `a waiver requires --expires <YYYY-MM-DD>` |
| Expiry in the past | `--expires '2020-01-01' must be strictly in the future` |
| Expiry not a real date | `--expires '2026-02-30' is not a real calendar date` |
| Expiry not a date at all | `--expires must be a calendar date in YYYY-MM-DD form, got 'soon'` |

All refusals write nothing — not the state, not the waivers row, not the event.

> **`--evidence` must be a regular, non-empty file.** A directory, a device and a zero-byte
> file are each refused with their own message. A symlink is judged by what it resolves to.
> The content is still not read — evidence proves something was produced, not that it says
> what you claim.

### Who recorded it

Every gate event carries `actor` and `actor_source`. The name is resolved from the first
source that answers:

| Order | Source | `actor_source` |
|---|---|---|
| 1 | `--actor <name>` | `flag` |
| 2 | `$NAVI_DELIVERY_ACTOR` | `env` |
| 3 | `git config user.email` (in the working directory) | `git` |
| 4 | `$USER` / `$LOGNAME` / the OS login | `login` |

If none answers, the decision is **refused** rather than recorded as unknown.

`--actor` is deliberately *not* required: making it so would break every documented
invocation, the golden path and the test suite, to buy a name `git config` already knows.
What makes derivation sufficient is `actor_source` — a name typed on purpose (`flag`,
`env`) is stronger evidence than one inferred from the shell (`login`), and an auditor
reading `events.jsonl` can tell them apart. A `login`-sourced actor prints a one-line note
suggesting `--actor`; the stronger sources print nothing.

This is what lets the log answer "which owner recorded this?" for the co-owned gates G3 and
G6.

---

## `archive <name>`

Folds the change's delta spec into `delivery/specs/`, moves the change to
`changes/archive/<date>-<name>/`, writes the insight stub, and clears the active change.

```bash
navi-delivery archive add-csv-export
```

```text
Archived to delivery/changes/archive/2026-09-30-add-csv-export
Insights: delivery/ops/postmortems/add-csv-export.md — route each to the backlog or a skill amendment
```

A final `{"gate":"G9","verdict":"archived"}` event is appended, marking the close-out. It is
written on every lane, including those that do not enforce G9.

### Refusals

Nothing on disk changes when any of these fire.

```text
unknown change 'nosuch'
```

```text
cannot archive 'add-csv-export': gates and/or artifacts are not settled. Nothing was changed.
  outstanding gate(s): G1 (pending), G2 (pending), ...
  resolve with: navi-delivery gate <gate> --pass --evidence <file>  (or --waive <reason> --expires <date>)
  3 stale artifact(s): gate:G6, gate:G7, gate:G8
  resolve by re-running 'navi-delivery gate <gate> ...' on each stale gate to clear its rework
```

Traceability is checked too, with the same validator `validate` runs (non-strict, whole
tree). The framework claims everything traces to a requirement; archive is where that claim
becomes permanent, since it folds the delta spec into `delivery/specs/`:

```text
cannot archive 'add-csv-export': traceability findings are outstanding. Nothing was changed.
T3 delivery/changes/add-csv-export/tasks.md: TASK-001 implements unknown REQ-999

1 traceability finding(s)
  resolve by binding each task to a requirement that exists, and giving every requirement acceptance criteria
  re-check with: navi-delivery validate
```

> The shipped `tasks.md` carries `Implements: REQ-001` as a placeholder, so a change whose
> tasks were never filled in is **not** archivable until its delta spec introduces that
> requirement with acceptance criteria. That is the intent, not a side effect.

It also refuses to archive over an existing `changes/archive/<date>-<name>/`, rather than
overwriting recorded history, and refuses to archive a change that is not the one
`state.json` holds verdicts for.

There is no `abandon` verb. Closing out a change that will not ship means waiving each
unsettled gate — with a reason naming the abandonment and the superseding change — and then
archiving.

---

## `doctor`

Harness detection and the capability map. The only verb that needs no `delivery/` tree.

```bash
navi-delivery doctor
```

```text
harness: claude-code

  native   read_file -> Read
  native   write_file -> Write
  native   run_command -> Bash
  native   search -> Grep/Glob
  native   ask_human -> AskUserQuestion
  native   spawn_subagent -> Agent
```

With no harness detected:

```text
harness: generic

  fallback read_file -> ask the human to paste the file
  fallback write_file -> emit the file in a fenced block
  fallback run_command -> ask the human to run it and paste output
  fallback search -> ask for the relevant paths
  fallback ask_human -> ask a plain question, then wait
  fallback spawn_subagent -> adopt the persona sequentially in this session
```

Detection is by environment variable: `CLAUDECODE` or `CLAUDE_PLUGIN_ROOT` → `claude-code`;
`CODEX_HOME` → `codex`; `CURSOR_TRACE_ID` → `cursor`; otherwise `generic`. It reports what
the *environment* says, not which adapter tree exists.

---

## `telemetry <doctor|preview|export>`

Sends the delivery record to an OTLP backend — one trace per change, one span per gate
decision. Off until you run it: no other command makes a network call, and there is no
background exporter.

What it exports is the gate ledger, not any model call: this CLI makes none. The full
contract — backends, variables, span model, attributes — is in
[`TELEMETRY.md`](TELEMETRY.md); this is the command surface.

```
navi-delivery telemetry doctor
navi-delivery telemetry preview [--backend <name>] [--change <slug>|--all] [--out <file>]
navi-delivery telemetry export --backend <agentobs|opik|langsmith|otlp>
                               [--change <slug>|--all] [--dry-run]
```

| Flag | Effect |
|---|---|
| `--backend <name>` | required for `export`; optional for `preview`, which then builds exactly that backend's payload; `agentobs`, `opik`, `langsmith` or `otlp` |
| `--change <slug>` | export one named change instead of the one in `state.json` |
| `--all` | every change the event log knows about — how a backfill is done |
| `--out <file>` | `preview` only; writes the exact payload that would be sent |
| `--dry-run` | `export` only; resolves, builds, reports, sends nothing, records nothing |

| Exit | When |
|---|---|
| 0 | everything selected was sent, or a default/`--all` run found nothing recorded |
| 1 | a backend is unconfigured, a flag is missing, a send was refused, or a **named** `--change` holds no decisions |

`doctor` prints header **names** and never header values — the value is the credential —
and a variable it cannot parse costs that one row, not the whole listing. A real export
writes `delivery/.adlc/telemetry.json` with the outcome, a redacted url and no credential,
which is the local answer to "did it arrive?". A refused export changes nothing about
the delivery record.

---

## The framework's own checks

Run from the framework repo root, not from a consuming repo.

```bash
npm test                                       # the Node suite
python3 -m unittest discover -s tests/lint     # the Python suite
python3 scripts/validate_manifests.py .        # M1-M7
python3 scripts/lint_separation.py .           # SEP1-SEP4
python3 scripts/validate_skill_checks.py       # each skill's own Validation block
python3 scripts/validate_mcp_configs.py .      # C1-C6 on config/mcp/
python3 scripts/golden_path.py                 # a toy change through all four lanes
python3 scripts/build_adapters.py .            # regenerate adapters/ and AGENTS.md
python3 scripts/build_catalogue.py . --readmes --inject   # regenerate the page and READMEs
```

### Manifest rules

| Rule | Checks |
|---|---|
| `M1` | Frontmatter parses |
| `M2` | Required keys present for the kind |
| `M3` | `name` matches its directory and its kind's prefix |
| `M4` | Every name in an agent's `skills:` resolves to a real skill |
| `M5` | Every skill is named by at least one agent |
| `M6` | A skill's `description` contains `Trigger phrases include:` |
| `M7` | A skill's `used_by_agents` equals exactly the set of agents listing it |
| `M8` | `metadata.kind` is one of `skill`, `agent` — spelled exactly |

M7 reports in two directions, because the fix differs: one means the skill's claim is stale,
the other means an agent acquired the skill without being recorded.

M8 exists because `kind` is the routing key for every kind-dependent check here. A
one-character typo (`kind: Agent`) made `lint_separation.py` report nothing on a file
carrying a numbered procedure, a Checklist heading and a bulleted imperative — every check
fell through, and the file scored a silent zero. When M8 fires, M4/M5/M7 are withheld and
said to be withheld, because they would otherwise accuse the other side of each broken
pair.

### Separation rules

| Rule | Fails on |
|---|---|
| `SEP0` | `metadata.kind` unrecognised — no check could be selected, so the file was **not graded** |
| `SEP1` | A numbered procedure inside an `.agent.md` |
| `SEP2` | A `## Template` or `## Checklist` section inside an `.agent.md` |
| `SEP3` | Persona voice inside a `SKILL.md` |
| `SEP4` | First person inside a `SKILL.md` |
| `SEP5` | A **bulleted** imperative directive inside an `.agent.md` |

SEP5 is SEP1's blind spot. SEP1 matches numbered procedures, so the same three imperatives
written as bullets scored zero findings while the numbered form scored one. Refusing to
grade a file (SEP0) is likewise a finding rather than a pass.

### Expected output

Every line is a count, so the numbers here would be wrong by the next commit. What matters
is the shape: a failure count of zero on every line, and zero skills failing their own
Validation block.

```text
<N> pass / 0 fail
OK (<N> tests)
0 finding(s) across <N> file(s)
0 separation finding(s)
0 finding(s) across <N> connection file(s)
<N> harnessed · 1 declared-unharnessable · 0 failing  (of <N> skill(s) considered)
golden path: OK
```

The live numbers are whatever CI last printed; this repository's own workflow runs every one
of these on both ubuntu and macOS.

The one declared-unharnessable skill is `navi-skill-code-review`, whose substantive checks
read a live authenticated pull request through `gh api graphql`. Neither a fixture nor CI can
supply one, and stubbing `gh` would leave the harness asserting the stub. It is declared
visibly rather than skipped quietly.

---

## Files the CLI reads and writes

| Path | Written by | Read by |
|---|---|---|
| `delivery/.adlc/state.json` | `init`, `propose`, `gate`, `archive` | `status`, `validate`, `gate`, `archive` |
| `delivery/.adlc/events.jsonl` | `gate`, `archive` | nothing — it is the audit record |
| `delivery/.adlc/waivers.md` | `gate --waive` | humans |
| `delivery/.adlc/telemetry.json` | `telemetry export` | humans — what was sent, and whether it arrived |
| `delivery/specs/**` | `archive` | `validate` |
| `delivery/changes/<name>/**` | `propose`, you | `validate`, `archive` |

`state.json` is what makes a change resumable. A fresh session in any harness reads it and
picks up mid-flight rather than re-deriving where things stand — long deliveries exceed any
context window, and without this the framework fails on its second day.
