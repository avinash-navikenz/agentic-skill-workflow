"use strict";
// Where a payload goes, and what has to be in the environment for it to arrive.
//
// Every credential is read from the environment and never from a file in the
// repository, never printed, and never written to the sidecar. `resolve` returns
// what is missing by VARIABLE NAME, which is the one thing worth saying out loud
// about a credential.

const { URL } = require("node:url");

const NO_NETWORK_HINT = "set it and run `navi-delivery telemetry doctor` again";

const BACKENDS = {
  // AgentObs: direct ingestion, the route that needs no collector on the VNet.
  // `llm.span.kind` is AgentObs's own convention — a span whose kind it does not
  // recognise is accepted, stored, and rendered nowhere.
  agentobs: {
    endpointVar: "NAVI_AGENTOBS_ENDPOINT",
    defaultEndpoint: null,
    suffix: "",
    secrets: { "X-Ingest-Key": "NAVI_AGENTOBS_INGEST_KEY" },
    optional: {},
    kindAttribute: "llm.span.kind",
    note: "endpoint is the full traces URL, usually https://<host>/v1/otlp/traces",
  },
  opik: {
    endpointVar: "NAVI_OPIK_ENDPOINT",
    defaultEndpoint: "https://www.comet.com/opik/api/v1/private/otel",
    suffix: "/v1/traces",
    secrets: { Authorization: "NAVI_OPIK_API_KEY" },
    optional: { "Comet-Workspace": "NAVI_OPIK_WORKSPACE", projectName: "NAVI_OPIK_PROJECT" },
    kindAttribute: "llm.span.kind",
    note: "self-hosted Opik: set NAVI_OPIK_ENDPOINT to http://localhost:5173/api/v1/private/otel",
  },
  langsmith: {
    endpointVar: "NAVI_LANGSMITH_ENDPOINT",
    defaultEndpoint: "https://api.smith.langchain.com/otel",
    suffix: "/v1/traces",
    secrets: { "x-api-key": "NAVI_LANGSMITH_API_KEY" },
    optional: { "Langsmith-Project": "NAVI_LANGSMITH_PROJECT" },
    kindAttribute: "llm.span.kind",
    note: "the endpoint is the base; /v1/traces is appended",
  },
  // Anything else that speaks OTLP/HTTP JSON — a local collector, a vendor not
  // listed here. Headers are given verbatim, so this route makes no assumption
  // it would have to be right about.
  otlp: {
    endpointVar: "NAVI_OTLP_ENDPOINT",
    defaultEndpoint: null,
    suffix: "",
    secrets: {},
    optional: {},
    headersVar: "NAVI_OTLP_HEADERS",
    kindAttribute: "llm.span.kind",
    note: "NAVI_OTLP_HEADERS takes key=value pairs separated by commas",
  },
};

// `a=1,b=2` — the shape OTEL_EXPORTER_OTLP_HEADERS uses, so anyone who has
// configured an OTel exporter already knows this format.
//
// The error NEVER echoes the entry. What gets pasted into this variable is an
// HTTP header, so the most likely malformation is `Authorization: Bearer <key>`
// written with a colon — and the half after the delimiter is the credential.
// Reporting the entry verbatim printed live keys to stdout.
function parseHeaders(raw) {
  const out = {};
  const entries = String(raw || "").split(",");
  for (let i = 0; i < entries.length; i += 1) {
    const trimmed = entries[i].trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      // The leading token up to the first delimiter is a header name, not a
      // value, so it is safe to show and is the only thing that identifies
      // which entry to fix.
      const name = trimmed.split(/[:=\s]/, 1)[0] || "(empty)";
      throw new Error(`NAVI_OTLP_HEADERS entry ${i + 1} (starting "${name}") is not key=value — ` +
                      "write it as Name=value, with no colon. The value is not shown here.");
    }
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

// A header value carrying CR or LF is rejected by Node's HTTP client with a
// message naming the internal header, which tells nobody which variable to fix
// — and it throws, which the exporter promises never to do. A .env saved with
// CRLF line endings produces exactly this.
const CONTROL = /[\r\n\u0000]/;

function resolve(name, env) {
  const spec = BACKENDS[name];
  if (!spec) {
    throw new Error(`unknown backend ${JSON.stringify(name)} — one of ${Object.keys(BACKENDS).join(", ")}`);
  }
  const missing = [];
  const endpoint = env[spec.endpointVar] || spec.defaultEndpoint;
  if (!endpoint) missing.push(spec.endpointVar);

  const headers = { "Content-Type": "application/json" };
  const problems = [];
  const put = (header, variable) => {
    const value = env[variable];
    if (CONTROL.test(value)) {
      // Named by VARIABLE, which is the only thing about a credential worth
      // saying out loud and the only thing that tells the reader what to fix.
      problems.push(`${variable} contains a newline or carriage return — ` +
                    "check for a .env saved with CRLF endings, or a trailing newline on a paste");
      return;
    }
    headers[header] = value;
  };
  for (const [header, variable] of Object.entries(spec.secrets)) {
    if (env[variable]) put(header, variable);
    else missing.push(variable);
  }
  for (const [header, variable] of Object.entries(spec.optional)) {
    if (env[variable]) put(header, variable);
  }
  if (spec.headersVar && env[spec.headersVar]) Object.assign(headers, parseHeaders(env[spec.headersVar]));

  return {
    name,
    url: endpoint ? `${endpoint.replace(/\/+$/, "")}${spec.suffix}` : null,
    headers,
    missing,
    problems,
    kindAttribute: spec.kindAttribute,
    note: spec.note,
    ready: missing.length === 0 && problems.length === 0,
    hint: missing.length ? NO_NETWORK_HINT : null,
  };
}

// An OTLP endpoint is ordinarily not a secret, but two ordinary forms carry one:
// userinfo (`https://user:token@host/...`) and a query-string key. The sidecar is
// a file in the repository and `delivery/.adlc/` is committed, so the url is
// redacted before it is recorded or printed.
function redactUrl(url) {
  if (typeof url !== "string" || !url) return url;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  let out = url;
  if (parsed.username || parsed.password) {
    parsed.username = "";
    parsed.password = "";
    out = parsed.toString().replace("://", "://<redacted>@");
  }
  // Built by hand rather than through `parsed.search`, which percent-encodes the
  // marker into `%3Credacted%3E` and makes the redaction look like a value.
  const q = out.indexOf("?");
  return q === -1 ? out : `${out.slice(0, q)}?<redacted>`;
}

module.exports = { BACKENDS, resolve, parseHeaders, redactUrl };
