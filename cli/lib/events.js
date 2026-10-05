"use strict";
const fs = require("node:fs");
const { eventsPath, usagePath, adlcDir } = require("./paths");

function appendEvent(root, evt) {
  fs.mkdirSync(adlcDir(root), { recursive: true });
  const record = { ts: new Date().toISOString(), ...evt };
  fs.appendFileSync(eventsPath(root), JSON.stringify(record) + "\n");
}

function readEvents(root) {
  const p = eventsPath(root);
  if (!fs.existsSync(p)) return [];
  const lines = fs.readFileSync(p, "utf8").split("\n").filter(Boolean);
  return lines.map((l, idx) => {
    try {
      return JSON.parse(l);
    } catch (err) {
      throw new Error(`${p}: line ${idx + 1} is not valid JSON — ${err.message}`);
    }
  });
}

// Usage records share the events format — one JSON object per line — but not
// the file, so a reader can clear model telemetry without touching the gate
// ledger that gates are read from.
function appendUsage(root, record) {
  fs.mkdirSync(adlcDir(root), { recursive: true });
  fs.appendFileSync(usagePath(root), JSON.stringify({ ts: new Date().toISOString(), ...record }) + "\n");
}

function readUsage(root) {
  const p = usagePath(root);
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, "utf8").split("\n").filter(Boolean).map((l, idx) => {
    try {
      return JSON.parse(l);
    } catch (err) {
      throw new Error(`${p}: line ${idx + 1} is not valid JSON — ${err.message}`);
    }
  });
}

module.exports = { appendEvent, readEvents, appendUsage, readUsage };
