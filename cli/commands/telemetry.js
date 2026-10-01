"use strict";
// navi-delivery telemetry — send the delivery record to an OTLP backend.
//
// What this exports is the delivery lifecycle: one trace per change, one span
// per gate decision. It is NOT the agents' own LLM calls — this CLI makes none,
// and claiming otherwise would be the kind of promise the skills in this
// framework exist to stop people making. Instrumenting the agents and the
// product is what navi-skill-agent-observability covers; this is the ledger.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { readEvents } = require("../lib/events");
const { readState } = require("../lib/state");
const { adlcDir } = require("../lib/paths");
const { fold } = require("../lib/telemetry/spans");
const { toPayload } = require("../lib/telemetry/payload");
const { BACKENDS, resolve, redactUrl } = require("../lib/telemetry/backends");
const { post } = require("../lib/telemetry/exporter");
const { flagValue } = require("../lib/args");

const USAGE = `usage: navi-delivery telemetry <doctor|preview|export> [options]

  doctor                    which backends are configured, and what is missing
  preview [--out <file>]    build the payload and write it; sends nothing
                            takes --backend too, to preview exactly that backend's payload
  export  --backend <name>  send it

  --backend <name>   ${Object.keys(BACKENDS).join(" | ")}
  --change <slug>    default: the change in state.json
  --all              every change the event log knows about
  --out <file>       preview only; default is stdout as a summary
  --dry-run          export only; resolve and build, report, send nothing
`;

// The namespace keeps two repositories that both propose "add-csv-export" from
// sharing a trace id. The remote url is the stable identity when there is one;
// the absolute path is the honest fallback, and a copied checkout getting its
// own traces is the correct outcome either way.
function namespaceFor(cwd, env) {
  if (env.NAVI_OTLP_TRACE_NAMESPACE) return env.NAVI_OTLP_TRACE_NAMESPACE;
  try {
    return execFileSync("git", ["remote", "get-url", "origin"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
           || path.resolve(cwd);
  } catch {
    return path.resolve(cwd);
  }
}

function foldOptions(cwd, env, lane) {
  return {
    namespace: namespaceFor(cwd, env),
    serviceName: env.NAVI_OTLP_SERVICE_NAME || "navi-delivery",
    wrapperKind: env.NAVI_OTLP_SPAN_KIND || "agent",
    gateKind: env.NAVI_OTLP_GATE_SPAN_KIND || "task",
    lane,
  };
}

function changesIn(events) {
  const seen = [];
  for (const e of events) if (e && e.change && e.gate && !seen.includes(e.change)) seen.push(e.change);
  return seen;
}

function selectChanges(argv, cwd, events, emit) {
  if (argv.includes("--all")) return changesIn(events);
  const flag = flagValue(argv, "--change");
  if (flag.present) {
    if (!flag.value) { emit("--change needs a change name"); return null; }
    return [flag.value];
  }
  const state = readState(cwd);
  if (state && state.change) return [state.change];
  emit("no change in flight — name one with --change <slug>, or use --all");
  return null;
}

function build(cwd, env, changes, events, state) {
  const built = [];
  for (const change of changes) {
    const lane = state && state.change === change ? state.lane : null;
    const folded = fold(events, { ...foldOptions(cwd, env, lane), change });
    if (!folded) { built.push({ change, folded: null }); continue; }
    built.push({ change, folded });
  }
  return built;
}

function sidecarPath(cwd) {
  return path.join(adlcDir(cwd), "telemetry.json");
}

// The sidecar is the local answer to "did it actually arrive?". It records the
// url and the outcome and never a credential — not the key, not the header it
// travelled in.
function recordSidecar(cwd, entries) {
  const p = sidecarPath(cwd);
  let existing = {};
  try { existing = JSON.parse(fs.readFileSync(p, "utf8")); } catch { existing = {}; }
  for (const entry of entries) existing[entry.change] = entry;
  fs.mkdirSync(adlcDir(cwd), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(existing, null, 2) + "\n");
  return p;
}

function doctor(cwd, env, emit) {
  emit("backend     ready  endpoint");
  for (const name of Object.keys(BACKENDS)) {
    let r;
    try {
      r = resolve(name, env);
    } catch (e) {
      // One malformed variable used to abort the whole listing, so the operator
      // asking "why is this backend not configured" got a crash instead of the
      // answer — and lost the rows below it too.
      emit(`${name.padEnd(11)} no     (not resolvable)`);
      emit(`            ${e.message}`);
      continue;
    }
    emit(`${name.padEnd(11)} ${(r.ready ? "yes" : "no ").padEnd(6)} ${redactUrl(r.url) || "(unset)"}`);
    if (r.missing.length) emit(`            missing: ${r.missing.join(", ")}`);
    for (const problem of r.problems) emit(`            ${problem}`);
    // Header names, never header values. The value is the credential.
    const sent = Object.keys(r.headers).filter((h) => h !== "Content-Type");
    if (sent.length) emit(`            headers: ${sent.join(", ")}`);
    emit(`            ${r.note}`);
  }
  emit("");
  emit(`trace namespace: ${namespaceFor(cwd, env)}`);
  emit(`wrapper span kind: ${env.NAVI_OTLP_SPAN_KIND || "agent"} (NAVI_OTLP_SPAN_KIND)`);
  emit(`gate span kind:    ${env.NAVI_OTLP_GATE_SPAN_KIND || "task"} (NAVI_OTLP_GATE_SPAN_KIND)`);
  emit("AgentObs renders only span kinds it recognises; a kind it does not know is");
  emit("accepted, stored, and shown nowhere. Probe before trusting a dashboard.");
  return 0;
}

function preview(argv, cwd, env, emit) {
  const events = readEvents(cwd);
  const changes = selectChanges(argv, cwd, events, emit);
  if (!changes) return 1;
  const state = readState(cwd);
  const built = build(cwd, env, changes, events, state);
  const out = flagValue(argv, "--out");

  // A preview that could differ from what export sends would be worth nothing,
  // so when a backend is named the preview is built with that backend's own
  // settings. All four currently agree on the span-kind attribute; this is what
  // keeps the promise true if one ever stops agreeing.
  const backendFlag = flagValue(argv, "--backend");
  let opts = {};
  if (backendFlag.value) {
    try {
      opts = { kindAttribute: resolve(backendFlag.value, env).kindAttribute };
    } catch (e) { emit(e.message); return 1; }
  }

  const payloads = [];
  let empties = 0;
  for (const { change, folded } of built) {
    if (!folded) {
      emit(`${change}: no gate decisions recorded — nothing to export`);
      empties += 1;
      continue;
    }
    payloads.push({
      change, traceId: folded.traceId, spans: folded.spans.length,
      payload: toPayload(folded.traceId, folded.spans,
                         { "navi.change": change, "navi.framework": "navi-delivery" }, opts),
    });
    emit(`${change}: trace ${folded.traceId}, ${folded.spans.length} span(s)`);
  }
  // Same rule as export, so the two agree and both match the documented table:
  // --all finding nothing is an ordinary empty state; a change you NAMED that
  // holds nothing is not. (A default run with no change in flight never gets
  // this far — selectChanges reports that and returns null.) `preview --all`
  // used to exit 1 on a quiet repository while `export --all` exited 0.
  if (!payloads.length) {
    if (argv.includes("--all")) { emit("nothing recorded yet — no trace to build"); return 0; }
    return 1;
  }

  if (out.present) {
    if (!out.value) { emit("--out needs a file path"); return 1; }
    fs.writeFileSync(out.value, JSON.stringify(payloads.map((p) => p.payload), null, 2) + "\n");
    emit(`wrote ${out.value}`);
  }
  return 0;
}

async function exportSpans(argv, cwd, env, emit) {
  const backendFlag = flagValue(argv, "--backend");
  if (!backendFlag.value) { emit("--backend is required; see `navi-delivery telemetry doctor`"); return 1; }

  let target;
  try {
    target = resolve(backendFlag.value, env);
  } catch (e) { emit(e.message); return 1; }
  if (!target.ready) {
    if (target.missing.length) {
      emit(`${target.name} is not configured — missing: ${target.missing.join(", ")}`);
    }
    for (const problem of target.problems) emit(`${target.name}: ${problem}`);
    return 1;
  }

  const events = readEvents(cwd);
  const changes = selectChanges(argv, cwd, events, emit);
  if (!changes) return 1;
  const state = readState(cwd);
  const built = build(cwd, env, changes, events, state);
  const dryRun = argv.includes("--dry-run");

  const entries = [];
  let failures = 0;
  // A change NAMED on the command line that holds nothing is a typo or a change
  // that has not reached a gate — the caller asked for something specific and
  // got nothing, so the exit code says so. A default or --all run finding
  // nothing is an ordinary empty state and stays 0.
  const named = flagValue(argv, "--change").present;
  for (const { change, folded } of built) {
    if (!folded) {
      emit(`${change}: no gate decisions recorded — nothing to export`);
      if (named) failures += 1;
      continue;
    }
    const payload = toPayload(folded.traceId, folded.spans,
                              { "navi.change": change, "navi.framework": "navi-delivery" },
                              { kindAttribute: target.kindAttribute });
    if (dryRun) {
      emit(`${change}: would send ${folded.spans.length} span(s) to ${redactUrl(target.url)} (trace ${folded.traceId})`);
      continue;
    }
    const result = await post(target.url, target.headers, payload);
    entries.push({
      // Redacted: delivery/.adlc/ is part of the committed tree, and an OTLP
      // endpoint may legitimately carry userinfo or a query-string key.
      change, backend: target.name, url: redactUrl(target.url), trace_id: folded.traceId,
      spans: folded.spans.length, ok: result.ok, status: result.status,
      attempts: result.attempts, bytes: result.bytes, error: result.error,
      at: new Date().toISOString(),
    });
    if (result.ok) emit(`${change}: sent ${folded.spans.length} span(s) — HTTP ${result.status}`);
    else { failures += 1; emit(`${change}: NOT sent — ${result.error}`); }
  }

  if (entries.length) emit(`record: ${path.relative(cwd, recordSidecar(cwd, entries))}`);
  // A telemetry failure is reported and is not a delivery failure: nothing
  // about the gates changed, and the record on disk still says what happened.
  return failures ? 1 : 0;
}

function run(argv, cwd, emit = console.log, env = process.env) {
  const sub = argv[0];
  const rest = argv.slice(1);
  if (!sub || argv.includes("--help")) { emit(USAGE); return sub ? 0 : 1; }
  if (sub === "doctor") return doctor(cwd, env, emit);
  if (sub === "preview") return preview(rest, cwd, env, emit);
  if (sub === "export") return exportSpans(rest, cwd, env, emit);
  emit(USAGE);
  return 1;
}

module.exports = { run, namespaceFor, build, changesIn, sidecarPath };
