"use strict";
const fs = require("node:fs");
const { eventsPath, adlcDir } = require("./paths");

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

module.exports = { appendEvent, readEvents };
