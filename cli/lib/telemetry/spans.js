"use strict";
// The events -> spans fold. Pure: no clock, no network, no environment.
//
// Everything that varies — the trace namespace, the span kinds, the service
// name — arrives as an argument, so the same function builds the payload the
// exporter sends and the payload `telemetry preview` writes to a file. A
// preview that cannot be trusted to match what is sent is worth nothing.
const crypto = require("node:crypto");

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

// Deterministic ids, not random ones: re-exporting a change — a retry, a
// backfill, a second export after two more gates — must land on the same trace
// rather than scattering one change across parallel traces.
function traceIdFor(namespace, change) {
  return sha(`navi-delivery|${namespace}|${change}`).slice(0, 32);
}
function spanIdFor(traceId, spanPath) {
  return sha(`${traceId}|${spanPath}`).slice(0, 16);
}

function toNanos(iso) {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`event has an unparseable ts: ${JSON.stringify(iso)}`);
  return BigInt(ms) * 1000000n;
}

const VERDICT_STATUS = { pass: 1, waived: 1, archived: 1, fail: 2 };

function fold(events, opts) {
  const { namespace, change, serviceName = "navi-delivery",
          wrapperKind = "agent", gateKind = "task", lane = null } = opts;

  const mine = events.filter((e) => e && e.change === change && e.gate);
  if (mine.length === 0) return null;

  const traceId = traceIdFor(namespace, change);
  const rootId = spanIdFor(traceId, "change");
  const startNs = toNanos(mine[0].ts);
  const endNs = toNanos(mine[mine.length - 1].ts);

  const seen = new Map();
  const spans = [];
  const tally = { pass: 0, fail: 0, waived: 0, archived: 0 };
  let previousNs = startNs;

  for (const e of mine) {
    const n = (seen.get(e.gate) || 0) + 1;
    seen.set(e.gate, n);
    const spanPath = n === 1 ? `gate:${e.gate}` : `gate:${e.gate}#${n}`;
    const ns = toNanos(e.ts);
    if (e.verdict in tally) tally[e.verdict] += 1;

    const attributes = {
      "navi.change": change,
      "navi.gate": e.gate,
      "navi.verdict": String(e.verdict),
      // A gate decision is an instant, so this span has no duration to report.
      // The interval since the previous decision is the number a delivery
      // dashboard actually wants, and it is recorded as what it is — an
      // attribute — rather than dressed up as a measured span duration.
      "navi.since_previous_ms": Number((ns - previousNs) / 1000000n),
      "navi.attempt": n,
    };
    if (lane) attributes["navi.lane"] = lane;
    if (e.evidence) attributes["navi.evidence"] = String(e.evidence);
    if (e.reason) attributes["navi.waiver_reason"] = String(e.reason);
    if (e.expires) attributes["navi.waiver_expires"] = String(e.expires);
    if (e.previous) attributes["navi.previous_verdict"] = String(e.previous);
    // Who recorded it, and how strongly that is attested — an inferred name
    // must never be read as a typed one, which is why both travel together.
    if (e.actor) attributes["navi.actor"] = String(e.actor);
    if (e.actor_source) attributes["navi.actor_source"] = String(e.actor_source);

    spans.push({
      spanId: spanIdFor(traceId, spanPath), parentSpanId: rootId,
      name: `${e.gate} ${e.verdict}`, kind: gateKind, serviceName,
      startNs: ns, endNs: ns, attributes,
      statusCode: VERDICT_STATUS[e.verdict] ?? 1,
      statusMessage: e.verdict === "fail" ? `${e.gate} failed: ${e.evidence || "no evidence recorded"}` : null,
    });
    previousNs = ns;
  }

  const rootAttributes = {
    "navi.change": change,
    "navi.decisions": mine.length,
    "navi.gates_passed": tally.pass,
    "navi.gates_failed": tally.fail,
    "navi.gates_waived": tally.waived,
    "navi.archived": tally.archived > 0,
    "navi.elapsed_ms": Number((endNs - startNs) / 1000000n),
  };
  if (lane) rootAttributes["navi.lane"] = lane;

  spans.unshift({
    spanId: rootId, parentSpanId: null, name: `change:${change}`,
    kind: wrapperKind, serviceName, startNs, endNs, attributes: rootAttributes,
    // A change with a failed gate still open is not a failed trace: the fail is
    // recorded on its own span, and rework is the normal path, not an error.
    statusCode: 1, statusMessage: null,
  });

  return { traceId, spans };
}

module.exports = { fold, traceIdFor, spanIdFor, toNanos };
