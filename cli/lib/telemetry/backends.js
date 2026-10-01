"use strict";
// Where a payload goes, and what has to be in the environment for it to arrive.
//
// Every credential is read from the environment and never from a file in the
// repository, never printed, and never written to the sidecar. `resolve` returns
// what is missing by VARIABLE NAME, which is the one thing worth saying out loud
// about a credential.

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
function parseHeaders(raw) {
  const out = {};
  for (const pair of String(raw || "").split(",")) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) throw new Error(`header ${JSON.stringify(trimmed)} is not key=value`);
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

function resolve(name, env) {
  const spec = BACKENDS[name];
  if (!spec) {
    throw new Error(`unknown backend ${JSON.stringify(name)} — one of ${Object.keys(BACKENDS).join(", ")}`);
  }
  const missing = [];
  const endpoint = env[spec.endpointVar] || spec.defaultEndpoint;
  if (!endpoint) missing.push(spec.endpointVar);

  const headers = { "Content-Type": "application/json" };
  for (const [header, variable] of Object.entries(spec.secrets)) {
    if (env[variable]) headers[header] = env[variable];
    else missing.push(variable);
  }
  for (const [header, variable] of Object.entries(spec.optional)) {
    if (env[variable]) headers[header] = env[variable];
  }
  if (spec.headersVar && env[spec.headersVar]) Object.assign(headers, parseHeaders(env[spec.headersVar]));

  return {
    name,
    url: endpoint ? `${endpoint.replace(/\/+$/, "")}${spec.suffix}` : null,
    headers,
    missing,
    kindAttribute: spec.kindAttribute,
    note: spec.note,
    ready: missing.length === 0,
    hint: missing.length ? NO_NETWORK_HINT : null,
  };
}

module.exports = { BACKENDS, resolve, parseHeaders };
