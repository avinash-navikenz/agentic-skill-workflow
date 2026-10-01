"use strict";
// One redaction, used by everything that prints or stores an endpoint.
//
// It lived in backends.js, which the exporter does not import — so the exporter
// put the raw url into its error message, and that message was both printed and
// written into delivery/.adlc/telemetry.json, which is a committed file.
const { URL } = require("node:url");

// Greedy up to the LAST `@` before the path, because a password may itself
// contain `@`: `user:p@ss@host` must redact `user:p@ss`, not just `user:p`.
const USERINFO = /(^|\/\/)[^/\s:]+:[^/\s]*@/;

function stripUserinfo(value) {
  return value.replace(USERINFO, "$1<redacted>@");
}

function stripQuery(value) {
  const q = value.indexOf("?");
  return q === -1 ? value : `${value.slice(0, q)}?<redacted>`;
}

// An OTLP endpoint is ordinarily not a secret, but two ordinary forms carry one:
// userinfo (`https://user:token@host/...`) and a query-string key. Both are
// removed whether or not the string parses as a URL — an endpoint with a typo
// in it still has to be printable, and that is exactly when it gets printed.
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
    // Unparseable, and so never reaching the branch above. This is the path a
    // typo'd port or a missing scheme takes, and it used to return here with
    // the query string intact.
  }
  return stripQuery(stripUserinfo(out));
}

// Anything that may carry an endpoint — an error message from a failed request,
// a line on its way to stdout — passes through here before it is shown or
// stored. A message is not a URL, so the whole string is scrubbed in place.
function redactText(text) {
  if (typeof text !== "string" || !text) return text;
  return text
    .replace(/(^|\s|\/\/)([^/\s:]+):([^/\s]*)@/g, "$1<redacted>@")
    .replace(/([?&])(?:[A-Za-z0-9_.-]*(?:key|token|secret|password|sig|signature)[A-Za-z0-9_.-]*)=[^\s&"]+/gi,
             "$1<redacted>");
}

module.exports = { redactUrl, redactText };
