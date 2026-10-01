---
name: navi-skill-agent-observability
description: >
  Use when an LLM agent is about to run in front of users and nothing would let anybody
  reconstruct a run afterwards, when a trace is present but answers no question, or when a
  dashboard is empty and nobody can say whether the spans never left or never rendered.
  Defines delivery/ops/agent-telemetry.md, the SPAN-### register, the derived ids that keep a
  retry on one trace, the attributes that make cost and latency attributable, the content
  capture decision, how an evaluation result attaches, and the dated proof that spans arrived
  and rendered. Trigger phrases include: agent observability, LLM tracing, trace an agent run,
  span, OpenTelemetry, OTLP, GenAI semantic conventions, gen_ai attributes, token usage, LLM
  cost attribution, prompt capture, tool call span, llm.span.kind, service.name, AgentObs,
  Opik, LangSmith, trace id, span id, eval attached to a span, empty dashboard.
allowed-tools: Read Write Edit Grep Bash
metadata:
  version: "0.1.0"
  maturity: draft
  kind: skill
  discipline: platform-devops
  lifecycle_phases: [7, 8]
  used_by_agents: [navi-agent-mlops-engineer]
  owner: avinash.negi@navikenz.com
  tags: "devops, mlops, agent-observability, tracing, otlp, gen-ai, spans, cost-attribution, redaction"
  model: sonnet
---

## When to use

An agent is about to serve users and no span register exists; a trace is being read and the
question it was opened for cannot be answered from it; a cost pivot shows thousands of
one-off identities; a dashboard is empty and the argument is whether the exporter ran; a
retried run has turned into two unrelated traces; or prompts are being captured because the
SDK captures them by default and nobody has been asked whether that is allowed.

`navi-skill-observability` owns what the product promises — the SLI, the objective, the error
budget, the alert and the runbook. This skill owns what the agents emit, so that a run that
has already happened can be taken apart. `navi-delivery telemetry` exports the delivery
ledger and nothing else: it makes no model calls, so the agents' own spans are this file's
job and no command in this repository will produce them.

## Rules

1. Declare every span a run emits in `delivery/ops/agent-telemetry.md`, one `SPAN-###` row
   carrying `Name`, `Parent`, `Kind`, `service.name`, `Required attributes` and `On failure`.
   A trace is only readable against a statement of what should have been in it; with no
   register, a span that was never emitted and a step that never ran look identical.
2. Give one run one root span, and make every other span a descendant of it. Reconstructing a
   run means walking one tree; a second root for the same request is a second trace, and the
   half of the run inside it is found by nobody looking at the first.
3. Parent a tool span to the agent span that executed the call, never to the LLM span that
   requested it. The LLM span ends when the response returns, so a tool child of it starts
   after its parent has finished — every waterfall renders that wrong, and most backends sort
   it to the bottom. Carry `gen_ai.tool.call.id` to join the call back to the request.
4. Derive the trace id and every span id — `sha256(service|run_id)` truncated to 32 hex
   characters, `sha256(trace_id|span_path)` truncated to 16 — and never generate them
   randomly. A retry that mints fresh ids opens a second trace, and the two halves of one run
   then sit in two places with nothing joining them. `cli/lib/telemetry/spans.js` derives the
   delivery record's ids exactly this way, for exactly this reason.
5. Keep the run id stable across attempts and record the attempt as an attribute —
   `navi.run_attempt` — so a retry lands on the trace it is a retry of. A new run id per
   attempt is the same fork as a random trace id, arrived at one level higher.
6. Set `service.name` to a stable role — `theme-advisor`, `theme-ranker-serving` — never to a
   per-run agent id. It is the identity every AgentObs screen groups by: a run-scoped value
   fills "Discovered Agents" with thousands of one-off identities and turns the cost pivot
   into a list of ones, which is a report nobody can act on and nobody can tell is broken.
7. Set `llm.span.kind` only to a value this backend has been seen to render, and record the
   probe and its date in `## Backend`. The attribute is AgentObs's own convention and has no
   OpenTelemetry meaning: a kind it does not recognise is accepted, stored, and rendered on no
   screen, with no error on either side — a failure that looks exactly like success. Opik and
   LangSmith ignore the attribute and read the standard GenAI conventions instead.
8. Carry `gen_ai.response.model` on every LLM span, with `gen_ai.usage.input_tokens` and
   `gen_ai.usage.output_tokens`. Cost is computed from the model and the token counts and is
   never ingested, so a span missing the model is a span with no cost: the total comes out
   short rather than visibly wrong. Record the model the response names, not the alias the
   request asked for — the alias resolves to whatever is behind it that week.
9. Record a failure as a span with an error status and the exception type, never by not
   emitting the span. A trace that stops at the third span is indistinguishable from a trace
   whose fourth span the exporter dropped, and those two have different fixes.
10. Emit the tool span for a call that failed, timed out, or was retried, with
    `gen_ai.tool.name`, `gen_ai.tool.call.id` and an explicit outcome attribute. The calls
    that are absent from a trace are the calls the run actually turned on.
11. Keep per-run values out of span names and out of `service.name`. Both are grouping keys:
    a run id in a span name produces one group per run, which is the same unbounded-label
    failure `navi-skill-observability` names for metric labels, arriving through tracing.
12. Decide content capture per span and record the decision in `## Content capture` with its
    basis — who permitted it, over what retention. Prompts and completions are content, not
    telemetry; capture is an answerable question and an SDK default is not an answer.
13. Redact before truncating, and cap every attribute. One oversized attribute — a fetched
    page landing in a tool result — gets the whole batch rejected, which loses every span in
    the window rather than one field. The cap in the register and the cap in the emitter are
    the same number, or one of them is decoration.
14. Attach an evaluation result to the span whose output it judges, as `eval.*` attributes,
    and never send `eval.type=offline` to AgentObs — it discards the span, so the evaluation
    and the output it scored both disappear. A score on its own unparented span is a number
    nobody can trace back to what produced it.
15. Emit nanosecond timestamps as decimal strings. OTLP/HTTP JSON specifies them as strings
    because they exceed `Number.MAX_SAFE_INTEGER`; a JSON number is rounded on the way
    through, and the rounding surfaces as spans that end before they start.
16. Keep every credential in an environment variable and record only the variable name in the
    register. An ingest key is a credential whether or not the endpoint it opens is a
    monitoring one, and a register is a file in the repository.
17. Prove arrival by recording a dated row in `## Arrival` naming the backend, the trace id,
    how many spans were sent and how many rendered. The rendered count is the one that
    matters: the agent path has two ways to be empty — nothing was sent, or everything was
    sent under a kind the backend draws nowhere — and only one of them shows up as an error.
18. Bind each SLI that reads agent telemetry to the span and attribute it is computed from,
    and leave the objective and the budget in `delivery/ops/slo.md` where G8 reads them. An
    SLI computed from an attribute nothing emits is a number nobody can produce.

## Decision table

| Observed condition | Required action |
|---|---|
| A span exists in code and in no register | Add its `SPAN-###` row, or stop emitting it |
| A request produces two root spans | Re-parent; one run is one tree |
| A tool span is parented to the LLM span that asked for the call | Re-parent to the agent span and keep `gen_ai.tool.call.id` |
| Trace or span ids come from a random source | Derive them from the run id and the span path |
| A retry has produced a second run id | Keep the run id; record `navi.run_attempt` |
| `service.name` carries a run-scoped id | Replace with the stable role |
| A span kind is not on the probed list | Use a probed kind, or re-probe and record the date |
| An LLM span has no `gen_ai.response.model` | Add it — without it the span has no cost at all |
| A failure is recorded by omitting the span | Emit it with an error status and the exception type |
| A span name contains a run id | Move the value to an attribute |
| Prompts are captured because the SDK captures them | Record the decision and its basis, or turn capture off |
| The register's cap and the emitter's cap differ | Make them one number |
| An evaluation sits on its own unparented span | Attach it to the span it judged |
| `eval.type=offline` is being sent to AgentObs | Remove it; the span is discarded with it |
| `startTimeUnixNano` is a JSON number | Emit the decimal string |
| A credential value appears in the register | Replace with the variable name and rotate the key |
| The dashboard is empty | Read `## Arrival`: sent and rendered are different questions |
| An SLI reads an attribute no span declares | Emit it, or compute the SLI from something that exists |

## Template

The register, at `delivery/ops/agent-telemetry.md`:

```markdown
# Agent telemetry

What the agents in this repository emit, so that a run can be taken apart after it has
happened. `delivery/ops/slo.md` owns what is promised about the product and what pages a
human; this file owns the emission the promise is computed from.

## Backend

| Backend | Endpoint variable | Credential variable | Kind attribute | Probed on | Kinds that rendered |
|---|---|---|---|---|---|
| agentobs | NAVI_AGENTOBS_ENDPOINT | NAVI_AGENTOBS_INGEST_KEY | llm.span.kind | 2026-09-26 | agent, workflow, chain, task, llm, tool |

The probe is the whole point of the row. `llm.span.kind` is AgentObs's own convention with no
OpenTelemetry meaning, so the list above is what one person watched render on 2026-09-26 after
sending one run under each candidate kind — not what the documentation implies. A kind outside
that list is accepted by the ingest endpoint, stored, and drawn on no screen. Opik and
LangSmith ignore the attribute entirely and read the GenAI conventions below, so the same
emitter serves all three; re-probe when AgentObs is upgraded and move the date.

## Identity

- **Trace id:** `sha256("theme-advisor|" + run_id)`, first 32 hex characters
- **Span id:** `sha256(trace_id + "|" + span_path)`, first 16 hex characters, where
  `span_path` is the slash-joined chain of span names from the root
- **Run id:** the inbound request id, held for the life of the run and reused by every retry
  of it. The attempt is `navi.run_attempt`, so a retried run adds spans to the trace it is a
  retry of instead of opening a second one that nothing joins to the first.

## Service names

| service.name | Role | Emitted by |
|---|---|---|
| theme-advisor | the agent that answers "which theme should this session start in" | src/agent/telemetry.ts |
| theme-ranker-serving | the ranking model's serving path, called as a tool | src/agent/telemetry.ts |

Two roles, not two thousand. Every AgentObs screen groups by `service.name`, so a per-run
value here is what turns the cost pivot into a list of ones.

## Spans

| Span | Name | Parent | Kind | service.name | Required attributes | On failure |
|---|---|---|---|---|---|---|
| SPAN-001 | run:theme-advice | root | agent | theme-advisor | navi.run_id, navi.run_attempt, navi.change, gen_ai.system | status error, exception.type; the span is always emitted |
| SPAN-002 | llm:plan | SPAN-001 | llm | theme-advisor | gen_ai.request.model, gen_ai.response.model, gen_ai.usage.input_tokens, gen_ai.usage.output_tokens, gen_ai.response.finish_reasons | status error, exception.type, gen_ai.response.finish_reasons=error |
| SPAN-003 | tool:read_preference | SPAN-001 | tool | theme-advisor | gen_ai.tool.name, gen_ai.tool.call.id, navi.tool_outcome, navi.tool_attempt | status error, exception.type, navi.tool_outcome=timeout or error; emitted for every attempt |
| SPAN-004 | tool:rank_themes | SPAN-001 | tool | theme-ranker-serving | gen_ai.tool.name, gen_ai.tool.call.id, navi.tool_outcome, navi.model_version | status error, exception.type, navi.tool_outcome=error; emitted for a bypass as well |
| SPAN-005 | llm:answer | SPAN-001 | llm | theme-advisor | gen_ai.request.model, gen_ai.response.model, gen_ai.usage.input_tokens, gen_ai.usage.output_tokens, navi.recommendation_id | status error, exception.type; a refusal is a success with navi.answer_kind=refusal |

SPAN-003 and SPAN-004 hang off SPAN-001 and not off SPAN-002, which is the span that asked for
them: an LLM span ends when its response returns, so a tool child of it would start after its
parent finished. `gen_ai.tool.call.id` is what joins each call back to the request that asked
for it, and it costs one attribute instead of a wrong tree.

## Attribute limits

Every attribute is redacted first and then capped at 8192 characters; anything longer is
replaced by its first 8192 characters and a count of what was dropped. The cap exists because
a tool result can contain a fetched page, and one oversized attribute gets the entire batch
rejected — losing every span in that window rather than the one field.

## Content capture

| Span | Captured | Redacted | Basis |
|---|---|---|---|
| SPAN-001 | nothing | — | no content on this span; it carries ids and counts only |
| SPAN-002 | the rendered system prompt and the completion | any bearer token or card-shaped digit run matched on the way out | DPIA-011 permits prompt capture for this agent because the prompt is assembled from the catalogue and the hashed preference row; retention is 30 days in AgentObs |
| SPAN-003 | nothing — the argument is a user id and the result is a preference row | the whole argument and result payload, replaced by a sha256 of each | DPIA-011: the preference row is personal data and nothing in it is needed to debug a run |
| SPAN-004 | the ranked theme ids and their scores | the feature vector, which carries session-derived values | DPIA-011: scores are needed to explain a recommendation; features are not |
| SPAN-005 | the completion | any bearer token or card-shaped digit run matched on the way out | DPIA-011, as SPAN-002; the user's free text is not captured because this agent receives none |

## Evaluation results

| Eval | Attaches to | Attributes | Computed where |
|---|---|---|---|
| EVAL-004 | SPAN-005 | eval.name, eval.score, eval.source=online, eval.rubric_version | in the agent process, on the response, before it is returned |
| EVAL-005 | SPAN-005 | eval.name, eval.score, eval.source=replay, eval.rubric_version | in the nightly replay job, written back onto the same derived span id |

`eval.type=offline` is deliberately absent: AgentObs discards a span carrying it, which would
take the answer with the score. The replay job reaches the right span because the ids are
derived — it recomputes `sha256(trace_id|span_path)` rather than searching for a span.

## SLI bindings

| SLI | Computed from | Joining attribute |
|---|---|---|
| SLI-004 | SPAN-005 | navi.recommendation_id, echoed by the client on the theme event that later overrides it |
| SLI-005 | SPAN-005 | navi.recommendation_id, the same join read over a 24-hour window |

The objective, the error budget and the alert for both live in `delivery/ops/slo.md`. This
table only says which span carries the identifier they are counted against.

## Arrival

| Date | Backend | Trace id | Spans sent | Spans rendered | Where checked |
|---|---|---|---|---|---|
| 2026-09-26 | agentobs | 4b1c7e2a9f05d83641ae57b0c2d9e8f3 | 5 | 5 | the trace view, after a probe run under each candidate kind |
| 2026-09-29 | agentobs | 9d3f05a1c8b74e2069af31d5e7c04b68 | 5 | 5 | the trace view and the cost pivot, which showed two roles and not two runs |

Sent and rendered are different questions and the second one is the one worth asking. The
2026-09-26 row is the probe that produced `## Backend`; the 2026-09-29 row is the one that
checked the cost pivot grouped by role rather than by run.
```

The emitter the register points at, at `src/agent/telemetry.ts`:

```typescript
// The spans delivery/ops/agent-telemetry.md declares, and nothing else. Hand-built
// OTLP/HTTP JSON: three span shapes do not justify an SDK, and the shapes that matter
// here are the two this file gets right on purpose — derived ids and string nanoseconds.
import { createHash } from "node:crypto";

const SERVICE = "theme-advisor";
const RANKER_SERVICE = "theme-ranker-serving";
const MAX_ATTR_CHARS = 8192;

// The register's Name column, in code. A span emitted under a name the register does
// not carry is a span no reader of the register knows to miss.
export const SPANS = {
  run: "run:theme-advice",
  plan: "llm:plan",
  readPreference: "tool:read_preference",
  rankThemes: "tool:rank_themes",
  answer: "llm:answer",
} as const;

// Derived, never random. A retry re-derives the same ids and adds its spans to the
// trace it is a retry of; a random id would open a second trace with half a run in it.
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
export const traceIdFor = (runId: string) => sha(`${SERVICE}|${runId}`).slice(0, 32);
export const spanIdFor = (traceId: string, spanPath: string) =>
  sha(`${traceId}|${spanPath}`).slice(0, 16);

// Nanosecond times exceed Number.MAX_SAFE_INTEGER, and OTLP/HTTP JSON specifies them as
// decimal strings for that reason. A JSON number is rounded in transit, and the rounding
// arrives as spans that end before they start.
const nanos = (ms: number) => String(BigInt(Math.trunc(ms)) * 1000000n);

// Redact first, then cap. Capping first can cut a token in half and leave the half in.
const SECRETS = /(sk-[A-Za-z0-9]{8,}|Bearer\s+[A-Za-z0-9._-]+|\b\d{13,19}\b)/g;
function clean(value: string): string {
  const redacted = value.replace(SECRETS, "[redacted]");
  return redacted.length <= MAX_ATTR_CHARS
    ? redacted
    : `${redacted.slice(0, MAX_ATTR_CHARS)}[dropped ${redacted.length - MAX_ATTR_CHARS} chars]`;
}

type Failure = { type: string; message: string };

export function span(opts: {
  kind: string; spanName: string; parentPath: string | null; runId: string;
  service?: string; startMs: number; endMs: number;
  attributes: Record<string, string | number>; failure?: Failure;
}) {
  const traceId = traceIdFor(opts.runId);
  const path = opts.parentPath ? `${opts.parentPath}/${opts.spanName}` : opts.spanName;
  const attributes: Record<string, string | number> = {
    ...opts.attributes,
    // AgentObs renders only the kinds probed in the register; the others ignore this.
    "llm.span.kind": opts.kind,
  };
  // A failure is a span with a status, never a span that was not emitted: a trace that
  // simply stops reads the same as one whose next span the exporter dropped.
  if (opts.failure) attributes["exception.type"] = opts.failure.type;
  return {
    service: opts.service ?? SERVICE,
    traceId,
    spanId: spanIdFor(traceId, path),
    parentSpanId: opts.parentPath ? spanIdFor(traceId, opts.parentPath) : undefined,
    name: opts.spanName,
    startTimeUnixNano: nanos(opts.startMs),
    endTimeUnixNano: nanos(opts.endMs),
    attributes: Object.entries(attributes).map(([key, value]) => ({
      key,
      value: typeof value === "number" && Number.isInteger(value)
        ? { intValue: value }
        : { stringValue: clean(String(value)) },
    })),
    status: opts.failure ? { code: 2, message: clean(opts.failure.message) } : { code: 1 },
  };
}
```

Proving it arrived rather than configured. The payload is built and inspected locally
first, because a span that is wrong here is wrong in the backend and cheaper to read:

```bash
# What would be sent, before anything is sent. Then the two counts that matter.
node -e 'const {span,SPANS}=require("./dist/agent/telemetry.js");
         const s=span({kind:"llm",spanName:SPANS.answer,parentPath:SPANS.run,runId:"probe-1",
                       startMs:Date.now(),endMs:Date.now()+10,attributes:{}});
         console.log(JSON.stringify(s,null,2))'
# startTimeUnixNano must be a quoted string, and spanId must repeat run to run.
# Then send one probe run, and read the trace view — not the configuration page —
# for the number of spans that rendered. Record both counts in ## Arrival.
```

## Checklist

- [ ] Every span the code emits has a `SPAN-###` row in `delivery/ops/agent-telemetry.md`
- [ ] Exactly one span in the register has `root` as its parent
- [ ] Every other parent resolves to a declared `SPAN-###`
- [ ] No tool span is parented to a span of kind `llm`
- [ ] `## Identity` derives the trace id and the span id, and neither comes from randomness
- [ ] A retry keeps the run id and records `navi.run_attempt`
- [ ] Every `service.name` is a stable role and appears in `## Service names`
- [ ] Every span kind is on the probed list in `## Backend`, with the probe date
- [ ] Every LLM span carries `gen_ai.response.model` and both token attributes
- [ ] Every tool span carries `gen_ai.tool.name` and `gen_ai.tool.call.id`
- [ ] No span records a failure by not being emitted
- [ ] No span name or `service.name` carries a per-run value
- [ ] Every span has a `## Content capture` row with a basis, including the rows that capture nothing
- [ ] The cap in `## Attribute limits` is the cap in the emitter
- [ ] Every evaluation attaches to a declared span, and none sends `eval.type=offline`
- [ ] Nanosecond timestamps are emitted as decimal strings
- [ ] `## Backend` records variable names, never credential values
- [ ] `## Arrival` has a dated row with a trace id, a sent count and a rendered count
- [ ] Every SLI in `## SLI bindings` is defined in `delivery/ops/slo.md`

## Anti-patterns

**The kind that renders nowhere.** The exporter sends `llm.span.kind: generation`, the ingest
endpoint returns 202, the span is stored, and AgentObs draws it on no screen. Nothing errors on
either side. Two weeks later the dashboard is empty and the first suspicion is the network.
Probe each kind once, write down which rendered, and date it.

**One identity per run.** `service.name` is set to the agent instance id, so "Discovered
Agents" lists 40,000 agents, the cost pivot has one row per run, and the per-role question the
pivot exists to answer cannot be asked at all. The fix is one word and a redeploy; finding it
takes a week because nothing is broken.

**The forked retry.** The run fails, the framework retries it, and the retry generates a new
trace id. The trace that shows the failure and the trace that shows the recovery are both
complete, both correct, and have nothing joining them. Derive the ids from the run id.

**Cost that is quietly short.** `gen_ai.response.model` is missing on one of two LLM spans.
Cost is computed, not ingested, so that span contributes nothing and the monthly figure is
understated by exactly the amount nobody notices. The spend is visible on the invoice and
invisible in the tool bought to see it.

**The failure that was never emitted.** The tool call throws, the handler returns early, and
no span is written. The trace ends after the planner. It is identical to a trace whose tool
span was dropped by a full queue, and the two have nothing in common except the picture.

**Prompts by default.** The SDK captures prompts and completions because that is its default,
and a user's free text is now in a vendor's store with no retention answer and nobody who
decided it. Capture is a decision; write it down, including the spans that capture nothing.

**The batch lost to one field.** A tool fetched a page, the whole page went into a result
attribute, the collector rejected the batch for exceeding its message size, and every span in
that window is gone — not the one field. Cap the attribute, and cap it after redacting.

**The offline label.** An evaluation result is attached with `eval.type=offline` because the
score was computed in a batch job. AgentObs discards the span, so the evaluation and the
answer it judged both vanish, and the replay job's logs say it wrote 12,000 scores.

**Nanoseconds as numbers.** `startTimeUnixNano` is emitted as a JSON number. It rounds to the
nearest 256ns or worse, spans acquire negative durations, and the backend sorts them in an
order no one can explain from the code.

**Configured, not arrived.** The exporter is wired, the endpoint is set, the key is in the
vault, and no one has looked at a trace. `## Arrival` exists so that the answer is a date, a
trace id, and two counts rather than a recollection.

## Validation

```bash
# Every check reads files in this repository. None of them calls a backend, needs a key, or
# needs a vendor account: what is under test is the register, the emitter it names, and the
# SLIs it binds to.
#
# NOT CHECKABLE FROM FILES — these are properties of a running system and of a vendor's UI,
# and this block deliberately does not pretend otherwise:
#   * whether a kind in '## Backend' still renders — that is one person sending one run and
#     watching a screen, and '## Backend' records the date they did it
#   * whether the spans in '## Arrival' actually arrived; the counts there are copied from a
#     trace view by a signed-in person, and the date is what makes them readable later
#   * whether an ingest key is valid, which only the backend can answer
#   * whether the running process emits what the emitter defines — that is the application's
#     own tests, and a deployed build that disagrees with this file is a release problem
#   * what a span actually cost, which the backend computes from the model and the tokens

REG=delivery/ops/agent-telemetry.md

test -f "$REG" || echo "no $REG — the register is where the spans are declared"

python3 - <<'PY'
import datetime, pathlib, re, sys

REG = pathlib.Path("delivery/ops/agent-telemetry.md")
SLO = pathlib.Path("delivery/ops/slo.md")
if not REG.exists():
    sys.exit(0)                       # the `test -f` above already said so
reg = REG.read_text(encoding="utf-8")

def table(heading):
    rows, on = [], False
    for line in reg.splitlines():
        if line.startswith("## "):
            on = line[3:].strip() == heading
            continue
        if on and line.startswith("|"):
            if re.match(r"^\|[\s:|-]+$", line):
                continue
            rows.append([c.strip() for c in line.strip().strip("|").split("|")])
    if not rows:
        print(f"{REG} has no '## {heading}' table")
        return []
    return rows[1:]

def section(heading):
    out, on = [], False
    for line in reg.splitlines():
        if line.startswith("## "):
            on = line[3:].strip() == heading
            continue
        if on:
            out.append(line)
    return "\n".join(out)

ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")
# A value that differs per run. PER_RUN_ID is the shape of an id — a hex blob, a long digit
# run, an unexpanded placeholder — and is what a span name must not carry. RUN_SCOPED adds the
# words a per-run identity is usually named after, which belong in an attribute and never in
# service.name; span names are checked against the narrower pattern because `run:` and
# `tool:` are ordinary, stable prefixes for a span.
PER_RUN_ID = re.compile(r"[0-9a-f]{8,}|\d{5,}|[{}$<>]")
RUN_SCOPED = re.compile(r"[0-9a-f]{8,}|\d{5,}|[{}$<>]|\b(run|session|request|instance|uuid|pid)\b",
                        re.I)

# --- the backend, and the kinds a person watched render ---------------------

rendered_kinds, backends = set(), []
for row in table("Backend"):
    name = row[0] if row else ""
    if len(row) < 6:
        print(f"backend '{name}' has {len(row)} columns in '## Backend'; six are required")
        continue
    backends.append(name)
    endpoint_var, credential_var, _kind_attr, probed, kinds = row[1:6]
    for label, value in (("endpoint variable", endpoint_var), ("credential variable", credential_var)):
        if not re.fullmatch(r"[A-Z][A-Z0-9_]*", value or ""):
            print(f"backend '{name}' records {value!r} as its {label} — a register is a file in "
                  f"the repository, so this column holds the variable's NAME and never its value")
    if not ISO.match(probed or ""):
        print(f"backend '{name}' has no probe date — the list of kinds that render is an "
              f"observation somebody made on a day, not a property of the vendor")
    for kind in [k.strip() for k in (kinds or "").split(",") if k.strip()]:
        rendered_kinds.add(kind)
if not rendered_kinds:
    print("'## Backend' names no kind that was seen to render; an unprobed kind is accepted, "
          "stored and drawn nowhere")

# --- the identity derivation ------------------------------------------------

identity = section("Identity")
for field in ("Trace id", "Span id", "Run id"):
    if f"**{field}:**" not in identity:
        print(f"'## Identity' does not state the {field} derivation")
if re.search(r"random|uuid4|uuid\(\)|randomUUID|nanoid", identity, re.I):
    print("'## Identity' derives an id from randomness — a retry then opens a second trace "
          "and the two halves of one run have nothing joining them")

# --- service names ----------------------------------------------------------

services, emitters = {}, {}
for row in table("Service names"):
    name = row[0] if row else ""
    if len(row) < 3:
        print(f"service '{name}' has {len(row)} columns in '## Service names'; three are required")
        continue
    if RUN_SCOPED.search(name):
        print(f"service.name '{name}' is run-scoped — every backend screen groups by it, so a "
              f"per-run value makes the cost pivot a list of ones")
    services[name] = row[1]
    emitters[name] = row[2]
    if not row[1]:
        print(f"service.name '{name}' names no role")

# --- the spans --------------------------------------------------------------

LLM_REQUIRED = ("gen_ai.response.model", "gen_ai.usage.input_tokens", "gen_ai.usage.output_tokens")
TOOL_REQUIRED = ("gen_ai.tool.name", "gen_ai.tool.call.id")
OMITTED = re.compile(r"not emitted|no span|omit|nothing is emitted", re.I)

spans, roots = {}, []
rows = table("Spans")
for row in rows:
    span = row[0] if row else ""
    if not re.fullmatch(r"SPAN-\d{3,}", span):
        print(f"span row '{span}' has no SPAN-### id")
        continue
    if len(row) < 7:
        print(f"{span} has {len(row)} columns in '## Spans'; seven are required")
        continue
    spans[span] = dict(zip(("name", "parent", "kind", "service", "attributes", "failure"), row[1:7]))

for span, info in spans.items():
    if info["parent"].lower() == "root":
        roots.append(span)
    elif info["parent"] not in spans:
        print(f"{span} names parent '{info['parent']}', which is not a span in '## Spans'")
    elif spans[info["parent"]]["kind"] == "llm" and info["kind"] == "tool":
        print(f"{span} is parented to {info['parent']}, an llm span — an llm span ends when its "
              f"response returns, so the tool it asked for starts after its parent finished")
    if info["kind"] not in rendered_kinds:
        print(f"{span} has kind '{info['kind']}', which is not among the kinds recorded as "
              f"rendering in '## Backend' — an unrecognised kind is accepted, stored and drawn "
              f"on no screen, with no error on either side")
    if PER_RUN_ID.search(info["name"]):
        print(f"{span} has a per-run value in its name '{info['name']}' — a span name is a "
              f"grouping key, so this is one group per run")
    if info["service"] not in services:
        print(f"{span} names service.name '{info['service']}', which has no row in "
              f"'## Service names'")
    attributes = info["attributes"]
    if info["kind"] == "llm":
        for required in LLM_REQUIRED:
            if required not in attributes:
                print(f"{span} is an llm span without {required} — cost is computed from the "
                      f"model and the tokens and never ingested, so this span has no cost at "
                      f"all and the total is short rather than visibly wrong")
    if info["kind"] == "tool":
        for required in TOOL_REQUIRED:
            if required not in attributes:
                print(f"{span} is a tool span without {required}")
    failure = info["failure"]
    if not failure or failure in ("—", "-", "TBD"):
        print(f"{span} says nothing about how a failure is recorded")
    elif OMITTED.search(failure):
        print(f"{span} records a failure by omitting the span — that is indistinguishable from "
              f"a span the exporter dropped, and the two have different fixes")
    elif not re.search(r"status|error|exception", failure, re.I):
        print(f"{span} records a failure without a status or an exception type")

if len(roots) != 1:
    print(f"'## Spans' declares {len(roots)} root span(s); one run is one tree, and a second "
          f"root is a second trace with half the run in it")

# A span is declared here and emitted by the file its service names.
for span, info in spans.items():
    source = emitters.get(info["service"])
    if not source:
        continue
    path = pathlib.Path(source)
    if not path.exists():
        print(f"{span}: '{source}' is named as the emitter for '{info['service']}' and does "
              f"not exist")
        continue
    if info["name"] not in path.read_text(encoding="utf-8"):
        print(f"{span}: the name '{info['name']}' appears nowhere in {source}, so the register "
              f"declares a span the emitter it names does not emit")

# --- content capture --------------------------------------------------------

CONTENT = re.compile(r"prompt|completion|message|answer|content|argument|result|score|text", re.I)
captured = {}
for row in table("Content capture"):
    span = row[0] if row else ""
    if len(row) < 4:
        print(f"content capture row '{span}' has {len(row)} columns; four are required")
        continue
    captured[span] = True
    if span not in spans:
        print(f"'## Content capture' has a row for '{span}', which is not a span in '## Spans'")
    what, redacted, basis = row[1], row[2], row[3]
    if not what:
        print(f"{span}: '## Content capture' says nothing about what is captured — record "
              f"'nothing' where nothing is, so the decision is visible")
    if not redacted:
        print(f"{span}: '## Content capture' says nothing about what is redacted")
    if CONTENT.search(what or "") and not re.search(r"\bnothing\b|\bnone\b", what or "", re.I):
        if not basis or basis in ("—", "-", "TBD"):
            print(f"{span} captures content and records no basis — prompts and completions are "
                  f"content, and an SDK default is not a privacy answer")
for span in spans:
    if span not in captured:
        print(f"{span} has no row in '## Content capture'")

# --- the attribute cap, in the register and in the emitter ------------------

limits = section("Attribute limits")
declared = re.search(r"(\d[\d,]*)\s*(?:characters|chars|bytes)", limits)
if not declared:
    print("'## Attribute limits' declares no cap — one oversized attribute gets the whole "
          "batch rejected, which loses every span in the window rather than one field")
else:
    cap = int(declared.group(1).replace(",", ""))
    for source in sorted(set(emitters.values())):
        path = pathlib.Path(source)
        if not path.exists():
            continue
        src = path.read_text(encoding="utf-8")
        found = re.search(r"MAX_ATTR[A-Z_]*\s*=\s*(\d+)", src)
        if not found:
            print(f"{source} declares no attribute cap, while '## Attribute limits' says {cap}")
        elif int(found.group(1)) != cap:
            print(f"'## Attribute limits' says {cap} and {source} caps at {found.group(1)} — "
                  f"one of the two numbers is decoration")

# --- the emitter's two silent defects ---------------------------------------

for source in sorted(set(emitters.values())):
    path = pathlib.Path(source)
    if not path.exists():
        continue
    src = path.read_text(encoding="utf-8")
    if re.search(r"randomUUID\(|Math\.random\(|uuid4\(", src):
        print(f"{source} builds an id from randomness — a retry re-running the same run then "
              f"opens a second trace instead of landing on the first")
    for field in ("startTimeUnixNano", "endTimeUnixNano"):
        assigned = re.search(rf"{field}:\s*([^,\n]+)", src)
        if not assigned:
            print(f"{source} never sets {field}")
            continue
        expression = assigned.group(1)
        if "String(" in expression or ".toString()" in expression:
            continue
        helper = re.match(r"\s*([A-Za-z_$][\w$]*)\s*\(", expression)
        body = ""
        if helper:
            definition = re.search(rf"(?:const|let|function)\s+{re.escape(helper.group(1))}\b",
                                   src)
            if definition:
                body = src[definition.start():definition.start() + 400]
        if "String(" not in body and ".toString()" not in body:
            print(f"{source} emits {field} as a JSON number — a nanosecond time exceeds "
                  f"Number.MAX_SAFE_INTEGER, so it is rounded in transit and arrives as a span "
                  f"that ends before it starts; OTLP/HTTP JSON specifies a decimal string")

# --- evaluation results -----------------------------------------------------

for row in table("Evaluation results"):
    eval_id = row[0] if row else ""
    if len(row) < 4:
        print(f"evaluation row '{eval_id}' has {len(row)} columns; four are required")
        continue
    target, attributes = row[1], row[2]
    if target not in spans:
        print(f"{eval_id} attaches to '{target}', which is not a span in '## Spans' — a score "
              f"on a span nothing else references cannot be traced back to what it judged")
    if "eval.score" not in attributes:
        print(f"{eval_id} carries no eval.score attribute")
    if re.search(r"eval\.type\s*=\s*offline", attributes):
        print(f"{eval_id} sends eval.type=offline — AgentObs discards the span, taking the "
              f"answer it scored with it")

# --- the SLIs this telemetry is counted against -----------------------------

slo = SLO.read_text(encoding="utf-8") if SLO.exists() else ""
for row in table("SLI bindings"):
    sli = row[0] if row else ""
    if len(row) < 3:
        print(f"SLI binding row '{sli}' has {len(row)} columns; three are required")
        continue
    if not re.fullmatch(r"SLI-\d{3,}", sli):
        print(f"SLI binding row '{sli}' has no SLI-### id")
        continue
    if not re.search(rf"^### {sli} ", slo, re.M):
        print(f"{sli} is bound to agent telemetry here but is not defined in {SLO} — its "
              f"objective and error budget are owned there, and an SLI defined nowhere has an "
              f"objective nobody agreed")
    if row[1] not in spans:
        print(f"{sli} is computed from '{row[1]}', which is not a span in '## Spans'")
    if not row[2]:
        print(f"{sli} names no joining attribute")

# --- arrival, which is a different question from configuration --------------

arrivals = table("Arrival")
if not arrivals:
    print("'## Arrival' has no row — a configured exporter and an arriving one look the same "
          "from the repository, and only one of them produces a trace")
for row in arrivals:
    date = row[0] if row else ""
    if len(row) < 6:
        print(f"arrival row '{date}' has {len(row)} columns; six are required")
        continue
    backend, trace_id, sent, drawn = row[1], row[2], row[3], row[4]
    if not ISO.match(date):
        print(f"arrival row '{date}' has no ISO date — an undated check is a recollection")
    if backend not in backends:
        print(f"arrival row '{date}' names backend '{backend}', which has no row in '## Backend'")
    if not re.fullmatch(r"[0-9a-f]{32}", trace_id.strip("`")):
        print(f"arrival row '{date}' records '{trace_id}' as its trace id, which is not 32 hex "
              f"characters — without the id nobody can open the trace this row is about")
    if not sent.strip().isdigit() or not drawn.strip().isdigit():
        print(f"arrival row '{date}' does not record both counts as numbers — sent and rendered "
              f"are different questions, and the rendered one is the one that matters")
    elif int(drawn) == 0:
        print(f"arrival row '{date}' sent {sent} span(s) and rendered none — the spans were "
              f"accepted and drawn nowhere, which is what an unrecognised kind looks like")
PY
```

Each command prints nothing when the rule holds. The kind check and the arrival rows are the
two to run before anyone is told the agent is observable: between them they cover both ways an
agent dashboard is empty while every component reports success.
