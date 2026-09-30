# Concepts — why the framework is shaped this way

Four ideas carry the whole design. If you only read one page beyond the README, read this
one; everything else follows from here.

---

## 1. Agents hold judgment. Skills hold rules.

Coding assistants land in the middle of the lifecycle and leave both ends untouched. Three
things go wrong, every time:

- **Judgment is re-invented at every prompt.** Each session re-derives what a Business
  Analyst or an Architect already knows. Nothing accumulates.
- **Standards live in people's heads**, or in a wiki detached from the moment the work
  happens.
- **The loop never closes.** An incident rarely changes the standard that allowed it, so the
  same defect returns.

The response is to separate the two things that keep getting fused.

| | Agents — the thinking | Skills — the rules |
|---|---|---|
| Contain | mission · mental model · trade-off framing · escalation triggers · definition of good · a skill-invocation plan | standards · decision tables · templates · checklists · anti-patterns · a mechanical validation step |
| Answer | what, why, when | how |
| Voice | first person, persona | impersonal, imperative |
| File | `agents/navi-agent-<persona>/*.agent.md` | `skills/<discipline>/navi-skill-<name>/SKILL.md` |

**The falsifiable test:** delete every agent and the skills still fully specify *how* work is
done; delete every skill and the agents still specify *what, why and when*.

### Why it has to be mechanical

A separation nobody checks merges within months. Every review pass finds a reason to put
"just this one procedure" in the agent where the reader will see it, and a year later the
agents are runbooks and the skills are unused.

`scripts/lint_separation.py` fails the build on four things:

| Rule | Fails on |
|---|---|
| `SEP1` | a numbered procedure inside an `.agent.md` |
| `SEP2` | a `## Template` or `## Checklist` section inside an `.agent.md` |
| `SEP3` | persona voice inside a `SKILL.md` ("as the Architect, weigh…") |
| `SEP4` | first person inside a `SKILL.md` |

### The test that had to be withdrawn

The original formulation was: *a sentence present in both belongs in the skill.*

It is unsatisfiable, and the repository's own history proves it. Every escalation condition
an agent states also lives in a skill — so that rule forbade agents from stating their own
boundaries, while the same design section required exactly that. Five review passes against
it produced a **rising** finding count: 2, then 9, then 14, then 15. A defect count that
climbs under repeated correction is the signature of a bad definition, not a bad codebase.

What replaced it is a two-part test. A sentence in an agent is misplaced when **both** hold:

1. it tells the reader what to do, or what an artifact must contain, **and**
2. it adds no reason the governing skill does not already carry.

A sentence that names a boundary the persona will not cross, or that gives a *reason* for
choosing between permitted options, is judgment — **even when a skill covers the same
mechanics**. An agent may restate a constraint when it says *why* that constraint binds it.

A companion test — *could a reader comply with this mechanically?* — was withdrawn for the
same reason. A good reason is compliable; that is what makes it useful. The test deleted
judgment along with rules.

This is worth knowing before you write a skill or an agent, because the rule you will reach
for first is the one that was already tried and failed.

### The corollary

**An agent may not produce a lifecycle artifact from memory.** It loads the governing skill,
follows it, and records which skills it used in the handoff envelope. An agent that writes a
spec from what it remembers about specs has made the skill library decorative.

---

## 2. Proportionality, or the framework is abandoned by week two

Nine gates on a flag flip is not rigour; it is a guarantee that the next flag flip goes
around the framework. Every governance system that cannot be applied in proportion gets
routed around, and then it governs nothing.

Hence four lanes. The lane is declared at `propose` time, written into `state.lane`, and
fixed for the life of the change.

| Lane | Gates | The bargain |
|---|---|---|
| `express` | G2 · G6 · G7 | A flag flip still gets a spec, a test and a release record. Nothing else. |
| `standard` | G1 · G2 · G3 · G5 · G6 · G7 · G8 | The default. Seven gates, not nine. |
| `full` | all nine | New capability, regulated work, anything touching data or a model. |
| `hotfix` | G2 (deferred) · G6 · G7 · G9 | Ship now; the spec is retroactive within 48 hours, and the postmortem is mandatory. |

Two rules keep this honest:

- **Choose by the highest-severity characteristic present, never the average.** One regulated
  field in an otherwise trivial change makes the whole change `full`.
- **Where two lanes both fit, take the wider one.** An unnecessary gate costs hours. A
  missing gate costs an incident.

And one rule keeps it from being gamed: **lanes are never widened in place.** `state.lane` is
not hand-edited. A change that outgrows its lane is closed out — by waiving each unsettled
gate with a reason naming the abandonment — and re-proposed.

### Skipped and waived are different things

A gate **outside** the lane's set is *skipped*: recorded nowhere, and `navi-delivery gate`
refuses it outright. A gate **inside** the set that cannot be met is *waived*, with a reason
and a real future expiry, into `.adlc/waivers.md` and the event log. The distinction matters
because only one of them is a decision somebody made.

---

## 3. Evidence, not assertion

A phase that emits no telemetry did not happen. A gate whose verdict was never recorded was
never passed.

`status`, `validate` and `archive` read **only** `.adlc/state.json` and `.adlc/events.jsonl`.
A verdict asserted in a handoff, a commit message or a conversation does not exist as far as
the framework is concerned. This is why `--evidence` is mandatory on both `--pass` and
`--fail`.

**The limit of this, stated plainly:** the check is that the path exists, not that it says
anything. An empty directory is accepted. The mechanism buys you a citation that a human can
follow and an append-only record of who decided what and when — not automated verification
of the evidence itself. Treat it as a bibliography, not a proof.

The record is append-only in a way that matters. Re-recording a gate does not overwrite the
old verdict; it appends a new event carrying `previous`. Six months later the log still says
that G6 failed once, on what evidence, and what changed before it passed.

---

## 4. Runs anywhere, or it runs in one place and dies there

An agent that names `Read` and `Bash` works in exactly one harness. So agents declare
**neutral capabilities**, and every capability has a **mandatory fallback**. The fallback
requirement is what makes "runs in any harness" true rather than aspirational — without it,
"portable" means "we have not tried it elsewhere".

| Capability | Claude Code | Codex / Cursor | Fallback with no tooling at all |
|---|---|---|---|
| `read_file` | Read | file read | ask the human to paste the file |
| `write_file` | Write | file write | emit the file in a fenced block |
| `run_command` | Bash | shell | ask the human to run it and paste output |
| `search` | Grep/Glob | search | ask for the relevant paths |
| `ask_human` | AskUserQuestion | prompt | ask a plain question, then wait |
| `spawn_subagent` | Agent | — | adopt the persona sequentially in this session |

That last row is the interesting one. **A persona is a subagent where subagents exist, and a
role the model steps into where they do not** — the same agent file, the same skills,
degraded isolation only. Nothing about the content changes.

`registry/capabilities.json` is the single source for this table, and
`scripts/build_adapters.py` projects it — along with every agent and skill — into each
harness's shape:

- `adapters/claude-code/` — a complete installable plugin, flat layout, its own manifest
- `adapters/generic/RUNBOOK.md` — one paste-in file carrying the fallback table, every agent,
  and the skills each holds, for a harness with no plugin support at all
- `templates/delivery/AGENTS.md` — the entry point `init` copies into a consuming repo

**Adapters are generated, never hand-edited.** CI regenerates them and diffs; a hand edit
fails the build. Change the source under `agents/` or `skills/` and run
`python3 scripts/build_adapters.py .`.

**What is true today:** Claude Code is supported and exercised. The generic runbook covers
everything else. `doctor` detects Codex and Cursor and maps their capabilities, and sibling
manifests exist at the repo root — but **no adapter tree is built for either in v1, and
neither has been loaded in its harness.** LangGraph and other SDK harnesses are named in the
design and not built.

---

## 5. How the four ideas fit together

```
                 ┌──────────────────────────────────────────┐
   judgment ───► │  agent   what · why · when               │
                 │    │                                     │
                 │    │ loads, never improvises              │
                 │    ▼                                     │
   rules    ───► │  skill   how — with a Validation block   │
                 └────┬─────────────────────────────────────┘
                      │ produces an artifact
                      ▼
              lane decides which gates apply
                      │
                      ▼
              gate needs evidence on disk ──► events.jsonl (append-only)
                      │
                      ▼
              archive ──► specs/ updated · INSIGHT-### routed
                      │
                      └──► back to an agent's skill, or to the backlog
```

The loop at the bottom is the part that is easy to skip and is the reason the framework
exists. An `INSIGHT-###` routes to exactly one of two places: the product backlog, as a
candidate requirement, or a **skill amendment** — a pull request against a `navi-skill-*`
file in this repository. A postmortem that reveals a wrong standard should change the
standard, in the file the next team will actually load.

---

## Where to go next

- [WALKTHROUGH.md](WALKTHROUGH.md) — all of this happening to one real change
- [ADLC.md](../ADLC.md) — the nine gates in full
- [SDD.md](../SDD.md) — the ID chain and what the validator really sees
- [CONTRIBUTING.md](CONTRIBUTING.md) — writing a skill or an agent that passes the linters
