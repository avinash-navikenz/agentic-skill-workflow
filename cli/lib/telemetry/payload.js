"use strict";
// Spans -> OTLP/HTTP JSON. Pure, and hand-built on purpose.
//
// Hand-built because this project has no runtime dependencies and will not
// acquire an OpenTelemetry SDK to serialize three span shapes. JSON rather
// than protobuf because all three supported backends accept OTLP/HTTP JSON,
// and protobuf would mean a dependency and a code generator.

// One OTLP KeyValue. Booleans become strings rather than boolValue: AgentObs's
// normalizer is unproven against boolValue, and an attribute silently dropped
// is worse than one rendered as the string "true".
function attr(key, value) {
  if (typeof value === "boolean") return { key, value: { stringValue: value ? "true" : "false" } };
  if (typeof value === "string") return { key, value: { stringValue: value } };
  if (Number.isInteger(value)) return { key, value: { intValue: value } };
  if (typeof value === "number") return { key, value: { doubleValue: value } };
  return { key, value: { stringValue: String(value) } };
}

// Strings, not numbers: nanosecond timestamps exceed Number.MAX_SAFE_INTEGER,
// and OTLP/HTTP JSON specifies them as decimal strings for exactly that reason.
const nanos = (v) => (typeof v === "bigint" ? v.toString() : String(v));

function truncate(value, max) {
  if (!max || typeof value !== "string" || value.length <= max) return value;
  return `${value.slice(0, max)}…[truncated ${value.length - max} chars]`;
}

function spanToOtlp(traceId, span, opts) {
  const { kindAttribute = "llm.span.kind", maxAttrChars = 8192 } = opts || {};
  const attributes = { ...span.attributes };
  // The attribute that decides whether a span renders at all in AgentObs.
  // Missing or misspelled there means stored and invisible, with no error on
  // any side. The other backends ignore it.
  if (span.kind && kindAttribute) attributes[kindAttribute] = span.kind;

  const out = {
    traceId,
    spanId: span.spanId,
    name: span.name,
    kind: 1,
    startTimeUnixNano: nanos(span.startNs),
    endTimeUnixNano: nanos(span.endNs),
    attributes: Object.entries(attributes).map(([k, v]) => attr(k, truncate(v, maxAttrChars))),
    status: { code: span.statusCode },
  };
  if (span.parentSpanId) out.parentSpanId = span.parentSpanId;
  if (span.statusMessage) out.status.message = truncate(span.statusMessage, maxAttrChars);
  return out;
}

// service.name is a resource attribute, so spans that claim different services
// cannot share a group. That grouping is what makes a per-service view — which
// every one of these backends has — show anything but one undifferentiated blob.
function toPayload(traceId, spans, resourceAttrs = {}, opts = {}) {
  const groups = new Map();
  for (const span of spans) {
    if (!groups.has(span.serviceName)) groups.set(span.serviceName, []);
    groups.get(span.serviceName).push(span);
  }
  return {
    resourceSpans: [...groups.entries()].map(([serviceName, group]) => ({
      resource: {
        attributes: [
          attr("service.name", serviceName),
          ...Object.entries(resourceAttrs).map(([k, v]) => attr(k, v)),
        ],
      },
      scopeSpans: [{
        scope: { name: "navi-delivery", version: "0.1.0" },
        spans: group.map((s) => spanToOtlp(traceId, s, opts)),
      }],
    })),
  };
}

module.exports = { toPayload, spanToOtlp, attr, truncate };
