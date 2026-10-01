"use strict";
// The one module here that touches the network.
//
// It never throws. Telemetry failing is not delivery failing: a gate that was
// recorded stays recorded whether or not a trace reached a vendor, and a CLI
// that exits non-zero because an endpoint blipped would teach people to stop
// running it.
const https = require("node:https");
const http = require("node:http");
const { URL } = require("node:url");
const { redactUrl, redactText } = require("./redact");

// 401 and 403 are not retried: a wrong or revoked key will be just as wrong on
// the third attempt, and retrying it only delays the message that says so.
const RETRYABLE = (status) => status === 0 || status === 429 || (status >= 500 && status < 600);

// Node names these precisely; a reader seeing one needs to know there is a
// supported answer that is not "turn verification off".
const CERT_ERRORS = new Set([
  "DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "CERT_HAS_EXPIRED", "ERR_TLS_CERT_ALTNAME_INVALID",
]);

function certHint(code) {
  return ` — the endpoint's certificate was not trusted (${code}). If this is a self-hosted ` +
         "collector, export its certificate and set NAVI_TELEMETRY_CA_FILE to that file: " +
         "verification stays on and is pinned to that server.";
}

function once(url, headers, body, timeoutMs, ca) {
  return new Promise((resolve) => {
    let target;
    try {
      target = new URL(url);
    } catch {
      // Redacted: this message is printed AND written to the sidecar, and an
      // endpoint that fails to parse is exactly the one carrying a typo next
      // to a credential.
      resolve({ status: 0, body: "", error: `not a URL: ${redactUrl(url)}` });
      return;
    }
    const lib = target.protocol === "http:" ? http : https;
    // `lib.request` validates headers synchronously and THROWS on an invalid
    // value — a key with a trailing CR does it. Without this catch the promise
    // rejects, the sidecar is never written, and under --all every remaining
    // change is abandoned mid-loop. "This module never throws" has to be true
    // on the synchronous path too, not only the callback ones.
    let req;
    try {
      req = lib.request(target, {
        method: "POST",
        headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
        timeout: timeoutMs,
        // Pins verification to this certificate rather than disabling it.
        ...(ca ? { ca } : {}),
      }, (res) => {
        let chunks = "";
        res.setEncoding("utf8");
        res.on("data", (c) => { if (chunks.length < 4096) chunks += c; });
        res.on("end", () => resolve({ status: res.statusCode, body: chunks, error: null }));
      });
    } catch (e) {
      resolve({ status: 0, body: "", error: redactText(`request could not be built: ${e.message}`) });
      return;
    }
    req.on("timeout", () => { req.destroy(new Error(`no response in ${timeoutMs}ms`)); });
    req.on("error", (e) => resolve({
      status: 0, body: "",
      error: redactText(e.message) + (CERT_ERRORS.has(e.code) ? certHint(e.code) : ""),
    }));
    try {
      req.write(body);
      req.end();
    } catch (e) {
      resolve({ status: 0, body: "", error: redactText(`request could not be sent: ${e.message}`) });
    }
  });
}

async function post(url, headers, payload, opts = {}) {
  const { retries = 2, timeoutMs = 10000, ca = null,
          sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = opts;
  const body = JSON.stringify(payload);
  // The values this request carries as credentials. Every message that leaves
  // here is scrubbed of them by value — a vendor that echoes `X-Ingest-Key=…`
  // back in a 400 body matches no pattern, and that body is both printed and
  // written into a committed file.
  const sent = Object.entries(headers || {})
    .filter(([name]) => name.toLowerCase() !== "content-type" && name.toLowerCase() !== "content-length")
    .map(([, value]) => value);
  const scrub = (text) => redactText(text, sent);
  let attempt = 0;
  let last = { status: 0, body: "", error: "never attempted" };

  while (attempt <= retries) {
    attempt += 1;
    last = await once(url, headers, body, timeoutMs, ca);
    if (last.status >= 200 && last.status < 300) {
      return { ok: true, status: last.status, attempts: attempt, bytes: body.length, error: null };
    }
    if (!RETRYABLE(last.status)) break;
    if (attempt <= retries) await sleep(200 * attempt);
  }

  return {
    ok: false,
    status: last.status,
    attempts: attempt,
    bytes: body.length,
    // The response body is the only place a vendor says WHY it refused, so it
    // is carried through rather than reduced to the status code.
    // Scrubbed BEFORE truncation. Slicing first cut credentials in half, and
    // half a key no longer matches by value — so a body over 400 characters,
    // which is the normal case for an HTML gateway page, put most of a live key
    // into a committed file. The 400 applies to what is kept, not to what is
    // searched.
    error: scrub(last.error || `HTTP ${last.status}${last.body ? `: ${last.body}` : ""}`).slice(0, 400),
  };
}

module.exports = { post, once, RETRYABLE };
