# Verifying telemetry against a real backend

How to prove `navi-delivery telemetry` actually works — not that it is configured, which is
a different and much weaker claim. The sequence below ends with a trace you can open on a
screen.

Everything here uses a throwaway project, so nothing real is touched.

## 1. A project with something to export

Telemetry exports the gate ledger, so there must be one. Five minutes:

```bash
mkdir /tmp/navi-demo && cd /tmp/navi-demo
git init -q && git config user.email you@example.com && git config user.name You
git commit -q --allow-empty -m "chore: before navi-delivery"

navi-delivery init
navi-delivery propose unicode-slugs --lane express

mkdir -p delivery/changes/unicode-slugs/evidence
echo "4 tests, 0 failures" > delivery/changes/unicode-slugs/evidence/g2-tests.txt
E=delivery/changes/unicode-slugs/evidence/g2-tests.txt

navi-delivery gate G2 --pass --evidence $E
navi-delivery gate G6 --fail --evidence $E     # record a failure on purpose
navi-delivery gate G6 --pass --evidence $E     # and the rework after it
navi-delivery gate G7 --pass --evidence $E
```

Record a failure and its rework deliberately. A ledger of nothing but passes exercises
none of the interesting cases: the error span, the second attempt, `previous_verdict`.

## 2. Look at the payload before sending it anywhere

```bash
navi-delivery telemetry preview --out /tmp/payload.json
```

`preview` builds through the same fold `export` uses, so what it writes is what would be
sent. Five spans for the ledger above: one root and one per decision.

## 3. Send it to a receiver you control

Before involving a vendor, prove the transport. Thirty lines of Node is enough:

```js
// /tmp/receiver.js
const http = require("node:http"), fs = require("node:fs");
http.createServer((req, res) => {
  let body = ""; req.on("data", c => body += c);
  req.on("end", () => {
    fs.writeFileSync("/tmp/received.json", body);
    console.log(req.method, req.url, Object.keys(req.headers).join(","));
    res.writeHead(202, { "content-type": "application/json" });
    res.end('{"partialSuccess":{}}');
  });
}).listen(4318, "127.0.0.1", () => console.log("receiver on 4318"));
```

```bash
node /tmp/receiver.js &
NAVI_OTLP_ENDPOINT=http://127.0.0.1:4318/v1/traces \
  navi-delivery telemetry export --backend otlp
```

Expect `sent 5 span(s) — HTTP 202`, and `/tmp/received.json` on disk. If this fails, the
problem is the CLI or your shell — not the vendor, not the network, not the key.

## 4. Then the real backend

```bash
export NAVI_AGENTOBS_ENDPOINT=https://<your-agentobs-host>/v1/otlp/traces
export NAVI_AGENTOBS_INGEST_KEY=...          # never in a file, never in git
navi-delivery telemetry doctor                # should say: agentobs  yes
navi-delivery telemetry export --backend agentobs
```

Expect `sent N span(s) — HTTP 200`.

### A self-hosted collector with its own certificate

Many are. The export will fail with `DEPTH_ZERO_SELF_SIGNED_CERT`, and the error names the
fix. **Pin the certificate; do not turn verification off** — the ingest key travels on that
connection, and an unverified connection is one you cannot prove goes to your collector.

```bash
# Export the certificate the server actually presents.
echo | openssl s_client -connect <host>:443 -servername <host> 2>/dev/null \
  | openssl x509 -outform PEM > ~/.navi/collector.pem

export NAVI_TELEMETRY_CA_FILE=~/.navi/collector.pem
```

Verification stays on and is pinned to exactly that certificate.

**If the host is on a VPN, check which address you are actually testing.** `dig` queries a
public resolver and bypasses split DNS; the system resolver honours it. They can disagree,
and chasing the wrong one wastes an afternoon:

```bash
dig +short <host>                                        # public answer
dscacheutil -q host -a name <host> | grep ip_address     # what your machine will use
```

## 5. Read the local record

Every real export writes `delivery/.adlc/telemetry.json`:

```json
{ "unicode-slugs": { "backend": "agentobs", "url": "https://…", "trace_id": "ab16…",
                     "spans": 5, "ok": true, "status": 200, "attempts": 1,
                     "bytes": 4618, "error": null, "at": "…" } }
```

It holds the outcome and never a credential — the url is redacted of userinfo, query keys
and token-shaped path segments before it is written, because `delivery/.adlc/` is
committed. A `401` here is a stale key, visible where you would look rather than only in a
vendor UI you have not opened.

## 6. The step everyone skips: look at the screen

**A `200` means accepted, not rendered.** These are different claims, and the gap between
them is the one failure mode that looks exactly like success.

`llm.span.kind` is AgentObs's own convention with no OpenTelemetry meaning. AgentObs draws
only the kinds it recognises; one it does not know is accepted, stored, and shown on no
screen — with no error on either side. So:

1. Open the backend and find the trace by the `trace_id` the sidecar recorded.
2. If it is not there despite a `200`, the kind is the first thing to change:

   ```bash
   NAVI_OTLP_SPAN_KIND=workflow navi-delivery telemetry export --backend agentobs
   ```

   Candidates are `agent` (the default), `workflow`, `chain`, `task`. Ids are derived, so
   re-exporting lands on the same trace rather than creating a second one — try each in
   turn without making a mess.
3. Record which one rendered, and the date you checked. That is the only evidence anyone
   has that the dashboard works, and it goes stale when the vendor changes.

## What a correct trace looks like

| Span | Kind | Status | Carries |
| --- | --- | --- | --- |
| `change:<name>` | `agent` | 1 | `elapsed_ms`, `decisions`, `gates_passed/failed/waived` |
| `G2 pass` | `task` | 1 | `evidence`, `actor`, `actor_source`, `since_previous_ms` |
| `G6 fail` | `task` | **2** | the failure is an error span |
| `G6 pass` | `task` | 1 | `attempt=2`, `previous_verdict=fail` |

Two things worth confirming by eye, because both are deliberate and both look like bugs if
you are not expecting them:

- **A failed gate is an error span; the change itself is not.** Rework is the normal path
  through this framework, and a trace marking every reworked change as failed would be
  useless within a week.
- **A gate decision is an instant**, so its span has no duration. The number a delivery
  dashboard wants — how long the change waited — is `navi.since_previous_ms`, recorded as
  what it is rather than dressed up as a measured duration.
