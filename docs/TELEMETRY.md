# Telemetry — exporting the delivery record

`navi-delivery telemetry` sends the delivery record to an OTLP backend: one trace per
change, one span per gate decision. AgentObs, Opik, LangSmith, and anything else that
accepts OTLP/HTTP JSON.

It is off until you run it. There is no background exporter, no daemon, and no network
call from any other command.

## What it exports, and what it does not

What it exports is the **ledger**: who recorded which gate, when, with what evidence,
how long the change sat between decisions, how many times a gate was re-recorded. That
is the thing this framework knows and nothing else does.

What it does **not** export is the agents' own LLM calls — prompts, completions, tokens,
cost. This CLI makes no model calls, so it has none to report, and a framework that
claimed otherwise would be making exactly the kind of promise its own skills exist to
stop people making. Instrumenting the agents and the product is a different job, and
`navi-skill-agent-observability` is where it is written down.

## Three commands

```bash
navi-delivery telemetry doctor                      # what is configured, what is missing
navi-delivery telemetry preview --out payload.json  # build it; send nothing
navi-delivery telemetry export --backend langsmith  # send it
```

`preview` builds the payload through the same pure fold `export` uses, so what it writes
is what would be sent. `export --dry-run` goes one step further: it resolves the backend
and builds the payload, reports the endpoint and span count, and sends nothing.

By default the change in `state.json` is exported. `--change <slug>` names another, and
`--all` exports every change the event log knows about — which is how you backfill a
repository that has been running since before telemetry existed.

A change you **name** that holds no gate decisions exits non-zero: you asked for something
specific and got nothing, which is a typo'd slug or a change that has not reached a gate.
A default or `--all` run that finds nothing exits zero — an empty event log is a state, not
an error.

## Configuring a backend

Every credential comes from the environment. Nothing is read from a file in the
repository, nothing is printed, and nothing reaches the sidecar. A malformed
`NAVI_OTLP_HEADERS` entry is reported by its position alone — no part of the entry is shown,
because an entry with no delimiter in it is the credential, and a value containing a comma
becomes the next "entry". A value
carrying a stray carriage return (a `.env` saved with CRLF endings) is refused by the name
of the variable that holds it, rather than by the internal header name Node would name.

| Backend | Endpoint variable | Credential | Also honoured |
| --- | --- | --- | --- |
| `agentobs` | `NAVI_AGENTOBS_ENDPOINT` (full traces URL) | `NAVI_AGENTOBS_INGEST_KEY` → `X-Ingest-Key` | — |
| `opik` | `NAVI_OPIK_ENDPOINT` (default Opik Cloud) | `NAVI_OPIK_API_KEY` → `Authorization` | `NAVI_OPIK_WORKSPACE`, `NAVI_OPIK_PROJECT` |
| `langsmith` | `NAVI_LANGSMITH_ENDPOINT` (default LangSmith Cloud) | `NAVI_LANGSMITH_API_KEY` → `x-api-key` | `NAVI_LANGSMITH_PROJECT` |
| `otlp` | `NAVI_OTLP_ENDPOINT` | — | `NAVI_OTLP_HEADERS` (`k=v,k=v`) |

For Opik and LangSmith the endpoint is a **base** and `/v1/traces` is appended, matching
what each vendor documents for `OTEL_EXPORTER_OTLP_ENDPOINT`. For AgentObs the endpoint
is the full URL, usually `https://<host>/v1/otlp/traces`. `otlp` is the escape hatch: a
local collector, or a vendor not listed here, with headers given verbatim.

```bash
export NAVI_LANGSMITH_API_KEY=...
export NAVI_LANGSMITH_PROJECT=navi-delivery
navi-delivery telemetry doctor     # langsmith   yes   https://api.smith.langchain.com/otel/v1/traces
navi-delivery telemetry export --backend langsmith
```

## The span model

```
change:add-csv-export        root, kind = NAVI_OTLP_SPAN_KIND (default "agent")
├─ G1 pass                   kind = NAVI_OTLP_GATE_SPAN_KIND (default "task")
├─ G2 fail                   status 2
├─ G2 pass                   navi.attempt = 2, navi.previous_verdict = fail
└─ G6 waived                 navi.waiver_expires
```

A gate decision is an **instant**, so its span has no duration. The number a delivery
dashboard actually wants — how long the change waited between decisions — is on the span
as `navi.since_previous_ms`, recorded as what it is rather than dressed up as a measured
duration. The root span carries `navi.elapsed_ms`, `navi.decisions`,
`navi.gates_passed`, `navi.gates_failed`, `navi.gates_waived` and `navi.archived`.

A failed gate is an error span. The **change** is not: rework is the normal path through
this framework, and a trace that marked every reworked change as failed would be useless
within a week.

Trace and span ids are derived — `sha256(namespace|change)` and
`sha256(traceId|spanPath)` — not random. Exporting the same change twice lands on the
same trace rather than scattering one change across parallel ones, which is what makes
`--all` safe to run repeatedly. The namespace is the `origin` remote URL when there is
one, the absolute path otherwise, and `NAVI_OTLP_TRACE_NAMESPACE` overrides both.

## Span kinds, and the one way this can silently do nothing

`llm.span.kind` is AgentObs's own convention, with no OpenTelemetry semantic meaning.
AgentObs renders only the kinds it recognises; a kind it does not know is accepted,
stored, and shown on no screen — with no error on either side. That is the one failure
mode here that looks exactly like success.

So: probe before trusting a dashboard. Send one change with `NAVI_OTLP_SPAN_KIND=agent`,
look at AgentObs, and if nothing appears try `workflow`, `chain` or `task`. Both kinds
are settings for this reason. Opik and LangSmith ignore the attribute.

## Knowing whether it arrived

Every real export writes `delivery/.adlc/telemetry.json`:

```json
{ "add-csv-export": { "backend": "langsmith", "url": "...", "trace_id": "...",
                      "spans": 7, "ok": true, "status": 202, "attempts": 1,
                      "bytes": 4821, "error": null, "at": "2026-10-01T..." } }
```

It holds the outcome and never a credential. `delivery/.adlc/` is part of the committed
tree, so everything written there is redacted first — four ordinary endpoint forms carry a
secret, and all four become `<redacted>`: userinfo (`https://user:token@host/…`), a
query-string key, a `;`-parameter, and a key embedded in the path.

The `error` field gets the same treatment, by a stronger rule: the exporter knows which
values it sent as credentials and removes those by value. A gateway that echoes your ingest
key back inside a `400` body matches no pattern, and that body is both printed and stored.

A path segment of 20 or more characters is redacted on the assumption it is a token, which
will occasionally blank a long route id. A less precise sidecar is the right trade against a
key in a committed file. A `401` here is a stale key, and it is visible where you would look rather
than only in a vendor's UI you have not opened.

A failed export exits non-zero and reports why, but changes nothing about the delivery
record: a gate that was recorded stays recorded whether or not a trace reached a vendor.
`5xx` and `429` are retried twice with backoff; `401` and `403` are not, because a wrong
key will be wrong again.

## Attribute reference

| Attribute | On | Meaning |
| --- | --- | --- |
| `navi.change` | both | the change slug |
| `navi.lane` | both | express · standard · full · hotfix, when known |
| `navi.decisions` | root | how many gate decisions the change has |
| `navi.gates_passed` / `_failed` / `_waived` | root | tallies |
| `navi.archived` | root | whether G9 archived it |
| `navi.elapsed_ms` | root | first decision to last |
| `navi.gate` | gate | G1…G9 |
| `navi.verdict` | gate | pass · fail · waived · archived |
| `navi.attempt` | gate | 1 for the first decision on that gate, 2 for a re-record |
| `navi.previous_verdict` | gate | what a re-record replaced |
| `navi.since_previous_ms` | gate | interval since the previous decision |
| `navi.evidence` | gate | the evidence path given at the gate |
| `navi.waiver_reason` / `navi.waiver_expires` | gate | on a waiver |
| `navi.actor` / `navi.actor_source` | gate | who recorded it, and how strongly that is attested — an inferred name must never read as a typed one |
