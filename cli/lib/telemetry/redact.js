"use strict";
// One redaction, used by everything that prints or stores an endpoint or an
// error. It lived in backends.js, which the exporter does not import — so the
// exporter put raw text into its error message, and that message is both
// printed and written into delivery/.adlc/telemetry.json, a committed file.
const { URL } = require("node:url");

// Greedy to the LAST `@` before the path, because a password may contain `@`:
// `user:p@ss@host` must redact `user:p@ss`, not just `user:p`.
const USERINFO = /(^|\/\/)[^/\s:]+:[^/\s]*@/;

// A path segment of this shape is a token, not a route. Several ingest
// endpoints carry the key in the path, where nothing distinguishes it from a
// route except length and alphabet — so the rule is deliberately crude and
// errs towards redacting: a sidecar that says `<redacted>` where a long route
// id used to be is less precise, never wrong.
const TOKENISH_SEGMENT = /^[A-Za-z0-9_-]{20,}$/;

const SECRET_PARAM = /(^|[?&;])([A-Za-z0-9_.-]*(?:key|token|secret|password|passwd|auth|sas|sig|signature|credential)[A-Za-z0-9_.-]*)=[^\s&;"']+/gi;

function escapeRe(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripUserinfo(value) {
  return value.replace(USERINFO, "$1<redacted>@");
}

// Query, fragment and `;`-parameters all go wholesale: none of them is worth
// keeping precisely, and all three have carried a key in the wild.
function stripTrailers(value) {
  const cut = value.search(/[?#;]/);
  return cut === -1 ? value : `${value.slice(0, cut)}${value[cut]}<redacted>`;
}

// Applied to the PATH only. Run over the whole string it also matched host
// labels, so `https://agentobs-prod-eastus.example.com/...` lost its hostname —
// destroying the one fact the sidecar exists to record, which endpoint this
// went to.
function stripTokenPath(value) {
  const authority = /^[a-z][a-z0-9+.-]*:\/\//i.exec(value);
  const afterHost = authority
    ? value.indexOf("/", authority[0].length)
    : value.indexOf("/");
  if (afterHost === -1) return value;
  const head = value.slice(0, afterHost);
  const tail = value.slice(afterHost).replace(/\/([A-Za-z0-9_-]+)/g, (whole, seg) =>
    (TOKENISH_SEGMENT.test(seg) ? "/<redacted>" : whole));
  return head + tail;
}

// An OTLP endpoint is ordinarily not a secret, but four ordinary forms carry
// one: userinfo, a query-string key, a `;`-parameter, and a key embedded in the
// path. All four are removed, whether or not the string parses as a URL — an
// endpoint with a typo in it still has to be printable, and a typo is exactly
// when it gets printed.
function redactUrl(url) {
  if (typeof url !== "string" || !url) return url;
  const trimmed = url.trim();
  let out = trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.username || parsed.password) {
      parsed.username = "";
      parsed.password = "";
      out = parsed.toString().replace("://", "://<redacted>@");
    }
  } catch {
    // Unparseable, and so never reaching the branch above — the path a typo'd
    // port or a missing scheme takes.
  }
  return stripTokenPath(stripTrailers(stripUserinfo(out)));
}

// Free text on its way to stdout or the sidecar: an error from Node, a response
// body a vendor chose the shape of.
//
// `known` is the decisive part. Pattern-matching a body for credentials is
// guesswork — a gateway that echoes `X-Ingest-Key=…` back on a 400 matches no
// query-parameter rule — but the caller KNOWS which strings it sent as
// credentials, so those are removed by value. Patterns then catch what the
// caller does not know about.
function redactText(text, known = []) {
  if (typeof text !== "string" || !text) return text;

  // Pattern passes FIRST. The marker `<redacted>` contains `<`, which ends the
  // URL pattern's character class — so substituting by value first truncated
  // every URL at the first known secret and let the rest of it through.
  // Supplying a known secret made the output strictly less redacted than
  // supplying none.
  let out = text
    .replace(/\b((?:https?|grpc):\/\/[^\s"'<>]+)/gi, (m) => redactUrl(m))
    .replace(SECRET_PARAM, "$1$2=<redacted>")
    .replace(/(^|\s|\/\/)([^/\s:]+):([^/\s]*)@/g, "$1<redacted>@");

  for (const secret of known) {
    // Short values are not credentials worth matching and would redact ordinary
    // words out of a diagnostic message.
    if (typeof secret !== "string" || secret.length < 8) continue;
    // Case-insensitively, and in percent-encoded form: a vendor that lowercases
    // or url-encodes the value it echoes back was leaking it in full.
    const forms = new Set([secret, encodeURIComponent(secret), encodeURI(secret)]);
    for (const form of forms) {
      out = out.replace(new RegExp(escapeRe(form), "gi"), "<redacted>");
    }
  }
  return out;
}

module.exports = { redactUrl, redactText };
