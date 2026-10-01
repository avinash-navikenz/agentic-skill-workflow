"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

const init = require("../../cli/commands/init");
const propose = require("../../cli/commands/propose");
const gate = require("../../cli/commands/gate");
const telemetry = require("../../cli/commands/telemetry");
const { fold, traceIdFor } = require("../../cli/lib/telemetry/spans");
const { toPayload, truncate } = require("../../cli/lib/telemetry/payload");
const { resolve, parseHeaders, redactUrl } = require("../../cli/lib/telemetry/backends");
const { redactText } = require("../../cli/lib/telemetry/redact");
const { post } = require("../../cli/lib/telemetry/exporter");

const EVENTS = [
  { ts: "2026-10-01T10:00:00.000Z", change: "c", gate: "G2", verdict: "pass", evidence: "e.md", actor: "ana", actor_source: "flag" },
  { ts: "2026-10-01T10:05:00.000Z", change: "c", gate: "G6", verdict: "fail", evidence: "ci.log" },
  { ts: "2026-10-01T10:09:00.000Z", change: "c", gate: "G6", verdict: "pass", evidence: "ci.log", previous: "fail" },
  { ts: "2026-10-01T10:10:00.000Z", change: "other", gate: "G2", verdict: "pass", evidence: "x" },
];
const OPTS = { namespace: "ns", change: "c", lane: "standard" };

// ---------------------------------------------------------------- the fold

test("the fold builds one root and one span per decision for the named change", () => {
  const { spans } = fold(EVENTS, OPTS);
  assert.strictEqual(spans.length, 4);
  assert.strictEqual(spans[0].name, "change:c");
  assert.strictEqual(spans[0].parentSpanId, null);
  assert.deepStrictEqual(spans.slice(1).map((s) => s.name), ["G2 pass", "G6 fail", "G6 pass"]);
  assert.ok(spans.slice(1).every((s) => s.parentSpanId === spans[0].spanId));
});

test("another change's events never enter this change's trace", () => {
  const { spans } = fold(EVENTS, OPTS);
  assert.ok(spans.every((s) => s.attributes["navi.change"] === "c"));
});

test("ids are derived, so re-exporting lands on the same trace", () => {
  assert.strictEqual(fold(EVENTS, OPTS).traceId, fold(EVENTS, OPTS).traceId);
  assert.deepStrictEqual(fold(EVENTS, OPTS).spans.map((s) => s.spanId),
                         fold(EVENTS, OPTS).spans.map((s) => s.spanId));
});

test("a different namespace is a different trace, so two repos do not collide", () => {
  assert.notStrictEqual(traceIdFor("repo-a", "c"), traceIdFor("repo-b", "c"));
});

test("a second decision on one gate gets its own span, not an overwrite", () => {
  const { spans } = fold(EVENTS, OPTS);
  const g6 = spans.filter((s) => s.attributes["navi.gate"] === "G6");
  assert.strictEqual(g6.length, 2);
  assert.notStrictEqual(g6[0].spanId, g6[1].spanId);
  assert.deepStrictEqual(g6.map((s) => s.attributes["navi.attempt"]), [1, 2]);
  assert.strictEqual(g6[1].attributes["navi.previous_verdict"], "fail");
});

test("a failed gate is an error span; the change itself is not", () => {
  const { spans } = fold(EVENTS, OPTS);
  assert.strictEqual(spans.find((s) => s.name === "G6 fail").statusCode, 2);
  assert.strictEqual(spans[0].statusCode, 1);
});

test("the interval between decisions is recorded as what it is, not as a duration", () => {
  const { spans } = fold(EVENTS, OPTS);
  const g6fail = spans.find((s) => s.name === "G6 fail");
  assert.strictEqual(g6fail.startNs, g6fail.endNs, "a gate decision is an instant");
  assert.strictEqual(g6fail.attributes["navi.since_previous_ms"], 300000);
  assert.strictEqual(spans[0].attributes["navi.elapsed_ms"], 540000);
});

test("how strongly the actor is attested travels with the actor", () => {
  const span = fold(EVENTS, OPTS).spans.find((s) => s.name === "G2 pass");
  assert.strictEqual(span.attributes["navi.actor"], "ana");
  assert.strictEqual(span.attributes["navi.actor_source"], "flag");
});

test("a change with no recorded decisions folds to nothing", () => {
  assert.strictEqual(fold(EVENTS, { ...OPTS, change: "never-proposed" }), null);
});

test("an unparseable timestamp is reported, not silently exported as 1970", () => {
  assert.throws(() => fold([{ ts: "yesterday", change: "c", gate: "G2", verdict: "pass" }], OPTS),
                /unparseable ts/);
});

// -------------------------------------------------------------- the payload

test("nanosecond timestamps are strings, because they exceed a safe integer", () => {
  const { traceId, spans } = fold(EVENTS, OPTS);
  const span = toPayload(traceId, spans).resourceSpans[0].scopeSpans[0].spans[0];
  assert.strictEqual(typeof span.startTimeUnixNano, "string");
  assert.ok(Number(span.startTimeUnixNano) > Number.MAX_SAFE_INTEGER);
});

test("the span kind AgentObs reads is on every span", () => {
  const { traceId, spans } = fold(EVENTS, OPTS);
  const out = toPayload(traceId, spans).resourceSpans[0].scopeSpans[0].spans;
  const kinds = out.map((s) => s.attributes.find((a) => a.key === "llm.span.kind").value.stringValue);
  assert.deepStrictEqual(kinds, ["agent", "task", "task", "task"]);
});

test("a boolean attribute travels as a string rather than being dropped", () => {
  const { traceId, spans } = fold(EVENTS, OPTS);
  const root = toPayload(traceId, spans).resourceSpans[0].scopeSpans[0].spans[0];
  const archived = root.attributes.find((a) => a.key === "navi.archived");
  assert.deepStrictEqual(archived.value, { stringValue: "false" });
});

test("service.name is a resource attribute, so spans group under it", () => {
  const { traceId, spans } = fold(EVENTS, OPTS);
  const p = toPayload(traceId, spans, { "navi.change": "c" });
  assert.strictEqual(p.resourceSpans.length, 1);
  const names = p.resourceSpans[0].resource.attributes.map((a) => a.key);
  assert.ok(names.includes("service.name"));
  assert.ok(names.includes("navi.change"));

  // The fold stamps one service name on every span, so the assertion above can
  // only ever see one group — it would pass with the grouping deleted. This is
  // the half that exercises the grouping itself.
  const mixed = [{ ...spans[0], serviceName: "a" }, { ...spans[1], serviceName: "b" }];
  const grouped = toPayload(traceId, mixed, {});
  assert.strictEqual(grouped.resourceSpans.length, 2);
  assert.deepStrictEqual(
    grouped.resourceSpans.map((r) => r.resource.attributes.find((a) => a.key === "service.name").value.stringValue),
    ["a", "b"]);
});

test("truncation is never silent", () => {
  assert.match(truncate("x".repeat(100), 10), /…\[truncated 90 chars\]$/);
  assert.strictEqual(truncate("short", 10), "short");
});

// ------------------------------------------------------------- the backends

test("a backend reports what is missing by variable name", () => {
  const r = resolve("agentobs", {});
  assert.strictEqual(r.ready, false);
  assert.deepStrictEqual(r.missing, ["NAVI_AGENTOBS_ENDPOINT", "NAVI_AGENTOBS_INGEST_KEY"]);
});

test("each vendor's documented endpoint and header names are used", () => {
  const opik = resolve("opik", { NAVI_OPIK_API_KEY: "k", NAVI_OPIK_WORKSPACE: "w", NAVI_OPIK_PROJECT: "p" });
  assert.strictEqual(opik.url, "https://www.comet.com/opik/api/v1/private/otel/v1/traces");
  assert.strictEqual(opik.headers.Authorization, "k");
  assert.strictEqual(opik.headers["Comet-Workspace"], "w");
  assert.strictEqual(opik.headers.projectName, "p");

  const ls = resolve("langsmith", { NAVI_LANGSMITH_API_KEY: "k", NAVI_LANGSMITH_PROJECT: "p" });
  assert.strictEqual(ls.url, "https://api.smith.langchain.com/otel/v1/traces");
  assert.strictEqual(ls.headers["x-api-key"], "k");
  assert.strictEqual(ls.headers["Langsmith-Project"], "p");

  const ao = resolve("agentobs", { NAVI_AGENTOBS_ENDPOINT: "https://h/v1/otlp/traces", NAVI_AGENTOBS_INGEST_KEY: "k" });
  assert.strictEqual(ao.url, "https://h/v1/otlp/traces");
  assert.strictEqual(ao.headers["X-Ingest-Key"], "k");
});

test("a trailing slash on a configured endpoint does not double the path", () => {
  const r = resolve("langsmith", { NAVI_LANGSMITH_ENDPOINT: "https://host/otel/", NAVI_LANGSMITH_API_KEY: "k" });
  assert.strictEqual(r.url, "https://host/otel/v1/traces");
});

test("generic OTLP headers parse in the shape every OTel exporter uses", () => {
  assert.deepStrictEqual(parseHeaders("a=1, b=two=three"), { a: "1", b: "two=three" });
  assert.throws(() => parseHeaders("nope"), /not key=value/);
});

test("an unknown backend names the ones that exist", () => {
  assert.throws(() => resolve("datadog", {}), /one of agentobs, opik, langsmith, otlp/);
});

// ------------------------------------------------------------- the exporter

function server(handler) {
  const s = http.createServer(handler);
  return new Promise((r) => s.listen(0, "127.0.0.1", () => r({ s, url: `http://127.0.0.1:${s.address().port}/v1/traces` })));
}

test("a 2xx is a success, reported with the byte count that left", async () => {
  const { s, url } = await server((req, res) => { res.writeHead(200); res.end("{}"); });
  const r = await post(url, { "Content-Type": "application/json" }, { resourceSpans: [] });
  s.close();
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.attempts, 1);
  assert.ok(r.bytes > 0);
});

test("a 5xx is retried and then reported with the server's own words", async () => {
  let hits = 0;
  const { s, url } = await server((req, res) => { hits += 1; res.writeHead(503); res.end("overloaded"); });
  const r = await post(url, {}, {}, { retries: 2, sleep: () => Promise.resolve() });
  s.close();
  assert.strictEqual(hits, 3);
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /HTTP 503: overloaded/);
});

test("a 401 is not retried, because a wrong key will be wrong again", async () => {
  let hits = 0;
  const { s, url } = await server((req, res) => { hits += 1; res.writeHead(401); res.end("unauthorized"); });
  const r = await post(url, {}, {}, { retries: 2, sleep: () => Promise.resolve() });
  s.close();
  assert.strictEqual(hits, 1);
  assert.match(r.error, /HTTP 401/);
});

test("an unreachable endpoint is an error value, never a thrown exception", async () => {
  const r = await post("http://127.0.0.1:1/v1/traces", {}, {}, { retries: 0 });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.status, 0);
  assert.ok(r.error);
});

test("a string that is not a URL is reported as one, not as a crash", async () => {
  const r = await post("not a url", {}, {}, { retries: 0 });
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /not a URL/);
});

// -------------------------------------------------------------- the command

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nd-telem-"));
  init.run([], root, () => {});
  propose.run(["c", "--lane", "express"], root, () => {});
  fs.writeFileSync(path.join(root, "evidence.md"), "proof");
  gate.run(["G2", "--pass", "--evidence", "evidence.md"], root, () => {});
  return root;
}

function capture() {
  const lines = [];
  return { lines, emit: (m) => lines.push(String(m)) };
}

test("doctor prints header names and never a header value", () => {
  const { lines, emit } = capture();
  const env = { NAVI_LANGSMITH_API_KEY: "super-secret-key", NAVI_OTLP_TRACE_NAMESPACE: "ns" };
  assert.strictEqual(telemetry.run(["doctor"], repo(), emit, env), 0);
  const text = lines.join("\n");
  assert.ok(text.includes("x-api-key"), "the header name should be shown");
  assert.ok(!text.includes("super-secret-key"), "the credential must not be printed");
  assert.match(text, /langsmith   yes/);
});

test("preview writes the payload and sends nothing", () => {
  const root = repo();
  const out = path.join(root, "payload.json");
  const { lines, emit } = capture();
  assert.strictEqual(telemetry.run(["preview", "--out", out], root, emit, { NAVI_OTLP_TRACE_NAMESPACE: "ns" }), 0);
  const written = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.strictEqual(written.length, 1);
  assert.strictEqual(written[0].resourceSpans[0].scopeSpans[0].spans.length, 2);
  assert.match(lines.join("\n"), /c: trace [0-9a-f]{32}, 2 span\(s\)/);
});

test("export refuses a backend the environment has not configured", async () => {
  const { lines, emit } = capture();
  const code = await telemetry.run(["export", "--backend", "agentobs"], repo(), emit, {});
  assert.strictEqual(code, 1);
  assert.match(lines.join("\n"), /missing: NAVI_AGENTOBS_ENDPOINT/);
});

test("a dry run resolves and builds but sends nothing and records nothing", async () => {
  const root = repo();
  const { lines, emit } = capture();
  const env = { NAVI_AGENTOBS_ENDPOINT: "http://127.0.0.1:1/v1/otlp/traces", NAVI_AGENTOBS_INGEST_KEY: "k" };
  assert.strictEqual(await telemetry.run(["export", "--backend", "agentobs", "--dry-run"], root, emit, env), 0);
  assert.match(lines.join("\n"), /would send 2 span\(s\)/);
  assert.strictEqual(fs.existsSync(telemetry.sidecarPath(root)), false);
});

test("a real export records the outcome locally and never the credential", async () => {
  const root = repo();
  let received = null;
  const { s, url } = await server((req, res) => {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => { received = { headers: req.headers, body: JSON.parse(body) }; res.writeHead(200); res.end("{}"); });
  });
  const env = { NAVI_AGENTOBS_ENDPOINT: url, NAVI_AGENTOBS_INGEST_KEY: "secret-ingest-key", NAVI_OTLP_TRACE_NAMESPACE: "ns" };
  const { lines, emit } = capture();
  const code = await telemetry.run(["export", "--backend", "agentobs"], root, emit, env);
  s.close();

  assert.strictEqual(code, 0);
  assert.strictEqual(received.headers["x-ingest-key"], "secret-ingest-key");
  assert.strictEqual(received.body.resourceSpans[0].scopeSpans[0].spans.length, 2);

  const sidecar = JSON.parse(fs.readFileSync(telemetry.sidecarPath(root), "utf8"));
  assert.strictEqual(sidecar.c.ok, true);
  assert.strictEqual(sidecar.c.backend, "agentobs");
  assert.ok(!JSON.stringify(sidecar).includes("secret-ingest-key"), "the key must not reach the sidecar");
  assert.ok(!lines.join("\n").includes("secret-ingest-key"), "the key must not be printed");
});

test("a refused export is reported and recorded, and exits non-zero", async () => {
  const root = repo();
  const { s, url } = await server((req, res) => { res.writeHead(401); res.end("bad key"); });
  const env = { NAVI_AGENTOBS_ENDPOINT: url, NAVI_AGENTOBS_INGEST_KEY: "stale" };
  const { lines, emit } = capture();
  const code = await telemetry.run(["export", "--backend", "agentobs"], root, emit, env);
  s.close();
  assert.strictEqual(code, 1);
  assert.match(lines.join("\n"), /NOT sent — HTTP 401/);
  assert.strictEqual(JSON.parse(fs.readFileSync(telemetry.sidecarPath(root), "utf8")).c.ok, false);
});

test("--all exports every change the event log knows, not only the one in flight", async () => {
  const root = repo();
  const { lines, emit } = capture();
  // A second change can only exist once the first is out of flight, which is
  // what the archive path is for; the event log keeps both either way.
  fs.appendFileSync(path.join(root, "delivery", ".adlc", "events.jsonl"),
    JSON.stringify({ ts: "2026-10-01T11:00:00.000Z", change: "older", gate: "G7", verdict: "pass", evidence: "x" }) + "\n");
  const env = { NAVI_AGENTOBS_ENDPOINT: "http://127.0.0.1:1/x", NAVI_AGENTOBS_INGEST_KEY: "k", NAVI_OTLP_TRACE_NAMESPACE: "ns" };
  await telemetry.run(["export", "--backend", "agentobs", "--dry-run", "--all"], root, emit, env);
  const text = lines.join("\n");
  assert.match(text, /^c: would send/m);
  assert.match(text, /^older: would send/m);
});

test("naming a change with nothing recorded says so rather than sending an empty trace", async () => {
  const { lines, emit } = capture();
  const env = { NAVI_AGENTOBS_ENDPOINT: "http://127.0.0.1:1/x", NAVI_AGENTOBS_INGEST_KEY: "k" };
  // Non-zero: the caller asked for one specific change and got nothing, which
  // is a typo'd slug or a change that has not reached a gate. This test used to
  // assert 0 and so enshrined the defect — a CI step gated on the exit code
  // passed while nothing was transmitted.
  const code = await telemetry.run(["export", "--backend", "agentobs", "--change", "ghost"], repo(), emit, env);
  assert.strictEqual(code, 1);
  assert.match(lines.join("\n"), /ghost: no gate decisions recorded/);
});

test("what preview writes is byte-for-byte what export sends", async () => {
  const root = repo();
  const out = path.join(root, "payload.json");
  const env = { NAVI_AGENTOBS_ENDPOINT: "", NAVI_OTLP_TRACE_NAMESPACE: "ns" };

  let received = null;
  const { s, url } = await server((req, res) => {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => { received = JSON.parse(body); res.writeHead(200); res.end("{}"); });
  });
  const live = { ...env, NAVI_AGENTOBS_ENDPOINT: url, NAVI_AGENTOBS_INGEST_KEY: "k" };

  assert.strictEqual(telemetry.run(["preview", "--backend", "agentobs", "--out", out], root, () => {}, live), 0);
  assert.strictEqual(await telemetry.run(["export", "--backend", "agentobs"], root, () => {}, live), 0);
  s.close();

  // The promise preview makes. Asserting only its exit code left the --backend
  // path unobservable — the test passed with the whole block deleted.
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(out, "utf8"))[0], received);
});

test("preview rejects a backend name export would reject", () => {
  const bad = capture();
  assert.strictEqual(telemetry.run(["preview", "--backend", "datadog"], repo(), bad.emit, {}), 1);
  assert.match(bad.lines.join("\n"), /one of agentobs, opik, langsmith, otlp/);
});


// --------------------------------------------- regressions found in review

test("a malformed NAVI_OTLP_HEADERS entry never echoes any part of itself", () => {
  // Three shapes, because showing "just the leading token" was safe for the
  // first and a straight credential leak for the other two: an entry with no
  // delimiter IS the token, and a value containing a comma becomes the next
  // "entry". The message now carries the position and nothing else.
  const cases = [
    ["a=1, Authorization: Bearer sk-live-TOPSECRET-9f3a", "sk-live-TOPSECRET-9f3a"],
    ["sk-ant-api03-REALKEYVALUE", "sk-ant-api03-REALKEYVALUE"],
    ["Authorization=Bearer abc,defmoresecret", "defmoresecret"],
  ];
  for (const [raw, secret] of cases) {
    assert.throws(() => parseHeaders(raw), (e) => {
      assert.ok(!e.message.includes(secret), `the error printed the credential: ${e.message}`);
      assert.match(e.message, /NAVI_OTLP_HEADERS entry \d+ of \d+ is not key=value/);
      return true;
    }, `expected ${JSON.stringify(raw)} to be refused`);
  }
});

test("export reports a malformed header variable without printing it", async () => {
  for (const raw of ["Authorization: Bearer sk-live-TOPSECRET-9f3a", "sk-ant-api03-REALKEYVALUE"]) {
    const { lines, emit } = capture();
    const env = { NAVI_OTLP_ENDPOINT: "https://c/v1/traces", NAVI_OTLP_HEADERS: raw };
    assert.strictEqual(await telemetry.run(["export", "--backend", "otlp"], repo(), emit, env), 1);
    const text = lines.join("\n");
    assert.ok(!text.includes("TOPSECRET") && !text.includes("REALKEYVALUE"),
              `the credential reached stdout: ${text}`);
  }
});

test("the sidecar records a redacted url, not the one with the credential in it", async () => {
  // The earlier redaction test only ran --dry-run, which returns before the
  // sidecar is written — so reverting the redaction left the suite green while
  // the credential went into a committed file.
  const root = repo();
  const { s, url } = await server((req, res) => { res.writeHead(200); res.end("{}"); });
  const credentialed = url.replace("http://", "http://user:S3cr3tP4ss@") + "?api-key=alsosecret";
  const { lines, emit } = capture();
  await telemetry.run(["export", "--backend", "otlp"], root, emit,
                      { NAVI_OTLP_ENDPOINT: credentialed, NAVI_OTLP_TRACE_NAMESPACE: "ns" });
  s.close();

  const raw = fs.readFileSync(telemetry.sidecarPath(root), "utf8");
  assert.ok(!raw.includes("S3cr3tP4ss"), `userinfo reached the sidecar: ${raw}`);
  assert.ok(!raw.includes("alsosecret"), `a query-string key reached the sidecar: ${raw}`);
  assert.match(raw, /<redacted>/);
  assert.ok(!lines.join("\n").includes("S3cr3tP4ss"), "userinfo reached stdout");
});

test("a scheme-less endpoint carrying userinfo is still redacted", () => {
  // `new URL` reads `user:` as the scheme, so the parsed-userinfo branch never
  // fired and the credential went through untouched.
  assert.strictEqual(redactUrl("user:S3cr3tP4ss@collector.internal/v1/traces"),
                     "<redacted>@collector.internal/v1/traces");
});

test("doctor survives a variable it cannot parse, and still lists the rest", () => {
  const secret = "sk-live-TOPSECRET";
  const { lines, emit } = capture();
  assert.strictEqual(telemetry.run(["doctor"], repo(), emit, { NAVI_OTLP_HEADERS: `Authorization: Bearer ${secret}` }), 0);
  const text = lines.join("\n");
  assert.ok(!text.includes(secret), "the credential reached stdout");
  assert.match(text, /otlp +no +\(not resolvable\)/);
  assert.match(text, /^langsmith/m, "one bad variable aborted the whole listing");
});

test("a credential carrying CR is reported by variable name, not by header name", () => {
  const r = resolve("agentobs", { NAVI_AGENTOBS_ENDPOINT: "https://h/x", NAVI_AGENTOBS_INGEST_KEY: "abc\r" });
  assert.strictEqual(r.ready, false);
  assert.match(r.problems[0], /^NAVI_AGENTOBS_INGEST_KEY contains a newline or carriage return/);
});

test("the exporter returns an error value rather than throwing on an invalid header", async () => {
  const r = await post("https://h/x", { "X-K": "abc\r" }, {}, { retries: 0 });
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /request could not be built/);
});

test("a named change holding nothing exits non-zero; a quiet --all does not", async () => {
  const root = repo();
  const env = { NAVI_AGENTOBS_ENDPOINT: "http://127.0.0.1:1/x", NAVI_AGENTOBS_INGEST_KEY: "k" };
  // A typo'd slug used to exit 0, so a CI step gated on it passed having sent nothing.
  assert.strictEqual(await telemetry.run(["export", "--backend", "agentobs", "--change", "ghost"], root, () => {}, env), 1);
  assert.strictEqual(telemetry.run(["preview", "--change", "ghost"], root, () => {}, env), 1);
});

test("an endpoint carrying a credential is redacted everywhere it is written", async () => {
  const root = repo();
  const { lines, emit } = capture();
  const env = { NAVI_OTLP_ENDPOINT: "https://user:S3cr3tP4ss@h/v1/traces?api-key=alsosecret",
                NAVI_OTLP_TRACE_NAMESPACE: "ns" };
  await telemetry.run(["export", "--backend", "otlp", "--dry-run"], root, emit, env);
  const text = lines.join("\n");
  assert.ok(!text.includes("S3cr3tP4ss"), "userinfo reached stdout");
  assert.ok(!text.includes("alsosecret"), "a query-string key reached stdout");
  assert.match(text, /<redacted>/);

  assert.strictEqual(redactUrl("https://h/v1/traces"), "https://h/v1/traces");
  assert.strictEqual(redactUrl("not a url"), "not a url");
});

test("preview and export agree on an --all run that finds nothing", () => {
  // preview --all exited 1 on a quiet repository while export --all exited 0,
  // against a table in docs/CLI.md that says 0. Neither had a test.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nd-quiet-"));
  init.run([], root, () => {});
  propose.run(["c", "--lane", "express"], root, () => {});
  const { lines, emit } = capture();
  assert.strictEqual(telemetry.run(["preview", "--all"], root, emit, {}), 0);
  assert.match(lines.join("\n"), /nothing recorded yet/);
});

test("a credential the vendor echoes back never reaches stdout or the sidecar", async () => {
  // A gateway returning the request in its 400 body matches no query-parameter
  // pattern, so the key went into a committed file. The exporter knows what it
  // sent and now removes those values by value.
  const root = repo();
  const { s, url } = await server((req, res) => {
    res.writeHead(400);
    res.end(`no such route: ${url}${req.url} (header X-Ingest-Key=${req.headers["x-ingest-key"]})`);
  });
  const { lines, emit } = capture();
  await telemetry.run(["export", "--backend", "agentobs"], root, emit, {
    NAVI_AGENTOBS_ENDPOINT: `${url}?auth=TOPSECRET`,
    NAVI_AGENTOBS_INGEST_KEY: "HEADERSECRETVALUE",
  });
  s.close();

  const sidecar = fs.readFileSync(telemetry.sidecarPath(root), "utf8");
  for (const where of [sidecar, lines.join("\n")]) {
    assert.ok(!where.includes("HEADERSECRETVALUE"), `the ingest key leaked: ${where}`);
    assert.ok(!where.includes("TOPSECRET"), `the query key leaked: ${where}`);
  }
  assert.match(sidecar, /<redacted>/);
});

test("a credential outside a query string is redacted too", () => {
  // Only `?`-prefixed parameters were covered, so three ordinary endpoint
  // shapes carried a key into the sidecar verbatim.
  assert.strictEqual(redactUrl("https://h/v1/ingest/TOPSECRETTOKENVALUE123/traces"),
                     "https://h/v1/ingest/<redacted>/traces");
  assert.strictEqual(redactUrl("https://h/v1/traces;token=TOPSECRET"), "https://h/v1/traces;<redacted>");
  assert.strictEqual(redactUrl("https://h/v1/traces#key=TOPSECRET"), "https://h/v1/traces#<redacted>");
  // An ordinary endpoint is left alone.
  assert.strictEqual(redactUrl("https://host/v1/otlp/traces"), "https://host/v1/otlp/traces");
});

test("a credential survives neither truncation nor the marker that redacts it", async () => {
  const root = repo();
  const key = "sk-live-9f3a2b1c8d7e6f5a4b3c2d1e0f9a8b7c";
  // Over 400 characters, which is the normal case for a gateway error page.
  // Slicing before scrubbing cut the key in half, and half a key matches
  // nothing by value — so most of it reached the committed sidecar.
  const { s, url } = await server((req, res) => {
    res.writeHead(400);
    res.end("gateway rejected the request; ".repeat(12) + ` X-Ingest-Key: ${req.headers["x-ingest-key"]} (end)`);
  });
  const { lines, emit } = capture();
  await telemetry.run(["export", "--backend", "agentobs"], root, emit,
                      { NAVI_AGENTOBS_ENDPOINT: url, NAVI_AGENTOBS_INGEST_KEY: key });
  s.close();

  const sidecar = fs.readFileSync(telemetry.sidecarPath(root), "utf8");
  for (const where of [sidecar, lines.join("\n")]) {
    for (let cut = 12; cut <= key.length; cut += 4) {
      assert.ok(!where.includes(key.slice(0, cut)),
                `${cut} characters of the key leaked: ${where.slice(0, 300)}`);
    }
  }
});

test("supplying a known secret never makes the output less redacted", () => {
  // `<redacted>` contains `<`, which ends the URL pattern's character class, so
  // substituting by value first truncated every URL at the first known secret
  // and let the rest of it through.
  const text = "HTTP 400: https://h/WORKSPACEVALUE1/ingest/BBBBBBBBBBBBBBBBBBBBBBBB/traces?apikey=ZZZ";
  const withKnown = redactText(text, ["WORKSPACEVALUE1"]);
  assert.ok(!withKnown.includes("BBBBBBBBBBBBBBBBBBBBBBBB"), withKnown);
  assert.ok(!withKnown.includes("WORKSPACEVALUE1"), withKnown);
  assert.ok(!withKnown.includes("apikey=ZZZ"), withKnown);
});

test("a secret the vendor re-cases or url-encodes is still removed", () => {
  const key = "SK-LIVE-9F3A2B1C8D7E6F5A";
  assert.ok(!redactText(`400: sent key=${key.toLowerCase()}`, [key]).includes(key.toLowerCase()));
  const encodable = "tok/en+value=abc";
  assert.ok(!redactText(`400: ${encodeURIComponent(encodable)}`, [encodable])
    .includes(encodeURIComponent(encodable)));
});

test("redaction does not blank the hostname the sidecar exists to record", () => {
  // Applied to the whole url it matched host labels too, so the one fact worth
  // keeping — which endpoint this went to — was destroyed.
  assert.strictEqual(redactUrl("https://agentobs-prod-eastus.example.com/v1/otlp/traces"),
                     "https://agentobs-prod-eastus.example.com/v1/otlp/traces");
  assert.strictEqual(redactUrl("http://my-company-telemetry:4318/v1/traces"),
                     "http://my-company-telemetry:4318/v1/traces");
  // The path rule still applies.
  assert.strictEqual(redactUrl("https://h/v1/ingest/TOPSECRETTOKENVALUE123/traces"),
                     "https://h/v1/ingest/<redacted>/traces");
});
