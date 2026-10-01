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

function once(url, headers, body, timeoutMs) {
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
    req.on("error", (e) => resolve({ status: 0, body: "", error: redactText(e.message) }));
    try {
      req.write(body);
      req.end();
    } catch (e) {
      resolve({ status: 0, body: "", error: redactText(`request could not be sent: ${e.message}`) });
    }
  });
}

async function post(url, headers, payload, opts = {}) {
  const { retries = 2, timeoutMs = 10000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = opts;
  const body = JSON.stringify(payload);
  let attempt = 0;
  let last = { status: 0, body: "", error: "never attempted" };

  while (attempt <= retries) {
    attempt += 1;
    last = await once(url, headers, body, timeoutMs);
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
    error: redactText(last.error || `HTTP ${last.status}${last.body ? `: ${last.body.slice(0, 400)}` : ""}`),
  };
}

module.exports = { post, once, RETRYABLE };
